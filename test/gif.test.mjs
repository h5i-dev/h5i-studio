// Integration test for the replay → GIF exporter. Drives the bundled demo
// fleet headlessly and asserts a valid, non-trivial animated GIF is produced.
// Self-guarding: skips when the bundle is not built, Playwright is missing, or
// no Chromium can be located.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, rmSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let reason = null;
try {
  await import("playwright");
} catch {
  reason = "playwright not installed";
}
if (!reason && !existsSync(join(ROOT, "dist", "index.html"))) reason = "dist not built";
if (!reason && !findChromium()) reason = "no chromium binary";

function findChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(process.env.HOME || "", ".cache", "ms-playwright")].filter(Boolean);
  for (const r of roots) {
    if (!existsSync(r)) continue;
    for (const d of readdirSync(r)) {
      if (d.startsWith("chromium-") && existsSync(join(r, d, "chrome-linux", "chrome"))) return true;
    }
  }
  return false;
}

const out = join(tmpdir(), `h5i-studio-test-${process.pid}.gif`);
after(() => {
  try {
    rmSync(out, { force: true });
  } catch {
    /* ignore */
  }
});

test("exports a team replay to a valid animated GIF", { timeout: 90_000 }, async (t) => {
  if (reason) return t.skip(reason);
  const { exportReplayGif } = await import("../server/gif.mjs");

  const res = await exportReplayGif({
    team: "nebula-auth",
    demo: true,
    out,
    width: 480,
    height: 300,
    frameMs: 200,
    settleMs: 120,
  });

  assert.ok(existsSync(out), "gif file written");
  assert.equal(res.width, 480);
  assert.equal(res.height, 300);
  assert.ok(res.frames >= 10, `expected many frames, got ${res.frames}`);

  // GIF89a magic header + non-trivial size.
  const head = readFileSync(out).subarray(0, 6).toString("latin1");
  assert.equal(head, "GIF89a", "valid GIF header");
  assert.ok(statSync(out).size > 5000, "non-trivial gif size");
});

test("a non-existent team fails cleanly", { timeout: 30_000 }, async (t) => {
  if (reason) return t.skip(reason);
  const { exportReplayGif } = await import("../server/gif.mjs");
  await assert.rejects(
    () => exportReplayGif({ team: "no-such-team", demo: true, out, width: 400, height: 260, settleMs: 80 }),
    /no replayable timeline|no team|does it exist/i,
  );
});
