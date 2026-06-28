// HTTP server: serves the built SPA (dist/) and the live read-only h5i API on
// one port. Importable as `startServer()` (used by bin/h5i-studio.mjs) and also
// runnable directly: `node server/index.mjs`.

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createApiRouter } from "./api.mjs";
import { REPO, version } from "./h5i.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

/**
 * Build and start the Fleet Command server.
 * @param {{port?:number, host?:string}} [opts]
 * @returns {Promise<{server:import('node:http').Server, url:string, port:number, host:string, repo:string, hasDist:boolean}>}
 */
export function startServer(opts = {}) {
  const port = Number(opts.port ?? process.env.PORT ?? 8787);
  const host = opts.host ?? process.env.HOST ?? "127.0.0.1";
  const hasDist = existsSync(join(DIST, "index.html"));

  const app = express();
  app.disable("x-powered-by");
  app.use("/api", createApiRouter());

  if (hasDist) {
    app.use(express.static(DIST));
    // SPA fallback — anything not under /api serves index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(DIST, "index.html")));
  } else {
    app.get(/^(?!\/api\/).*/, (_req, res) =>
      res
        .status(503)
        .type("text/plain")
        .send(
          "Frontend bundle not found. From source run `npm run build` first, " +
            "or install the published package.\nThe API is live at /api/health.",
        ),
    );
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    server.once("listening", () => {
      const displayHost = host === "0.0.0.0" ? "localhost" : host;
      resolve({
        server,
        url: `http://${displayHost}:${port}`,
        port,
        host,
        repo: REPO,
        hasDist,
      });
    });
    server.once("error", reject);
  });
}

/** True when this module was executed directly (not imported). */
function isMain() {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isMain()) {
  startServer()
    .then(async ({ url, repo, hasDist }) => {
      const ver = await version();
      console.log(`\n  ▟▙ H5I FLEET COMMAND`);
      console.log(`  ──────────────────────────────────────────`);
      console.log(`  console : ${url}${hasDist ? "" : "   (bundle missing — run npm run build)"}`);
      console.log(`  api     : ${url}/api/health`);
      console.log(`  repo    : ${repo}`);
      console.log(`  h5i     : ${ver}`);
      console.log(`  ──────────────────────────────────────────\n`);
    })
    .catch((err) => {
      console.error(`\n  ✕ failed to start: ${err?.message ?? err}\n`);
      process.exit(1);
    });
}
