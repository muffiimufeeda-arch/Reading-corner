import { EventEmitter } from "node:events";
import http from "node:http";
import type net from "node:net";
import { PassThrough } from "node:stream";
import express from "express";

import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let apiAppPromise: Promise<express.Express> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function getApiApp(): Promise<express.Express> {
  if (!apiAppPromise) {
    apiAppPromise = import("../server/api").then(({ createApiRouter }) => {
      const app = express();
      app.use("/api", createApiRouter());
      return app;
    });
  }
  return apiAppPromise;
}

async function dispatchApiRequest(request: Request): Promise<Response> {
  const app = await getApiApp();
  const url = new URL(request.url);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const rawBody = hasBody ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);

  const emitter = new EventEmitter();
  const fakeSocket = Object.assign(emitter, {
    remoteAddress: "127.0.0.1",
    writable: true,
    readable: true,
    destroyed: false,
    write: () => true,
    end: () => fakeSocket,
    destroy: () => fakeSocket,
    setTimeout: () => fakeSocket,
    setNoDelay: () => fakeSocket,
    setKeepAlive: () => fakeSocket,
    pause: () => fakeSocket,
    resume: () => fakeSocket,
    cork: () => {},
    uncork: () => {},
  }) as unknown as net.Socket;

  const req = new http.IncomingMessage(fakeSocket);
  req.method = request.method;
  req.url = url.pathname + url.search;
  (req as http.IncomingMessage & { originalUrl?: string }).originalUrl = req.url;

  const reqHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    reqHeaders[key.toLowerCase()] = value;
  });
  if (hasBody && rawBody.byteLength > 0 && !reqHeaders["content-length"]) {
    reqHeaders["content-length"] = String(rawBody.byteLength);
  }
  req.headers = reqHeaders;

  if (rawBody.byteLength > 0) {
    req.push(rawBody);
  }
  req.push(null);

  return await new Promise<Response>((resolve, reject) => {
    const headerStore = new Map<string, string | string[]>();
    const chunks: Buffer[] = [];
    const pipeBridge = new PassThrough();
    let settled = false;

    const res = new http.ServerResponse(req);
    res.statusCode = 200;

    let ended = false;
    let headersSent = false;

    const buildHeaders = () => {
      const headers = new Headers();
      for (const [k, v] of headerStore.entries()) {
        if (Array.isArray(v)) {
          for (const item of v) headers.append(k, item);
        } else {
          headers.set(k, v);
        }
      }
      return headers;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      headersSent = true;
      ended = true;
      const bodyBuffer = Buffer.concat(chunks);
      const status = res.statusCode || 200;
      const noBodyStatus = status === 204 || status === 304;
      resolve(
        new Response(noBodyStatus ? null : bodyBuffer, {
          status,
          headers: buildHeaders(),
          ...(res.statusMessage ? { statusText: res.statusMessage } : {}),
        }),
      );
      queueMicrotask(() => {
        res.emit("finish");
        res.emit("close");
      });
    };

    Object.defineProperties(res, {
      headersSent: { get: () => headersSent },
      writableEnded: { get: () => ended },
      writableFinished: { get: () => ended },
      finished: { get: () => ended },
    });

    res.setHeader = ((name: string, value: number | string | readonly string[]) => {
      const key = name.toLowerCase();
      if (Array.isArray(value)) {
        headerStore.set(
          key,
          value.map((v) => String(v)),
        );
      } else {
        headerStore.set(key, String(value));
      }
      return res;
    }) as typeof res.setHeader;

    res.appendHeader = ((name: string, value: string | readonly string[]) => {
      const key = name.toLowerCase();
      const prev = headerStore.get(key);
      const incoming = Array.isArray(value) ? value.map(String) : [String(value)];
      if (!prev) {
        headerStore.set(key, incoming.length === 1 ? incoming[0]! : incoming);
      } else if (Array.isArray(prev)) {
        headerStore.set(key, [...prev, ...incoming]);
      } else {
        headerStore.set(key, [prev, ...incoming]);
      }
      return res;
    }) as typeof res.appendHeader;

    res.getHeader = ((name: string) => {
      return headerStore.get(name.toLowerCase());
    }) as typeof res.getHeader;

    res.getHeaders = (() => {
      const out: http.OutgoingHttpHeaders = {};
      for (const [k, v] of headerStore.entries()) out[k] = v;
      return out;
    }) as typeof res.getHeaders;

    res.getHeaderNames = (() => Array.from(headerStore.keys())) as typeof res.getHeaderNames;
    res.hasHeader = ((name: string) => headerStore.has(name.toLowerCase())) as typeof res.hasHeader;
    res.removeHeader = ((name: string) => {
      headerStore.delete(name.toLowerCase());
    }) as typeof res.removeHeader;

    res.writeHead = ((
      statusCode: number,
      reasonOrHeaders?: string | http.OutgoingHttpHeaders | http.OutgoingHttpHeader[],
      maybeHeaders?: http.OutgoingHttpHeaders | http.OutgoingHttpHeader[],
    ) => {
      res.statusCode = statusCode;
      const hdrs =
        typeof reasonOrHeaders === "string"
          ? maybeHeaders
          : (reasonOrHeaders as http.OutgoingHttpHeaders | undefined);
      if (typeof reasonOrHeaders === "string") {
        res.statusMessage = reasonOrHeaders;
      }
      if (hdrs && !Array.isArray(hdrs)) {
        for (const [k, v] of Object.entries(hdrs)) {
          if (v !== undefined) res.setHeader(k, v);
        }
      }
      headersSent = true;
      return res;
    }) as typeof res.writeHead;

    res.flushHeaders = (() => {
      headersSent = true;
    }) as typeof res.flushHeaders;

    const pushChunk = (chunk: unknown, encoding?: BufferEncoding) => {
      if (chunk === null || chunk === undefined) return;
      if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
      else chunks.push(Buffer.from(String(chunk), encoding ?? "utf8"));
    };

    res.write = ((
      chunk: unknown,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ) => {
      headersSent = true;
      const encoding = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
      const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb;
      pushChunk(chunk, encoding);
      if (callback) callback(null);
      return true;
    }) as typeof res.write;

    res.end = ((
      chunkOrCb?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void,
    ) => {
      const callback =
        typeof chunkOrCb === "function"
          ? (chunkOrCb as () => void)
          : typeof encodingOrCb === "function"
            ? encodingOrCb
            : cb;
      const encoding = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
      if (typeof chunkOrCb !== "function" && chunkOrCb !== undefined && chunkOrCb !== null) {
        pushChunk(chunkOrCb, encoding);
      }
      if (callback) callback();
      finish();
      return res;
    }) as typeof res.end;

    pipeBridge.on("error", reject);

    app(req as unknown as express.Request, res as unknown as express.Response, (err?: unknown) => {
      if (err) {
        reject(err);
        return;
      }
      if (!settled) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        pushChunk(JSON.stringify({ error: "API route not found." }));
        finish();
      }
    });
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return await dispatchApiRequest(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
