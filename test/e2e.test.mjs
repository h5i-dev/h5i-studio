// End-to-end browser test. Serves the built SPA + live API and drives a real
// Chromium via Playwright, asserting the deck renders from live h5i data with
// no runtime errors. Self-guarding: skips cleanly when the bundle is not built,
// Playwright is not installed, or no Chromium binary can be located — so it is
// safe inside `npm test` on any machine while giving true coverage where it can.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiRouter } from "../server/api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

let chromium = null;
let reason = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  reason = "playwright not installed";
}
if (!reason && !existsSync(join(DIST, "index.html"))) reason = "dist not built (run npm run build)";

function findChromium() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(process.env.HOME || "", ".cache", "ms-playwright"),
  ].filter(Boolean);
  for (const r of roots) {
    if (!existsSync(r)) continue;
    for (const d of readdirSync(r)) {
      if (!d.startsWith("chromium-")) continue;
      const exe = join(r, d, "chrome-linux", "chrome");
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

let server;
let base;
let browser;

before(async () => {
  if (reason) return;
  const app = express();
  app.use("/api", createApiRouter());
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(DIST, "index.html")));
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  base = `http://127.0.0.1:${server.address().port}`;

  const launch = async (opts) => (browser = await chromium.launch(opts));
  try {
    await launch({});
  } catch {
    const exe = findChromium();
    if (!exe) {
      reason = "no chromium binary";
      return;
    }
    try {
      await launch({ executablePath: exe });
    } catch (e) {
      reason = `chromium launch failed: ${e.message}`;
    }
  }
});

after(async () => {
  await browser?.close();
  server?.close();
});

test("the console boots and renders the command bar with no runtime errors", async (t) => {
  if (reason) return t.skip(reason);
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector(".topbar");

  const brand = await page.textContent(".brand .wordmark");
  assert.match(brand, /FLEET COMMAND/);
  // Starfield canvas must stretch to the viewport (regression guard).
  const w = await page.$eval("#starfield", (c) => c.clientWidth);
  assert.ok(w > 800, `starfield should fill viewport, got ${w}px`);

  assert.deepEqual(errors, [], "no uncaught page errors");
  await page.close();
});

test("opening a mission renders the deck panels from live data", async (t) => {
  if (reason) return t.skip(reason);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });

  const card = await page.$(".mission-card");
  if (!card) {
    await page.close();
    return t.skip("no team runs present to open");
  }

  await card.click();
  await page.waitForSelector(".deck-grid");

  // Core deck panels must be present.
  const heads = await page.$$eval(".panel-head h3", (els) => els.map((e) => e.textContent));
  for (const want of ["Squadron", "Candidates", "Launch Authority", "Flight Recorder"]) {
    assert.ok(heads.includes(want), `expected panel "${want}", saw ${JSON.stringify(heads)}`);
  }
  // The phase rail renders its ladder nodes.
  const nodes = await page.$$(".phaserail .node");
  assert.ok(nodes.length >= 5, "phase rail has nodes");

  // If a sealed candidate exists, its flight plan opens a diff modal.
  const fp = await page.$(".cand .btn.ghost");
  if (fp) {
    await fp.click();
    await page.waitForSelector(".modal .diff, .modal .summary-box");
    const title = await page.textContent(".modal .panel-head h3");
    assert.match(title, /FLIGHT PLAN/);
    await page.keyboard.press("Escape");
  }

  assert.deepEqual(errors, [], "no uncaught page errors on the deck");
  await page.close();
});
