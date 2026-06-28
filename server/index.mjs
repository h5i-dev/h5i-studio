// Standalone production server: serves the built SPA (dist/) and the live
// read-only h5i API on one port. Run `npm run build` first, then `npm run serve`.
//
//   H5I_REPO=/path/to/repo PORT=8787 npm run serve

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createApiRouter } from "./api.mjs";
import { REPO, version } from "./h5i.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.disable("x-powered-by");
app.use("/api", createApiRouter());

if (existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback — anything not under /api serves index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(DIST, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res
      .status(503)
      .type("text/plain")
      .send("Frontend not built yet. Run `npm run build`, then `npm run serve`.\nAPI is live at /api/health."),
  );
}

app.listen(PORT, HOST, async () => {
  const ver = await version();
  console.log(`\n  ▟▙ H5I FLEET COMMAND`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  console : http://${HOST}:${PORT}`);
  console.log(`  api     : http://${HOST}:${PORT}/api/health`);
  console.log(`  repo    : ${REPO}`);
  console.log(`  h5i     : ${ver}`);
  console.log(`  ──────────────────────────────────────────\n`);
});
