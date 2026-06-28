// End-to-end browser test. Serves the built SPA + the bundled DEMO fleet (so it
// is deterministic and needs no live h5i) and drives a real Chromium via
// Playwright. Asserts the deck renders, the diff modal opens, and Mission Replay
// reconstructs earlier state. Self-guarding: skips cleanly when the bundle is
// not built, Playwright is not installed, or no Chromium binary can be located.
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
  app.use("/api", createApiRouter({ demo: true })); // bundled fleet → deterministic
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

const newPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors };
};

test("the console boots: command bar, DEMO badge, full-viewport starfield", async (t) => {
  if (reason) return t.skip(reason);
  const { page, errors } = await newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".topbar");
  await page.waitForTimeout(800);

  assert.match(await page.textContent(".brand .wordmark"), /FLEET COMMAND/);
  assert.ok(await page.$(".demo-badge"), "DEMO badge present in demo mode");
  const w = await page.$eval("#starfield", (c) => c.clientWidth);
  assert.ok(w > 800, `starfield should fill viewport, got ${w}px`);
  // The bundled fleet has three operations.
  await page.waitForSelector(".mission-card");
  assert.equal((await page.$$(".mission-card")).length, 3);

  assert.deepEqual(errors, []);
  await page.close();
});

test("opening the hero mission renders every deck panel + diff modal", async (t) => {
  if (reason) return t.skip(reason);
  const { page, errors } = await newPage();
  await page.goto(`${base}/#/nebula-auth`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".deck-grid");
  await page.waitForTimeout(600);

  const heads = await page.$$eval(".panel-head h3", (els) => els.map((e) => e.textContent));
  for (const want of ["Candidates", "Launch Authority", "Squadron", "Flight Recorder", "Comms Channel"]) {
    assert.ok(heads.includes(want), `expected panel "${want}", saw ${JSON.stringify(heads)}`);
  }
  // Live state: atlas is the selected winner → GO.
  assert.ok(await page.$(".gng-lamp.go"), "live verdict shows GO");
  assert.ok((await page.$$(".phaserail .node")).length >= 5);

  // Flight plan opens a real diff.
  await page.$eval(".cand .btn.ghost", (el) => el.click());
  await page.waitForSelector(".modal .diff");
  assert.match(await page.textContent(".modal .panel-head h3"), /FLIGHT PLAN/);
  assert.match(await page.textContent(".modal .diff"), /diff --git/);
  await page.keyboard.press("Escape");

  assert.deepEqual(errors, []);
  await page.close();
});

test("Mission Replay reconstructs earlier state, then returns to live", async (t) => {
  if (reason) return t.skip(reason);
  const { page, errors } = await newPage();
  await page.goto(`${base}/#/nebula-auth`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".deck-grid");
  await page.waitForTimeout(600);

  // Engage replay (el.click bypasses Playwright actionability vs. the polling re-render).
  await page.$eval(".replay-toggle", (el) => el.click());
  await page.waitForSelector(".replaybar");

  // Seek to event 8 (the "frozen" tick) — a real onClick on the timeline.
  await page.$$eval(".rb-tick", (els) => els[7].click());
  await page.waitForTimeout(400);

  assert.match((await page.textContent(".rb-count")).trim(), /^8 \/ 17/);
  // At event 8 the round is sealed but not yet verified → phase SEALED, verdict pending.
  const curPhase = await page.$$eval(".deck-head .phaserail .node.current .lbl", (e) => e.map((x) => x.textContent));
  assert.ok(curPhase.includes("SEALED"), `expected SEALED at cursor 8, saw ${JSON.stringify(curPhase)}`);
  assert.ok(!(await page.$(".gng-lamp.go")), "no GO verdict mid-mission");
  assert.ok(await page.$(".gng-lamp.nogo"), "Launch Authority is NO-GO before verification");
  // Flight recorder shows only the revealed events.
  const logRows = (await page.$$(".log .log-row")).length;
  assert.equal(logRows, 8, "recorder shows exactly the 8 revealed events");

  // Exit replay → back to the live GO state.
  await page.$eval(".rb-exit", (el) => el.click());
  await page.waitForTimeout(300);
  assert.ok(!(await page.$(".replaybar")), "replay bar dismissed");
  assert.ok(await page.$(".gng-lamp.go"), "live GO restored after exit");

  assert.deepEqual(errors, []);
  await page.close();
});
