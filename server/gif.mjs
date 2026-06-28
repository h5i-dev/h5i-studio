// Replay → GIF exporter. Boots the viewer headlessly, drives Mission Replay
// beat by beat, screenshots the meeting room at each beat, and encodes an
// animated GIF (pure-JS, no ffmpeg). Playwright is loaded at runtime so it is
// not a hard install dependency of the package.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";
import gifenc from "gifenc";

const { PNG } = pngjs;
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadPlaywright() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch {
    const e = new Error(
      "GIF export needs Playwright + Chromium.\n" +
        "  Install it once:  npm i -D playwright && npx playwright install chromium",
    );
    e.code = "NO_PLAYWRIGHT";
    throw e;
  }
}

/** Locate an already-downloaded Chromium so we can avoid a re-download. */
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

const log = (msg) => process.stdout.write(`${msg}\n`);

/**
 * @param {object} opts
 * @param {string} opts.team          team/run id to replay
 * @param {string} opts.out           output .gif path
 * @param {boolean} [opts.demo]       use the bundled demo fleet
 * @param {string}  [opts.repo]       h5i repo (live mode)
 * @param {string}  [opts.bin]        h5i binary path
 * @param {number}  [opts.width]      viewport width (default 960)
 * @param {number}  [opts.height]     viewport height (default 600)
 * @param {number}  [opts.frameMs]    ms per beat in the GIF (default 1600)
 * @param {number}  [opts.settleMs]   ms to let a beat settle before capture (default 480)
 */
export async function exportReplayGif(opts) {
  const team = opts.team;
  if (!team) throw new Error("a team/run id is required (h5i-studio export <team>)");
  const out = resolve(opts.out || `${team}-replay.gif`);
  const width = Number(opts.width) || 960;
  const height = Number(opts.height) || 600;
  const frameMs = Number(opts.frameMs) || 1600;
  const settleMs = Number(opts.settleMs) || 480;

  // Data source for the embedded server.
  if (opts.repo) process.env.H5I_REPO = resolve(opts.repo);
  if (opts.bin) process.env.H5I_BIN = opts.bin;
  if (opts.demo) process.env.H5I_STUDIO_DEMO = "1";

  const distOk = existsSync(join(__dirname, "..", "dist", "index.html"));
  if (!distOk) throw new Error("frontend bundle missing — run `npm run build` first");

  const chromium = await loadPlaywright();
  const { startServer } = await import("./index.mjs");

  log(`  ▟▙ exporting replay of "${team}" → ${out}`);
  const srv = await startServer({ port: 0, host: "127.0.0.1", demo: opts.demo });
  let browser;
  try {
    browser = await chromium.launch().catch(async () => {
      const exe = findChromium();
      if (!exe) throw new Error("no Chromium found — run `npx playwright install chromium`");
      return chromium.launch({ executablePath: exe });
    });
    const page = await browser.newPage({ viewport: { width, height } });

    await page.goto(`${srv.url}/#/${encodeURIComponent(team)}`, { waitUntil: "domcontentloaded" });
    // Surface a clean error if the team has no replayable timeline.
    const toggle = await page.waitForSelector(".replay-toggle", { timeout: 15000 }).catch(() => null);
    if (!toggle) throw new Error(`no replayable timeline for team "${team}" (does it exist and have events?)`);

    await page.waitForSelector(".bridge.room");
    await page.waitForTimeout(700);

    // Engage replay (button lives in the header), then pause to seek by hand.
    await page.click(".replay-toggle");
    await page.waitForSelector(".replaybar");
    await page.$$eval(".rb-btn.play", (els) => els[0]?.click());

    const total = await page.$$eval(".rb-tick", (els) => els.length);
    if (total === 0) throw new Error("replay timeline is empty");
    log(`  ${total} beats · ${width}×${height} · ${frameMs}ms/beat`);

    // Pin the room to fill the whole viewport and hide the chrome, so each frame
    // is the clean meeting room at exactly width×height. The scrubber stays in
    // the DOM (off-screen) so we can still seek by clicking its ticks via JS.
    await page.addStyleTag({
      content: `
        .topbar, .deck-head, .deck-grid, .bridge-focus { display: none !important; }
        .replaybar { position: fixed !important; left: -10000px !important; top: 0 !important; }
        .app .scroll { overflow: hidden !important; }
        .bridge { position: fixed !important; inset: 0 !important; margin: 0 !important;
                  height: 100vh !important; min-height: 0 !important; border: 0 !important;
                  border-radius: 0 !important; }
        .bridge::before, .bridge::after { display: none !important; }
      `,
    });
    await page.waitForTimeout(300);

    const gif = GIFEncoder();
    let frames = 0;

    const capture = async (delay) => {
      const buf = await page.screenshot();
      const png = PNG.sync.read(buf);
      const data = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, png.width, png.height, { palette, delay });
      frames++;
    };

    // Frame 0: mission start (cursor at 0).
    await page.$$eval(".rb-btn", (els) => els[0]?.click()); // ⏮ to start
    await page.waitForTimeout(settleMs);
    await capture(Math.round(frameMs * 0.7));

    // One frame per beat.
    for (let i = 0; i < total; i++) {
      await page.$$eval(".rb-tick", (els, idx) => els[idx]?.click(), i);
      await page.waitForTimeout(settleMs);
      // Hold a little longer on the final (verdict) beat.
      await capture(i === total - 1 ? frameMs * 2 : frameMs);
      if ((i + 1) % 5 === 0 || i === total - 1) log(`  …${i + 1}/${total} beats captured`);
    }

    gif.finish();
    const bytes = gif.bytes();
    writeFileSync(out, bytes);

    const kb = (bytes.length / 1024).toFixed(0);
    log(`  ✔ wrote ${out}  (${width}×${height}, ${frames} frames, ${kb} KB)`);
    return { out, frames, width, height, bytes: bytes.length };
  } finally {
    await browser?.close().catch(() => {});
    srv.server.close();
  }
}
