import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function resolveDataDir(): string {
  const envDir = process.env["DATA_DIR"]?.trim();
  if (envDir) {
    const abs = path.resolve(envDir);
    fs.mkdirSync(path.join(abs, "media"), { recursive: true });
    return abs;
  }

  const localDir = path.resolve(process.cwd(), ".data");
  if (process.env["VERCEL"] !== "1") {
    try {
      fs.mkdirSync(path.join(localDir, "media"), { recursive: true });
      return localDir;
    } catch {
      /* read-only filesystem fallback */
    }
  }

  const tmpDir = path.join(os.tmpdir(), "reading-corner-data");
  fs.mkdirSync(path.join(tmpDir, "media"), { recursive: true });
  return tmpDir;
}

const DATA_DIR = resolveDataDir();
const MEDIA_DIR = path.join(DATA_DIR, "media");
const DB_PATH = path.join(DATA_DIR, "reading-corner.sqlite");

export const mediaDir = MEDIA_DIR;
export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Non-destructive schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone_e164 TEXT UNIQUE NOT NULL,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    full_name TEXT NOT NULL,
    display_handle TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_media_id TEXT,
    password_hash TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'instagram',
    created_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nfc_links (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_ciphertext TEXT,
    token_hash TEXT UNIQUE,
    revoked INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS media_objects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT,
    kind TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    is_public_avatar INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_key TEXT NOT NULL,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    media_id TEXT REFERENCES media_objects(id) ON DELETE SET NULL,
    media_kind TEXT,
    media_name TEXT,
    created_at TEXT NOT NULL,
    seen_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_key, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_recipient_seen ON messages(recipient_id, seen_at);

  CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY,
    phone_e164 TEXT NOT NULL,
    purpose TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_reading_state (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export type SecretTheme = "instagram" | "emerald" | "dark";

export type DbUser = {
  id: string;
  phone_e164: string;
  phone_verified: number;
  full_name: string;
  display_handle: string;
  bio: string;
  avatar_media_id: string | null;
  password_hash: string;
  theme: SecretTheme;
  created_at: string;
  last_active_at: string;
};

export type PublicUser = {
  id: string;
  fullName: string;
  displayHandle: string;
  bio: string;
  avatarUrl: string | null;
  theme: SecretTheme;
  phoneVerified: boolean;
  lastActiveAt: string;
  online: boolean;
};

const SECRET_FILE = path.join(DATA_DIR, ".session-secret");
function loadServerSecret(): string {
  const envSecret = process.env["SESSION_SECRET"]?.trim();
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, "utf8").trim();
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

const SERVER_SECRET = loadServerSecret();
const NFC_KEY = crypto.createHash("sha256").update(`nfc::${SERVER_SECRET}`).digest();

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expectedHex = parts[2];
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", NFC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(payload: string): string | null {
  try {
    const parts = payload.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      NFC_KEY,
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function normalizePhoneE164(raw: string, defaultCountryCode = "+91"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (cleaned.startsWith("00")) {
    const digits = cleaned.slice(2).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = cleaned.replace(/\D/g, "");
  const strippedLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  const cc = defaultCountryCode.startsWith("+") ? defaultCountryCode : `+${defaultCountryCode}`;
  const full = `${cc}${strippedLeadingZero}`;
  const totalDigits = full.slice(1);
  if (totalDigits.length < 8 || totalDigits.length > 15) return null;
  return full;
}

export function threadKeyFor(userA: string, userB: string): string {
  return [userA, userB].sort().join("::");
}

export function isOnlineActive(lastActiveAt: string): boolean {
  const ts = Date.parse(lastActiveAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < 90_000;
}

export function toPublicUser(u: DbUser, onlineOverride?: boolean): PublicUser {
  return {
    id: u.id,
    fullName: u.full_name,
    displayHandle: u.display_handle,
    bio: u.bio,
    avatarUrl: u.avatar_media_id ? `/api/media/${u.avatar_media_id}` : null,
    theme: u.theme === "emerald" || u.theme === "dark" ? u.theme : "instagram",
    phoneVerified: u.phone_verified === 1,
    lastActiveAt: u.last_active_at,
    online: onlineOverride ?? isOnlineActive(u.last_active_at),
  };
}

export function createNfcTokenForUser(userId: string): { token: string; version: number } {
  const token = `rc_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = sha256(token);
  const ciphertext = encryptToken(token);
  const now = new Date().toISOString();

  const existing = db.prepare("SELECT id, version FROM nfc_links WHERE user_id = ?").get(userId) as
    { id: string; version: number } | undefined;

  if (existing) {
    const nextVersion = existing.version + 1;
    db.prepare(
      "UPDATE nfc_links SET token_ciphertext = ?, token_hash = ?, revoked = 0, version = ?, updated_at = ? WHERE user_id = ?",
    ).run(ciphertext, tokenHash, nextVersion, now, userId);
    return { token, version: nextVersion };
  }

  db.prepare(
    "INSERT INTO nfc_links (id, user_id, token_ciphertext, token_hash, revoked, version, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?)",
  ).run(`nfc_${crypto.randomUUID()}`, userId, ciphertext, tokenHash, now, now);
  return { token, version: 1 };
}

export function isBlockedBetween(userA: string, userB: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1",
    )
    .get(userA, userB, userB, userA);
  return Boolean(row);
}

export function didUserBlock(blockerId: string, blockedId: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ? LIMIT 1")
    .get(blockerId, blockedId);
  return Boolean(row);
}
