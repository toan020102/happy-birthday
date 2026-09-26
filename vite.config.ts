import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import path from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const MUSIC_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// Vite snapshots public files at startup and skips this folder so copying an
// MP3 does not reload the party. Serve it from disk instead.
function serveMusicFromDisk() {
  const root = path.resolve("public/music");
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return {
    name: "serve-music-from-disk",
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url ?? "";
        const pathname = requestUrl.split("?")[0] ?? "";
        if (!pathname.startsWith("/music/")) return next();
        let relative = "";
        try {
          relative = decodeURIComponent(pathname.slice("/music/".length));
        } catch {
          return next();
        }
        if (!relative || relative.includes("\0")) return next();
        const file = path.resolve(root, relative);
        if (file !== root && !file.startsWith(rootPrefix)) return next();
        fs.stat(file, (error, stat) => {
          if (error || !stat.isFile()) return next();
          const type = MUSIC_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
          const total = stat.size;
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Type", type);
          res.setHeader("Cache-Control", "no-cache");
          if (req.method === "HEAD") {
            res.statusCode = 200;
            res.setHeader("Content-Length", total);
            res.end();
            return;
          }
          if (req.method !== "GET") return next();
          const header = req.headers.range;
          const range = Array.isArray(header) ? header[0] : header;
          if (!range) {
            res.statusCode = 200;
            res.setHeader("Content-Length", total);
            fs.createReadStream(file).pipe(res);
            return;
          }
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match) {
            res.statusCode = 416;
            res.setHeader("Content-Range", `bytes */${total}`);
            res.end();
            return;
          }
          let start = match[1] ? Number(match[1]) : Number.NaN;
          let end = match[2] ? Number(match[2]) : total - 1;
          if (!match[1] && match[2]) {
            const suffix = Number(match[2]);
            start = Math.max(total - suffix, 0);
            end = total - 1;
          }
          if (!Number.isFinite(start)) start = 0;
          if (start >= total || start > end) {
            res.statusCode = 416;
            res.setHeader("Content-Range", `bytes */${total}`);
            res.end();
            return;
          }
          end = Math.min(end, total - 1);
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
          res.setHeader("Content-Length", end - start + 1);
          fs.createReadStream(file, { start, end }).pipe(res);
        });
      });
    },
  };
}

const partyRelayServers = new WeakSet<object>();

// Phones that can open the page share this socket, so a new guest joins the
// party already running instead of sitting alone on a public relay.
function partyRelay() {
  return {
    name: "party-relay",
    configureServer(server: { httpServer: { on: (event: string, listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) => void } | null }) {
      const httpServer = server.httpServer;
      if (!httpServer || partyRelayServers.has(httpServer)) return;
      partyRelayServers.add(httpServer);
      const wss = new WebSocketServer({ noServer: true });
      const recent: Array<{ topic: string; event: unknown; at: number }> = [];
      type Subscription = { id: string; topics: Set<string> };
      const clients = new Map<WebSocket, Subscription[]>();

      const sendEvent = (socket: WebSocket, subId: string, event: unknown) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(["EVENT", subId, event]));
      };

      httpServer.on("upgrade", (req, socket, head) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/party-relay") return;
        wss.handleUpgrade(req, socket, head, (ws) => {
          const subscriptions: Subscription[] = [];
          clients.set(ws, subscriptions);
          ws.on("message", (data) => {
            let message: unknown;
            try {
              message = JSON.parse(String(data));
            } catch {
              return;
            }
            if (!Array.isArray(message)) return;
            const [type, first, second] = message;
            if (type === "EVENT" && first && typeof first === "object") {
              const event = first as { id?: string; tags?: unknown[] };
              const topic = event.tags?.find((tag) => Array.isArray(tag) && tag[0] === "x" && typeof tag[1] === "string")?.[1];
              if (typeof topic !== "string") return;
              const now = Date.now();
              recent.push({ topic, event, at: now });
              while (recent.length > 500) recent.shift();
              for (const [peer, peerSubs] of clients) {
                if (peer === ws) continue;
                for (const sub of peerSubs) {
                  if (sub.topics.has(topic)) sendEvent(peer, sub.id, event);
                }
              }
              if (typeof event.id === "string") ws.send(JSON.stringify(["OK", event.id, true, ""]));
              return;
            }
            if (type === "REQ" && typeof first === "string" && second && typeof second === "object") {
              const topics = new Set<string>();
              const filters = Array.isArray(second) ? second : [second];
              for (const filter of filters) {
                if (!filter || typeof filter !== "object") continue;
                const tagged = (filter as { "#x"?: unknown })["#x"];
                if (!Array.isArray(tagged)) continue;
                for (const topic of tagged) if (typeof topic === "string") topics.add(topic);
              }
              subscriptions.push({ id: first, topics });
              const now = Date.now();
              for (const item of recent) {
                if (now - item.at > 20000 || !topics.has(item.topic)) continue;
                sendEvent(ws, first, item.event);
              }
              return;
            }
            if (type === "CLOSE" && typeof first === "string") {
              const index = subscriptions.findIndex((sub) => sub.id === first);
              if (index >= 0) subscriptions.splice(index, 1);
            }
          });
          ws.on("close", () => clients.delete(ws));
        });
      });
    },
  };
}

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      // Windows binds "localhost" to IPv6 only, while cloudflared connects over IPv4.
      host: "0.0.0.0",
      // Tunnel and preview hostnames change every run.
      allowedHosts: [".trycloudflare.com", ".ngrok-free.dev", ".vercel.app"],
      watch: {
        ignored: ["**/public/music/**"],
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    plugins: [
      partyRelay(),
      serveMusicFromDisk(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
