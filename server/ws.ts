import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import { db, isBlockedBetween, sha256, threadKeyFor, type DbUser } from "./db";

type ClientSocket = WebSocket & { userId?: string; isAlive?: boolean };

const userSockets = new Map<string, Set<ClientSocket>>();

export function isUserConnected(userId: string): boolean {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
}

export function sendToUser(userId: string, event: string, payload: unknown) {
  const set = userSockets.get(userId);
  if (!set) return;
  const serialized = JSON.stringify({ event, payload });
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function parseSessionTokenFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken) return queryToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === "rc_session") {
        return decodeURIComponent(rest.join("="));
      }
    }
  }
  return null;
}

function resolveUserFromToken(token: string | null): DbUser | null {
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
  return row ?? null;
}

export function broadcastPresence(userId: string, online: boolean) {
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(now, userId);

  // Notify connected users who are NOT blocked with this user and have a thread with them
  const peers = db
    .prepare(
      `SELECT DISTINCT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS peer_id
       FROM messages
       WHERE sender_id = ? OR recipient_id = ?`,
    )
    .all(userId, userId, userId) as { peer_id: string }[];

  for (const { peer_id } of peers) {
    if (!isBlockedBetween(userId, peer_id)) {
      sendToUser(peer_id, "presence:update", { userId, online, lastActiveAt: now });
    }
  }
}

export function attachWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const reqUrl = req.url ?? "";
    const pathname = reqUrl.split("?")[0];
    if (pathname !== "/ws") {
      return;
    }

    const token = parseSessionTokenFromRequest(req);
    const user = resolveUserFromToken(token);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = ws as ClientSocket;
      client.userId = user.id;
      client.isAlive = true;
      wss.emit("connection", client, req);
    });
  });

  wss.on("connection", (ws: ClientSocket) => {
    const userId = ws.userId;
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    let set = userSockets.get(userId);
    if (!set) {
      set = new Set();
      userSockets.set(userId, set);
    }
    set.add(ws);
    broadcastPresence(userId, true);

    ws.send(JSON.stringify({ event: "connected", payload: { userId } }));

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          event?: string;
          payload?: Record<string, unknown>;
        };
        const event = data.event;
        const payload = data.payload ?? {};

        if (event === "ping") {
          db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(
            new Date().toISOString(),
            userId,
          );
          ws.send(JSON.stringify({ event: "pong", payload: { ts: Date.now() } }));
          return;
        }

        if (event === "typing") {
          const peerId = typeof payload["peerId"] === "string" ? payload["peerId"] : "";
          const active = Boolean(payload["active"]);
          if (!peerId || isBlockedBetween(userId, peerId)) return;
          sendToUser(peerId, "typing", { fromUserId: userId, active });
          return;
        }

        if (event === "messages:seen") {
          const peerId = typeof payload["peerId"] === "string" ? payload["peerId"] : "";
          if (!peerId || isBlockedBetween(userId, peerId)) return;
          const key = threadKeyFor(userId, peerId);
          const seenAt = new Date().toISOString();
          const result = db
            .prepare(
              "UPDATE messages SET seen_at = ? WHERE thread_key = ? AND sender_id = ? AND recipient_id = ? AND seen_at IS NULL",
            )
            .run(seenAt, key, peerId, userId);

          if (result.changes > 0) {
            sendToUser(peerId, "messages:seen", { byUserId: userId, peerId: userId, seenAt });
            sendToUser(userId, "messages:seen", { byUserId: userId, peerId, seenAt });
          }
          return;
        }

        if (event === "call:initiate") {
          const targetId = typeof payload["targetId"] === "string" ? payload["targetId"] : "";
          const callType = payload["callType"] === "video" ? "video" : "audio";
          if (!targetId || targetId === userId) return;
          if (isBlockedBetween(userId, targetId)) {
            ws.send(
              JSON.stringify({
                event: "call:error",
                payload: { error: "Cannot initiate call. This user is blocked." },
              }),
            );
            return;
          }
          const caller = db
            .prepare(
              "SELECT id, full_name, display_handle, avatar_media_id FROM users WHERE id = ?",
            )
            .get(userId) as
            | {
                id: string;
                full_name: string;
                display_handle: string;
                avatar_media_id: string | null;
              }
            | undefined;
          if (!caller) return;
          const callId = `call_${Date.now().toString(36)}`;
          sendToUser(targetId, "call:incoming", {
            callId,
            callType,
            from: {
              id: caller.id,
              fullName: caller.full_name,
              displayHandle: caller.display_handle,
              avatarUrl: caller.avatar_media_id ? `/api/media/${caller.avatar_media_id}` : null,
            },
          });
          ws.send(
            JSON.stringify({ event: "call:ringing", payload: { callId, targetId, callType } }),
          );
          return;
        }

        if (event === "call:signal") {
          const targetId = typeof payload["targetId"] === "string" ? payload["targetId"] : "";
          if (!targetId || isBlockedBetween(userId, targetId)) return;
          sendToUser(targetId, "call:signal", {
            fromUserId: userId,
            callId: payload["callId"],
            action: payload["action"],
          });
        }
      } catch {
        /* ignore malformed ws frame */
      }
    });

    ws.on("close", () => {
      const current = userSockets.get(userId);
      if (current) {
        current.delete(ws);
        if (current.size === 0) {
          userSockets.delete(userId);
          broadcastPresence(userId, false);
        }
      }
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      const client = ws as ClientSocket;
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(interval));
  return wss;
}
