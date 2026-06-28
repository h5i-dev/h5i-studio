import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Connect, ViteDevServer } from "vite";
import express from "express";
// The API router is plain ESM JS shared between the dev middleware and the
// standalone production server (server/index.mjs). One source of truth.
import { createApiRouter } from "./server/api.mjs";

/**
 * Dev-only plugin: mount the real Express API as Vite middleware so `npm run
 * dev` serves live `h5i` data (no mock) with HMR in a single process. We mount
 * a full Express *app* (not a bare Router) because Vite's middleware stack is
 * Connect — only the Express app augments req/res with `.json()` / `.status()`.
 */
function h5iApiPlugin() {
  return {
    name: "h5i-api-middleware",
    configureServer(server: ViteDevServer) {
      const app = express();
      app.use("/api", createApiRouter());
      server.middlewares.use(app as unknown as Connect.NextHandleFunction);
    },
  };
}

export default defineConfig({
  plugins: [react(), h5iApiPlugin()],
  server: {
    port: 5180,
    strictPort: false,
  },
});
