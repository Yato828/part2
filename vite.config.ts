import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "vite";
import { defineConfig, type Plugin, type ProxyOptions } from "vitest/config";
import react from "@vitejs/plugin-react";
import { handleFable } from "./src/lib/fableServer";

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
      });
    },
    ...extra,
  };
}

export const proxy: Record<string, ProxyOptions> = {
  "/rhj": withUa({ target: "https://api.robinhood.com" }),
  "/chain": withUa({
    target: "https://robinhoodchain.blockscout.com",
    rewrite: (path) => path.replace(/^\/chain/, "/api/v2"),
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
  "/rpc": withUa({
    target: "https://rpc.mainnet.chain.robinhood.com",
    rewrite: () => "/",
  }),
};

async function fableMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const path = req.url?.split("?")[0];
  if (path !== "/api/fable") {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  if (req.method === "POST") {
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const body = chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined;
  const request = new Request("http://127.0.0.1/api/fable", {
    method: req.method || "GET",
    headers,
    body,
    duplex: body ? "half" : undefined,
  } as RequestInit);
  const out = await handleFable(request);
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  return {
    plugins: [react(), fablePlugin()],
    server: { port: 4664, proxy },
    preview: { port: 4664, proxy },
    test: {
      include: ["src/**/*.test.ts"],
      testTimeout: 30000,
    },
  };
});
