import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import {
  createNfcTokenForUser,
  db,
  decryptToken,
  didUserBlock,
  hashPassword,
  isBlockedBetween,
  mediaDir,
  normalizePhoneE164,
  sha256,
  threadKeyFor,
  toPublicUser,
  verifyPassword,
  type DbUser,
  type SecretTheme,
} from "./db";
import { isUserConnected, sendToUser } from "./ws";

type AuthedRequest = Request & { authUser?: DbUser; authToken?: string };

const SESSION_DAYS = 30;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25MB for photos & short videos

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 12);
      cb(null, `${Date.now()}_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_MEDIA_BYTES },
});

function getTwilioConfig() {
  const sid = process.env["TWILIO_ACCOUNT_SID"]?.trim() ?? "";
  const token = process.env["TWILIO_AUTH_TOKEN"]?.trim() ?? "";
  const serviceSid = process.env["TWILIO_VERIFY_SERVICE_SID"]?.trim() ?? "";
  return {
    configured: Boolean(sid && token && serviceSid),
    sid,
    token,
    serviceSid,
  };
}

async function sendTwilioOtp(phoneE164: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getTwilioConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error:
        "SMS OTP service is not configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID to enable real phone OTP verification.",
    };
  }
  const body = new URLSearchParams({ To: phoneE164, Channel: "sms" });
  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  const resp = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(cfg.serviceSid)}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, error: `SMS provider rejected OTP request (${resp.status}): ${text}` };
  }
  return { ok: true };
}

async function verifyTwilioOtp(
  phoneE164: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getTwilioConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error:
        "SMS OTP service is not configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID to enable real phone OTP verification.",
    };
  }
  const body = new URLSearchParams({ To: phoneE164, Code: code.trim() });
  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  const resp = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(cfg.serviceSid)}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  if (!resp.ok) {
    return { ok: false, error: "Invalid or expired OTP code." };
  }
  const data = (await resp.json()) as { status?: string };
  if (data.status !== "approved") {
    return { ok: false, error: "OTP verification did not pass. Please check the code." };
  }
  return { ok: true };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const val = auth.slice(7).trim();
    if (val) return val;
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === "rc_session") {
        const val = decodeURIComponent(rest.join("=")).trim();
        if (val) return val;
      }
    }
  }
  return null;
}

function lookupSessionUser(req: Request): { user: DbUser; token: string } | null {
  const token = extractToken(req);
  if (!token) return null;
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .get(sha256(token), now) as DbUser | undefined;
  if (!row) return null;
  return { user: row, token };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const resolved = lookupSessionUser(req);
  if (!resolved) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  req.authUser = resolved.user;
  req.authToken = resolved.token;
  db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    resolved.user.id,
  );
  next();
}

function issueSession(userId: string, req: Request, res: Response): string {
  const token = `rc_sess_${crypto.randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    `sess_${crypto.randomUUID()}`,
    userId,
    sha256(token),
    expires.toISOString(),
    now.toISOString(),
    String(req.headers["user-agent"] ?? "").slice(0, 200),
  );
  res.cookie("rc_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    secure: process.env["NODE_ENV"] === "production",
  });
  return token;
}

function makeHandle(fullName: string): string {
  const slug = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 14);
  const suffix = crypto.randomBytes(2).toString("hex");
  return `@${slug || "reader"}.${suffix}`;
}

function maskPhone(e164: string): string {
  if (e164.length <= 6) return "***";
  return `${e164.slice(0, 4)}••••${e164.slice(-3)}`;
}

function serializeMessage(m: {
  id: string;
  thread_key: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  media_id: string | null;
  media_kind: string | null;
  media_name: string | null;
  created_at: string;
  seen_at: string | null;
}) {
  return {
    id: m.id,
    threadKey: m.thread_key,
    from: m.sender_id,
    to: m.recipient_id,
    text: m.text,
    mediaUrl: m.media_id ? `/api/media/${m.media_id}` : null,
    mediaId: m.media_id,
    mediaKind: m.media_kind as "image" | "video" | "audio" | null,
    mediaName: m.media_name,
    createdAt: m.created_at,
    seenAt: m.seen_at,
  };
}

export function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "4mb" }));

  router.get("/health", (_req, res) => {
    res.json({ ok: true, otpConfigured: getTwilioConfig().configured });
  });

  router.get("/auth/otp-status", (_req, res) => {
    const cfg = getTwilioConfig();
    res.json({
      configured: cfg.configured,
      provider: cfg.configured ? "twilio_verify" : null,
    });
  });

  // Register using phone number, password, and required profile details
  router.post("/auth/register", async (req, res) => {
    try {
      const {
        phone,
        countryCode,
        password,
        fullName,
        bio = "",
        otpCode,
        avatarDataUrl,
      } = req.body as {
        phone?: string;
        countryCode?: string;
        password?: string;
        fullName?: string;
        bio?: string;
        otpCode?: string;
        avatarDataUrl?: string;
      };

      const phoneE164 = normalizePhoneE164(phone ?? "", countryCode ?? "+91");
      if (!phoneE164) {
        res.status(400).json({ error: "Enter a valid phone number with country code." });
        return;
      }

      const name = String(fullName ?? "").trim();
      if (name.length < 2 || name.length > 60) {
        res.status(400).json({ error: "Full name is required (2–60 characters)." });
        return;
      }

      const pwd = String(password ?? "");
      if (pwd.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters." });
        return;
      }

      const existing = db
        .prepare("SELECT id FROM users WHERE phone_e164 = ? LIMIT 1")
        .get(phoneE164);
      if (existing) {
        res.status(409).json({
          error: "An account is already registered with this phone number. Please sign in instead.",
        });
        return;
      }

      let phoneVerified = 0;
      const twilio = getTwilioConfig();
      if (twilio.configured) {
        if (!otpCode || !String(otpCode).trim()) {
          res
            .status(400)
            .json({ error: "Please enter the SMS verification code sent to your phone." });
          return;
        }
        const check = await verifyTwilioOtp(phoneE164, String(otpCode));
        if (!check.ok) {
          res.status(400).json({ error: check.error ?? "Phone OTP verification failed." });
          return;
        }
        phoneVerified = 1;
      }

      const userId = `u_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      let avatarMediaId: string | null = null;

      // Support optional initial profile photo upload cleanly as private/avatar media
      if (avatarDataUrl && avatarDataUrl.startsWith("data:image/")) {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(avatarDataUrl);
        if (match && match[1] && match[2]) {
          const buf = Buffer.from(match[2], "base64");
          if (buf.byteLength <= 4 * 1024 * 1024) {
            const ext = match[1].split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
            const fileName = `avatar_${userId}.${ext}`;
            fs.writeFileSync(path.join(mediaDir, fileName), buf);
            avatarMediaId = `med_${crypto.randomUUID()}`;
            db.prepare(
              "INSERT INTO media_objects (id, owner_id, recipient_id, kind, mime_type, original_name, file_path, size_bytes, is_public_avatar, created_at) VALUES (?, ?, NULL, 'image', ?, ?, ?, ?, 1, ?)",
            ).run(avatarMediaId, userId, match[1], fileName, fileName, buf.byteLength, now);
          }
        }
      }

      db.prepare(
        `INSERT INTO users (id, phone_e164, phone_verified, full_name, display_handle, bio, avatar_media_id, password_hash, theme, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'instagram', ?, ?)`,
      ).run(
        userId,
        phoneE164,
        phoneVerified,
        name,
        makeHandle(name),
        String(bio).trim().slice(0, 200),
        avatarMediaId,
        hashPassword(pwd),
        now,
        now,
      );

      createNfcTokenForUser(userId);
      const token = issueSession(userId, req, res);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser;

      res.status(201).json({
        token,
        user: {
          ...toPublicUser(user, true),
          phoneMasked: maskPhone(user.phone_e164),
          phoneE164: user.phone_e164,
        },
      });
    } catch (err) {
      console.error("register error", err);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // Login using phone number and password only (no username required)
  router.post("/auth/login", (req, res) => {
    const { phone, countryCode, password } = req.body as {
      phone?: string;
      countryCode?: string;
      password?: string;
    };

    const phoneE164 = normalizePhoneE164(phone ?? "", countryCode ?? "+91");
    if (!phoneE164) {
      res.status(400).json({ error: "Enter a valid phone number." });
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE phone_e164 = ? LIMIT 1").get(phoneE164) as
      DbUser | undefined;

    if (!user || !verifyPassword(String(password ?? ""), user.password_hash)) {
      res.status(401).json({ error: "Invalid phone number or password." });
      return;
    }

    // Ensure legacy or pre-existing user has an NFC link provisioned
    const existingNfc = db
      .prepare("SELECT id FROM nfc_links WHERE user_id = ? LIMIT 1")
      .get(user.id);
    if (!existingNfc) {
      createNfcTokenForUser(user.id);
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(now, user.id);
    const token = issueSession(user.id, req, res);

    res.json({
      token,
      user: {
        ...toPublicUser({ ...user, last_active_at: now }, true),
        phoneMasked: maskPhone(user.phone_e164),
        phoneE164: user.phone_e164,
      },
    });
  });

  router.post("/auth/logout", (req: AuthedRequest, res) => {
    const token = extractToken(req);
    if (token) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    }
    res.clearCookie("rc_session", { path: "/" });
    res.json({ ok: true });
  });

  router.get("/auth/me", (req, res) => {
    const resolved = lookupSessionUser(req);
    if (!resolved) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    const { user } = resolved;
    res.json({
      user: {
        ...toPublicUser(user, true),
        phoneMasked: maskPhone(user.phone_e164),
        phoneE164: user.phone_e164,
      },
    });
  });

  // Send real SMS OTP (Forgot Password or Phone Verification)
  router.post("/auth/otp/send", async (req, res) => {
    const {
      phone,
      countryCode,
      purpose = "reset_password",
    } = req.body as {
      phone?: string;
      countryCode?: string;
      purpose?: "reset_password" | "verify_phone" | "register";
    };

    const phoneE164 = normalizePhoneE164(phone ?? "", countryCode ?? "+91");
    if (!phoneE164) {
      res.status(400).json({ error: "Enter a valid phone number." });
      return;
    }

    if (purpose === "reset_password") {
      const existing = db
        .prepare("SELECT id FROM users WHERE phone_e164 = ? LIMIT 1")
        .get(phoneE164);
      if (!existing) {
        res.status(404).json({ error: "No account is registered with that phone number." });
        return;
      }
    }

    const recentWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentCount = db
      .prepare("SELECT COUNT(*) AS cnt FROM otp_challenges WHERE phone_e164 = ? AND created_at > ?")
      .get(phoneE164, recentWindow) as { cnt: number };

    if (recentCount.cnt >= 5) {
      res.status(429).json({ error: "Too many OTP requests. Please wait 15 minutes." });
      return;
    }

    const result = await sendTwilioOtp(phoneE164);
    if (!result.ok) {
      res.status(503).json({ error: result.error, needsConfig: !getTwilioConfig().configured });
      return;
    }

    const now = new Date();
    db.prepare(
      "INSERT INTO otp_challenges (id, phone_e164, purpose, created_at, expires_at, attempts, consumed) VALUES (?, ?, ?, ?, ?, 0, 0)",
    ).run(
      `otp_${crypto.randomUUID()}`,
      phoneE164,
      purpose,
      now.toISOString(),
      new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    );

    res.json({ ok: true, phoneMasked: maskPhone(phoneE164) });
  });

  // Reset password with real verified OTP
  router.post("/auth/otp/reset-password", async (req, res) => {
    const { phone, countryCode, code, newPassword } = req.body as {
      phone?: string;
      countryCode?: string;
      code?: string;
      newPassword?: string;
    };

    const phoneE164 = normalizePhoneE164(phone ?? "", countryCode ?? "+91");
    if (!phoneE164) {
      res.status(400).json({ error: "Enter a valid phone number." });
      return;
    }

    const pwd = String(newPassword ?? "");
    if (pwd.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE phone_e164 = ? LIMIT 1").get(phoneE164) as
      DbUser | undefined;
    if (!user) {
      res.status(404).json({ error: "No account found for that phone number." });
      return;
    }

    const check = await verifyTwilioOtp(phoneE164, String(code ?? ""));
    if (!check.ok) {
      res.status(400).json({ error: check.error, needsConfig: !getTwilioConfig().configured });
      return;
    }

    db.prepare("UPDATE users SET password_hash = ?, phone_verified = 1 WHERE id = ?").run(
      hashPassword(pwd),
      user.id,
    );
    // Invalidate existing sessions on password reset
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);

    res.json({ ok: true });
  });

  // Verify signed-in user's phone number with OTP
  router.post("/auth/otp/verify-phone", requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { code } = req.body as { code?: string };
    const check = await verifyTwilioOtp(user.phone_e164, String(code ?? ""));
    if (!check.ok) {
      res.status(400).json({ error: check.error, needsConfig: !getTwilioConfig().configured });
      return;
    }
    db.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").run(user.id);
    res.json({ ok: true, phoneVerified: true });
  });

  router.post("/auth/change-password", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!verifyPassword(String(currentPassword ?? ""), user.password_hash)) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }
    const nextPwd = String(newPassword ?? "");
    if (nextPwd.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(nextPwd),
      user.id,
    );
    res.json({ ok: true });
  });

  // Update profile details
  router.patch("/profile", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { fullName, bio, displayHandle } = req.body as {
      fullName?: string;
      bio?: string;
      displayHandle?: string;
    };

    const nextName = fullName !== undefined ? String(fullName).trim() : user.full_name;
    if (nextName.length < 2 || nextName.length > 60) {
      res.status(400).json({ error: "Full name must be 2–60 characters." });
      return;
    }
    const nextBio = bio !== undefined ? String(bio).trim().slice(0, 200) : user.bio;
    let nextHandle = user.display_handle;
    if (displayHandle !== undefined) {
      const cleaned = String(displayHandle)
        .trim()
        .replace(/^@+/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 28);
      if (cleaned.length < 2) {
        res.status(400).json({ error: "Handle must be at least 2 characters." });
        return;
      }
      nextHandle = `@${cleaned.toLowerCase()}`;
    }

    db.prepare("UPDATE users SET full_name = ?, bio = ?, display_handle = ? WHERE id = ?").run(
      nextName,
      nextBio,
      nextHandle,
      user.id,
    );

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
    res.json({
      user: {
        ...toPublicUser(updated, true),
        phoneMasked: maskPhone(updated.phone_e164),
        phoneE164: updated.phone_e164,
      },
    });
  });

  router.patch("/profile/theme", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { theme } = req.body as { theme?: string };
    if (theme !== "instagram" && theme !== "emerald" && theme !== "dark") {
      res.status(400).json({ error: "Theme must be instagram, emerald, or dark." });
      return;
    }
    db.prepare("UPDATE users SET theme = ? WHERE id = ?").run(theme as SecretTheme, user.id);
    res.json({ ok: true, theme });
  });

  router.post("/profile/avatar", requireAuth, upload.single("file"), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No image file provided." });
      return;
    }
    if (!file.mimetype.startsWith("image/")) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Avatar must be an image file." });
      return;
    }

    const mediaId = `med_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO media_objects (id, owner_id, recipient_id, kind, mime_type, original_name, file_path, size_bytes, is_public_avatar, created_at) VALUES (?, ?, NULL, 'image', ?, ?, ?, ?, 1, ?)",
    ).run(
      mediaId,
      user.id,
      file.mimetype,
      file.originalname || "avatar.jpg",
      file.filename,
      file.size,
      now,
    );

    db.prepare("UPDATE users SET avatar_media_id = ? WHERE id = ?").run(mediaId, user.id);
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
    res.json({
      user: {
        ...toPublicUser(updated, true),
        phoneMasked: maskPhone(updated.phone_e164),
        phoneE164: updated.phone_e164,
      },
    });
  });

  // Personal NFC Card & Secret Link Management
  router.get("/nfc", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    let row = db.prepare("SELECT * FROM nfc_links WHERE user_id = ?").get(user.id) as
      | {
          token_ciphertext: string | null;
          revoked: number;
          version: number;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      createNfcTokenForUser(user.id);
      row = db.prepare("SELECT * FROM nfc_links WHERE user_id = ?").get(user.id) as {
        token_ciphertext: string | null;
        revoked: number;
        version: number;
        updated_at: string;
      };
    }

    const token =
      row.revoked === 0 && row.token_ciphertext ? decryptToken(row.token_ciphertext) : null;

    res.json({
      revoked: row.revoked === 1 || !token,
      version: row.version,
      updatedAt: row.updated_at,
      token,
      path: token ? `/nfc/${token}` : null,
    });
  });

  router.post("/nfc/regenerate", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { token, version } = createNfcTokenForUser(user.id);
    res.json({
      revoked: false,
      version,
      updatedAt: new Date().toISOString(),
      token,
      path: `/nfc/${token}`,
    });
  });

  router.post("/nfc/revoke", requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE nfc_links SET revoked = 1, token_ciphertext = NULL, token_hash = NULL, updated_at = ? WHERE user_id = ?",
    ).run(now, user.id);
    res.json({ revoked: true, token: null, path: null, updatedAt: now });
  });

  // Resolve NFC tap securely — NEVER exposes passwords, phone numbers, or other user data
  router.get("/nfc/resolve", (req, res) => {
    const token = String(req.query["token"] ?? "").trim();
    if (!token || token.length < 16) {
      res.status(404).json({ status: "invalid" });
      return;
    }

    const link = db
      .prepare(
        `SELECT n.user_id, n.revoked, u.full_name, u.display_handle
         FROM nfc_links n
         JOIN users u ON u.id = n.user_id
         WHERE n.token_hash = ? AND n.revoked = 0
         LIMIT 1`,
      )
      .get(sha256(token)) as
      { user_id: string; revoked: number; full_name: string; display_handle: string } | undefined;

    if (!link) {
      res.status(404).json({ status: "invalid" });
      return;
    }

    const resolved = lookupSessionUser(req);
    if (resolved && resolved.user.id === link.user_id) {
      res.json({
        status: "authorized",
        owner: {
          id: link.user_id,
          fullName: link.full_name,
          displayHandle: link.display_handle,
        },
      });
      return;
    }

    // Do NOT leak full name, phone, or sensitive details to unauthenticated NFC taps
    const initial = link.full_name.trim().slice(0, 1).toUpperCase() || "R";
    res.json({
      status: "login_required",
      signedInAsDifferentAccount: Boolean(resolved && resolved.user.id !== link.user_id),
      ownerHint: `${initial}***`,
    });
  });

  // Search users by phone or name (NO total member counts exposed)
  router.get("/users/search", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const raw = String(req.query["q"] ?? "").trim();
    if (!raw) {
      res.json({ users: [] });
      return;
    }

    const maybePhone = normalizePhoneE164(raw, "+91");
    const like = `%${raw.toLowerCase()}%`;

    const rows = db
      .prepare(
        `SELECT * FROM users
         WHERE id != ?
           AND (LOWER(full_name) LIKE ? OR LOWER(display_handle) LIKE ? OR phone_e164 = ?)
         ORDER BY last_active_at DESC
         LIMIT 20`,
      )
      .all(me.id, like, like, maybePhone ?? "") as DbUser[];

    const visible = rows
      .filter((u) => !didUserBlock(u.id, me.id)) // Hide users who blocked me
      .map((u) => ({
        ...toPublicUser(u, isUserConnected(u.id) || undefined),
        blockedByMe: didUserBlock(me.id, u.id),
      }));

    res.json({ users: visible });
  });

  // List active conversations for the current user (NO public directory or member count)
  router.get("/conversations", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const peerRows = db
      .prepare(
        `SELECT DISTINCT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS peer_id
         FROM messages
         WHERE sender_id = ? OR recipient_id = ?`,
      )
      .all(me.id, me.id, me.id) as { peer_id: string }[];

    const conversations = peerRows
      .map(({ peer_id }) => {
        const peer = db.prepare("SELECT * FROM users WHERE id = ?").get(peer_id) as
          DbUser | undefined;
        if (!peer) return null;
        const key = threadKeyFor(me.id, peer.id);
        const lastMsg = db
          .prepare("SELECT * FROM messages WHERE thread_key = ? ORDER BY created_at DESC LIMIT 1")
          .get(key) as
          | {
              id: string;
              thread_key: string;
              sender_id: string;
              recipient_id: string;
              text: string;
              media_id: string | null;
              media_kind: string | null;
              media_name: string | null;
              created_at: string;
              seen_at: string | null;
            }
          | undefined;

        const unread = db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM messages WHERE thread_key = ? AND recipient_id = ? AND seen_at IS NULL",
          )
          .get(key, me.id) as { cnt: number };

        return {
          peer: toPublicUser(peer, isUserConnected(peer.id) || undefined),
          blockedByMe: didUserBlock(me.id, peer.id),
          blockedMe: didUserBlock(peer.id, me.id),
          lastMessage: lastMsg ? serializeMessage(lastMsg) : null,
          unreadCount: unread.cnt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) =>
        (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""),
      );

    res.json({ conversations });
  });

  // Fetch thread messages with a peer
  router.get("/messages/:peerId", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const peerId = String(req.params["peerId"] ?? "");
    const peer = db.prepare("SELECT * FROM users WHERE id = ?").get(peerId) as DbUser | undefined;
    if (!peer) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const key = threadKeyFor(me.id, peer.id);
    const rows = db
      .prepare("SELECT * FROM messages WHERE thread_key = ? ORDER BY created_at ASC LIMIT 300")
      .all(key) as {
      id: string;
      thread_key: string;
      sender_id: string;
      recipient_id: string;
      text: string;
      media_id: string | null;
      media_kind: string | null;
      media_name: string | null;
      created_at: string;
      seen_at: string | null;
    }[];

    res.json({
      peer: toPublicUser(peer, isUserConnected(peer.id) || undefined),
      blockedByMe: didUserBlock(me.id, peer.id),
      blockedMe: didUserBlock(peer.id, me.id),
      messages: rows.map(serializeMessage),
    });
  });

  // Send message (backend-enforced blocking!)
  router.post("/messages", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const {
      peerId,
      text = "",
      mediaId = null,
    } = req.body as {
      peerId?: string;
      text?: string;
      mediaId?: string | null;
    };

    const targetId = String(peerId ?? "").trim();
    if (!targetId || targetId === me.id) {
      res.status(400).json({ error: "Valid recipient required." });
      return;
    }

    const peer = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as DbUser | undefined;
    if (!peer) {
      res.status(404).json({ error: "Recipient not found." });
      return;
    }

    if (isBlockedBetween(me.id, peer.id)) {
      res.status(403).json({
        error: "Messaging is blocked between you and this user.",
      });
      return;
    }

    const cleanText = String(text).trim().slice(0, 4000);
    let mediaKind: string | null = null;
    let mediaName: string | null = null;
    let validMediaId: string | null = null;

    if (mediaId) {
      const mediaRow = db
        .prepare("SELECT * FROM media_objects WHERE id = ? AND owner_id = ? LIMIT 1")
        .get(mediaId, me.id) as { id: string; kind: string; original_name: string } | undefined;
      if (!mediaRow) {
        res.status(403).json({ error: "Invalid media attachment." });
        return;
      }
      validMediaId = mediaRow.id;
      mediaKind = mediaRow.kind;
      mediaName = mediaRow.original_name;
      db.prepare("UPDATE media_objects SET recipient_id = ? WHERE id = ?").run(
        peer.id,
        mediaRow.id,
      );
    }

    if (!cleanText && !validMediaId) {
      res.status(400).json({ error: "Message text or media is required." });
      return;
    }

    const msgId = `msg_${crypto.randomUUID()}`;
    const key = threadKeyFor(me.id, peer.id);
    const now = new Date().toISOString();
    const displayText =
      cleanText ||
      (mediaKind === "video"
        ? "Sent a video"
        : mediaKind === "audio"
          ? "Voice note"
          : "Sent a photo");

    db.prepare(
      `INSERT INTO messages (id, thread_key, sender_id, recipient_id, text, media_id, media_kind, media_name, created_at, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(msgId, key, me.id, peer.id, displayText, validMediaId, mediaKind, mediaName, now);

    const saved = db.prepare("SELECT * FROM messages WHERE id = ?").get(msgId) as {
      id: string;
      thread_key: string;
      sender_id: string;
      recipient_id: string;
      text: string;
      media_id: string | null;
      media_kind: string | null;
      media_name: string | null;
      created_at: string;
      seen_at: string | null;
    };

    const payload = {
      message: serializeMessage(saved),
      sender: toPublicUser(me, true),
    };

    sendToUser(peer.id, "message:new", payload);
    sendToUser(me.id, "message:new", payload);

    res.status(201).json(payload);
  });

  // Mark messages in a thread as seen
  router.post("/messages/:peerId/seen", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const peerId = String(req.params["peerId"] ?? "");
    if (!peerId || isBlockedBetween(me.id, peerId)) {
      res.json({ ok: true, updated: 0 });
      return;
    }

    const key = threadKeyFor(me.id, peerId);
    const seenAt = new Date().toISOString();
    const result = db
      .prepare(
        "UPDATE messages SET seen_at = ? WHERE thread_key = ? AND sender_id = ? AND recipient_id = ? AND seen_at IS NULL",
      )
      .run(seenAt, key, peerId, me.id);

    if (result.changes > 0) {
      sendToUser(peerId, "messages:seen", { byUserId: me.id, peerId: me.id, seenAt });
      sendToUser(me.id, "messages:seen", { byUserId: me.id, peerId, seenAt });
    }

    res.json({ ok: true, updated: result.changes, seenAt });
  });

  // Upload private photo / video / audio media
  router.post("/media", requireAuth, upload.single("file"), (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const recipientId =
      typeof req.body?.["recipientId"] === "string" ? req.body["recipientId"].trim() : null;

    if (recipientId && isBlockedBetween(me.id, recipientId)) {
      fs.unlinkSync(file.path);
      res.status(403).json({ error: "Cannot share media with a blocked user." });
      return;
    }

    const kind = file.mimetype.startsWith("video/")
      ? "video"
      : file.mimetype.startsWith("audio/")
        ? "audio"
        : file.mimetype.startsWith("image/")
          ? "image"
          : null;

    if (!kind) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Only image, video, and audio files are supported." });
      return;
    }

    const mediaId = `med_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO media_objects (id, owner_id, recipient_id, kind, mime_type, original_name, file_path, size_bytes, is_public_avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
    ).run(
      mediaId,
      me.id,
      recipientId,
      kind,
      file.mimetype,
      file.originalname || `${kind}.${kind === "video" ? "mp4" : "jpg"}`,
      file.filename,
      file.size,
      now,
    );

    res.status(201).json({
      id: mediaId,
      kind,
      mimeType: file.mimetype,
      originalName: file.originalname,
      url: `/api/media/${mediaId}`,
    });
  });

  // Protected private media endpoint with ACL & block check
  router.get("/media/:id", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const mediaId = String(req.params["id"] ?? "");
    const item = db.prepare("SELECT * FROM media_objects WHERE id = ? LIMIT 1").get(mediaId) as
      | {
          id: string;
          owner_id: string;
          recipient_id: string | null;
          kind: string;
          mime_type: string;
          original_name: string;
          file_path: string;
          is_public_avatar: number;
        }
      | undefined;

    if (!item) {
      res.status(404).json({ error: "Media not found." });
      return;
    }

    if (item.is_public_avatar === 1) {
      if (item.owner_id !== me.id && isBlockedBetween(me.id, item.owner_id)) {
        res.status(403).json({ error: "Access denied." });
        return;
      }
    } else {
      const allowed = item.owner_id === me.id || item.recipient_id === me.id;
      if (!allowed) {
        res.status(403).json({ error: "You do not have permission to access this private media." });
        return;
      }
      if (item.recipient_id && isBlockedBetween(item.owner_id, item.recipient_id)) {
        // Still allow viewing your own historical media, or restrict? Wait: owner can view own media
        if (item.owner_id !== me.id) {
          res.status(403).json({ error: "Media unavailable due to block." });
          return;
        }
      }
    }

    const fullPath = path.join(mediaDir, path.basename(item.file_path));
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "Media file missing." });
      return;
    }

    res.setHeader("Content-Type", item.mime_type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (req.query["download"] === "1") {
      const safeName = item.original_name.replace(/["\r\n]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    res.sendFile(fullPath, { dotfiles: "allow" });
  });

  // Gallery for Profile: photos & videos owned by or shared with the signed-in user
  router.get("/gallery", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const rows = db
      .prepare(
        `SELECT id, owner_id, recipient_id, kind, mime_type, original_name, size_bytes, created_at
         FROM media_objects
         WHERE is_public_avatar = 0
           AND kind IN ('image', 'video')
           AND (owner_id = ? OR recipient_id = ?)
         ORDER BY created_at DESC
         LIMIT 120`,
      )
      .all(me.id, me.id) as {
      id: string;
      owner_id: string;
      recipient_id: string | null;
      kind: string;
      mime_type: string;
      original_name: string;
      size_bytes: number;
      created_at: string;
    }[];

    const items = rows
      .filter((r) => r.owner_id === me.id || !isBlockedBetween(me.id, r.owner_id))
      .map((r) => ({
        id: r.id,
        kind: r.kind as "image" | "video",
        mimeType: r.mime_type,
        originalName: r.original_name,
        sizeBytes: r.size_bytes,
        createdAt: r.created_at,
        url: `/api/media/${r.id}`,
        mine: r.owner_id === me.id,
      }));

    res.json({ items });
  });

  // Blocking system (backend-enforced)
  router.get("/blocks", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const rows = db
      .prepare(
        `SELECT u.*, b.created_at AS blocked_at
         FROM blocked_users b
         JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = ?
         ORDER BY b.created_at DESC`,
      )
      .all(me.id) as (DbUser & { blocked_at: string })[];

    res.json({
      blockedUsers: rows.map((u) => ({
        ...toPublicUser(u, false),
        blockedAt: u.blocked_at,
      })),
    });
  });

  router.post("/blocks", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const targetId = String((req.body as { targetUserId?: string })?.targetUserId ?? "").trim();
    if (!targetId || targetId === me.id) {
      res.status(400).json({ error: "Valid user required." });
      return;
    }
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
    if (!target) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      "INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)",
    ).run(me.id, targetId, now);

    sendToUser(targetId, "block:updated", { byUserId: me.id, blocked: true });
    sendToUser(me.id, "block:updated", { targetUserId: targetId, blocked: true });

    res.status(201).json({ ok: true, blockedUserId: targetId });
  });

  router.delete("/blocks/:targetId", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const targetId = String(req.params["targetId"] ?? "").trim();
    db.prepare("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?").run(
      me.id,
      targetId,
    );

    sendToUser(targetId, "block:updated", { byUserId: me.id, blocked: false });
    sendToUser(me.id, "block:updated", { targetUserId: targetId, blocked: false });

    res.json({ ok: true, unblockedUserId: targetId });
  });

  // Backend-enforced call initiation check
  router.post("/calls/initiate", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const { targetUserId, callType = "audio" } = req.body as {
      targetUserId?: string;
      callType?: "audio" | "video";
    };
    const targetId = String(targetUserId ?? "").trim();
    if (!targetId || targetId === me.id) {
      res.status(400).json({ error: "Valid recipient required." });
      return;
    }
    if (isBlockedBetween(me.id, targetId)) {
      res.status(403).json({ error: "Cannot initiate call. This user is blocked." });
      return;
    }
    const callId = `call_${crypto.randomUUID()}`;
    sendToUser(targetId, "call:incoming", {
      callId,
      callType: callType === "video" ? "video" : "audio",
      from: toPublicUser(me, true),
    });
    res.json({ ok: true, callId });
  });

  // Protected per-user reading progress, bookmarks, favorites & history sync
  router.get("/reading-state", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const row = db
      .prepare("SELECT state_json, updated_at FROM user_reading_state WHERE user_id = ? LIMIT 1")
      .get(me.id) as { state_json: string; updated_at: string } | undefined;

    if (!row) {
      res.json({ state: null, updatedAt: null });
      return;
    }

    try {
      const parsed = JSON.parse(row.state_json) as Record<string, unknown>;
      res.json({ state: parsed, updatedAt: row.updated_at });
    } catch {
      res.json({ state: null, updatedAt: null });
    }
  });

  router.put("/reading-state", requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const body = req.body as { state?: Record<string, unknown> };
    if (
      !body ||
      typeof body.state !== "object" ||
      body.state === null ||
      Array.isArray(body.state)
    ) {
      res.status(400).json({ error: "Valid reading state object is required." });
      return;
    }

    // Sanitize & store only reading-related fields for this authenticated user
    const raw = body.state;
    const sanitized = {
      onboarded: Boolean(raw["onboarded"]),
      languages: Array.isArray(raw["languages"]) ? raw["languages"].slice(0, 20) : [],
      categories: Array.isArray(raw["categories"]) ? raw["categories"].slice(0, 30) : [],
      appTheme:
        raw["appTheme"] === "light" || raw["appTheme"] === "dark" || raw["appTheme"] === "system"
          ? raw["appTheme"]
          : "system",
      reader: typeof raw["reader"] === "object" && raw["reader"] !== null ? raw["reader"] : {},
      notifications:
        typeof raw["notifications"] === "object" && raw["notifications"] !== null
          ? raw["notifications"]
          : { reminders: true, newBooks: true },
      progress:
        typeof raw["progress"] === "object" && raw["progress"] !== null ? raw["progress"] : {},
      favorites: Array.isArray(raw["favorites"]) ? raw["favorites"].slice(0, 300) : [],
      bookmarks: Array.isArray(raw["bookmarks"]) ? raw["bookmarks"].slice(0, 500) : [],
      completed: Array.isArray(raw["completed"]) ? raw["completed"].slice(0, 300) : [],
      history: Array.isArray(raw["history"]) ? raw["history"].slice(0, 80) : [],
      streak: typeof raw["streak"] === "number" ? raw["streak"] : 1,
    };

    const now = new Date().toISOString();
    const serialized = JSON.stringify(sanitized);
    if (serialized.length > 512_000) {
      res.status(413).json({ error: "Reading state payload too large." });
      return;
    }

    db.prepare(
      `INSERT INTO user_reading_state (user_id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    ).run(me.id, serialized, now);

    res.json({ ok: true, updatedAt: now });
  });

  return router;
}
