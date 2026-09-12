import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import webConfig from "./vite.config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "part-ext-index",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split("?")[0];
          if (path === "/registry.json") {
            res.setHeader("content-type", "application/json");
            createReadStream(resolve(root, "public/registry.json")).pipe(res);
            return;
          }
          if (req.url === "/" || req.url === "/index.html") req.url = "/popup.html";
          next();
        });
      },
    },
    {
      name: "part-ext-manifest",
      closeBundle() {
        const out = resolve(root, "dist-ext");
        mkdirSync(out, { recursive: true });
        cpSync(resolve(root, "extension/manifest.json"), resolve(out, "manifest.json"));
        mkdirSync(resolve(out, "icons"), { recursive: true });
        for (const size of ["16", "32", "48", "128"]) {
          cpSync(resolve(root, `extension/icons/${size}.png`), resolve(out, `icons/${size}.png`));
        }
        cpSync(resolve(root, "public/registry.json"), resolve(out, "registry.json"));
      },
    },
  ],
  base: "./",
  publicDir: false,
  define: {
    "import.meta.env.VITE_PART_SHELL": JSON.stringify("ext"),
  },
  server: {
    port: 4666,
    proxy: webConfig.server?.proxy,
  },
  preview: {
    port: 4666,
    proxy: webConfig.preview?.proxy,
  },
  build: {
    outDir: "dist-ext",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, "popup.html"),
      },
    },
  },
});
