import { defineConfig, type ProxyOptions } from "vitest/config";
import react from "@vitejs/plugin-react";

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

const proxy: Record<string, ProxyOptions> = {
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

export default defineConfig({
  plugins: [react()],
  server: { port: 4664, proxy },
  preview: { port: 4664, proxy },
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
  },
});
