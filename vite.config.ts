import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "vite";
import { defineConfig, type Plugin, type ProxyOptions } from "vitest/config";
import react from "@vitejs/plugin-react";
import { handleAstra } from "./src/server/astra";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function withUa(extra: ProxyOptions = {}): ProxyOptions {
  return {
    changeOrigin: true,
    secure: true,
    configure(proxy) {
      proxy.on("proxyReq", (req) => {
        req.setHeader("User-Agent", UA);
        req.setHeader("Accept", "application/json");
        // Public RPC providers reject browser origins even though this request is
        // sent by the local development proxy.
        req.removeHeader("Origin");
        req.removeHeader("Referer");
      });
    },
    ...extra,
  };
}

export const proxy: Record<string, ProxyOptions> = {
  "/rugcheck": withUa({
    target: "https://api.rugcheck.xyz",
    rewrite: (path) => path.replace(/^\/rugcheck/, "/v1"),
  }),
  "/dex": withUa({
    target: "https://api.dexscreener.com",
    rewrite: (path) => path.replace(/^\/dex/, ""),
  }),
  "/gecko": withUa({
    target: "https://api.geckoterminal.com",
    rewrite: (path) => path.replace(/^\/gecko/, "/api/v2"),
  }),
  "/paprika": withUa({
    target: "https://api.dexpaprika.com",
    rewrite: (path) => path.replace(/^\/paprika/, ""),
  }),
  "/ray": withUa({
    target: "https://transaction-v1.raydium.io",
    rewrite: (path) => path.replace(/^\/ray/, ""),
  }),
  "/rpc-backup": withUa({
    target: "https://solana-rpc.publicnode.com",
    rewrite: () => "/",
  }),
  "/rpc": withUa({
    target: "https://api.mainnet-beta.solana.com",
    rewrite: () => "/",
  }),
};

async function fableMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const path = req.url?.split("?")[0];
  if (!path?.startsWith("/api/")) {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  if (req.method === "POST") {
    for await (const c of req) {
      const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += chunk.length;
      if (size > 32768) {
        res.statusCode = 413;
        res.end('{"error":"too large"}');
        return;
      }
      chunks.push(chunk);
    }
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const body = chunks.length
    ? new Uint8Array(Buffer.concat(chunks))
    : undefined;
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) ac.abort();
  });
  const request = new Request(
    `http://${req.headers.host || "127.0.0.1:4664"}${req.url}`,
    {
      method: req.method || "GET",
      headers,
      signal: ac.signal,
      body,
      duplex: body ? "half" : undefined,
    } as RequestInit,
  );
  const out = await handleAstra(request);
  res.statusCode = out.status;
  out.headers.forEach((v, k) => res.setHeader(k, v));
  if (!out.body) {
    res.end();
    return;
  }
  const reader = out.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

export function fablePlugin(): Plugin {
  return {
    name: "fable-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void fableMiddleware(req, res, next).catch(next);
      });
    },
    configurePreview(server) {
      server.middlewares.use((req, res, next) => {
        void fableMiddleware(req, res, next).catch(next);
      });
    },
  };
}

export function loadServerEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (
      key === "OPENAI_API_KEY" ||
      key.startsWith("ASTRA_") ||
      key.startsWith("UPSTASH_")
    )
      process.env[key] = value;
  }
}

export default defineConfig(({ mode }) => {
  loadServerEnv(mode);
  return {
    plugins: [react(), fablePlugin()],
    server: {
      // The API handler validates exact origins and owns its preflight headers.
      cors: false,
      port: 4664,
      proxy,
      watch: {
        ignored: [
          "**/playwright-report/**",
          "**/test-results/**",
          "**/dist-ext/**",
          "**/docs/test-artifacts/**",
        ],
      },
    },
    preview: { port: 4664, proxy, cors: false },
    test: {
      include: ["src/**/*.test.ts"],
      testTimeout: 30000,
    },
  };
});
