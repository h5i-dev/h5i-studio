#!/usr/bin/env node
// H5I Fleet Command — CLI launcher.
// Serves the bundled viewer + live read-only h5i API against a target repo.
//
//   npx @h5i/studio                  # current directory
//   npx @h5i/studio --repo ../proj   # another repo
//   npx @h5i/studio --port 9000 --no-open

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

// ── `export` / `gif` subcommand: render a team's replay to an animated GIF ───
if (process.argv[2] === "export" || process.argv[2] === "gif") {
  await runExport(process.argv.slice(3));
  process.exit(0);
}

async function runExport(argv) {
  const opts = { team: undefined, out: undefined, width: undefined, height: undefined, frameMs: undefined, repo: undefined, bin: undefined, demo: false };
  const want = (i, name) => {
    const v = argv[i + 1];
    if (v === undefined) fail(`option ${name} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        return exportHelp();
      case "-o":
      case "--out":
        opts.out = want(i++, a);
        break;
      case "--width":
        opts.width = Number(want(i++, a));
        break;
      case "--height":
        opts.height = Number(want(i++, a));
        break;
      case "--frame-ms":
        opts.frameMs = Number(want(i++, a));
        break;
      case "--settle-ms":
        opts.settleMs = Number(want(i++, a));
        break;
      case "-r":
      case "--repo":
        opts.repo = want(i++, a);
        break;
      case "--bin":
        opts.bin = want(i++, a);
        break;
      case "--demo":
        opts.demo = true;
        break;
      default:
        if (a.startsWith("-")) fail(`unknown option: ${a}`);
        else if (!opts.team) opts.team = a;
        else fail(`unexpected argument: ${a}`);
    }
  }
  if (!opts.team) fail("export needs a team id: h5i-studio export <team> [--out file.gif]");

  const { exportReplayGif } = await import("../server/gif.mjs");
  try {
    await exportReplayGif(opts);
  } catch (err) {
    console.error(`\n  ✕ ${err?.message ?? err}\n`);
    process.exit(1);
  }
}

function exportHelp() {
  console.log(`
  ▟▙  H5I FLEET COMMAND  ·  export

  Render a team operation's Mission Replay to an animated GIF.

  USAGE
    h5i-studio export <team> [options]

  OPTIONS
    -o, --out <path>     output file            (default: <team>-replay.gif)
        --width <n>      viewport width         (default: 960)
        --height <n>     viewport height        (default: 600)
        --frame-ms <n>   ms per beat in the GIF (default: 1600)
    -r, --repo <path>    h5i repository         (default: cwd)
        --bin <path>     path to the h5i binary
        --demo           export from the bundled demo fleet
    -h, --help           show this help

  EXAMPLES
    h5i-studio export demo-run -o run.gif
    h5i-studio export --demo nebula-auth
    h5i-studio export my-run -r ../project --width 1200

  Needs Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
`);
}

function parseArgs(argv) {
  const opts = { port: undefined, host: undefined, repo: undefined, bin: undefined, open: true, demo: false };
  const want = (i, name) => {
    const v = argv[i + 1];
    if (v === undefined) fail(`option ${name} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        return { ...opts, help: true };
      case "-v":
      case "--version":
        return { ...opts, showVersion: true };
      case "-p":
      case "--port":
        opts.port = Number(want(i++, a));
        break;
      case "--host":
        opts.host = want(i++, a);
        break;
      case "-r":
      case "--repo":
        opts.repo = want(i++, a);
        break;
      case "--bin":
        opts.bin = want(i++, a);
        break;
      case "--open":
        opts.open = true;
        break;
      case "--no-open":
        opts.open = false;
        break;
      case "--demo":
        opts.demo = true;
        break;
      default:
        if (a.startsWith("-")) fail(`unknown option: ${a}`);
    }
  }
  return opts;
}

function fail(msg) {
  console.error(`h5i-studio: ${msg}\nTry 'h5i-studio --help'.`);
  process.exit(2);
}

function help() {
  console.log(`
  ▟▙  H5I FLEET COMMAND  ·  ${pkg.version}
  ${pkg.description}

  USAGE
    h5i-studio [options]

  OPTIONS
    -r, --repo <path>    h5i repository to view        (default: cwd)
    -p, --port <n>       port to listen on             (default: 8787)
        --host <host>    host/interface to bind        (default: 127.0.0.1)
        --bin <path>     path to the h5i binary        (default: h5i on PATH)
        --demo           serve a bundled demo fleet (no h5i / repo needed)
        --no-open        do not open the browser
    -h, --help           show this help
    -v, --version        show version

  SUBCOMMANDS
    export <team>                    render a team's replay to an animated GIF
                                     (h5i-studio export --help)

  EXAMPLES
    h5i-studio                       view the repo in the current directory
    h5i-studio --demo                explore a bundled demo fleet + replay
    h5i-studio -r ../my-project      view another repo
    h5i-studio -p 9000 --no-open     custom port, no auto-open
    h5i-studio export my-run -o run.gif   replay → GIF

  Requires the 'h5i' binary on PATH (override with --bin or H5I_BIN),
  except in --demo mode, which needs nothing.
`);
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* best-effort; the URL is printed regardless */
  }
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help) {
  help();
  process.exit(0);
}
if (opts.showVersion) {
  console.log(pkg.version);
  process.exit(0);
}

// The h5i bridge reads these from the environment at import time, so set them
// *before* dynamically importing the server.
if (opts.repo) process.env.H5I_REPO = resolve(opts.repo);
if (opts.bin) process.env.H5I_BIN = opts.bin;
if (opts.port) process.env.PORT = String(opts.port);
if (opts.host) process.env.HOST = opts.host;
if (opts.demo) process.env.H5I_STUDIO_DEMO = "1";

const { startServer } = await import("../server/index.mjs");
const { version } = await import("../server/h5i.mjs");

try {
  const info = await startServer({ port: opts.port, host: opts.host, demo: opts.demo });
  const ver = opts.demo ? "demo (bundled)" : await version();
  console.log(`\n  ▟▙ H5I FLEET COMMAND  ·  ${pkg.version}${opts.demo ? "  · DEMO" : ""}`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  console : ${info.url}`);
  console.log(`  repo    : ${info.repo}`);
  console.log(`  h5i     : ${ver}`);
  if (!info.hasDist) console.log(`  ⚠ bundle missing — reinstall the package or run 'npm run build'`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  ⌁ uplink live — Ctrl+C to disengage\n`);

  if (!opts.demo && ver === "unknown") {
    console.log(`  ⚠ could not run 'h5i' — is it installed and on PATH? (override with --bin)`);
    console.log(`    try 'h5i-studio --demo' to explore a bundled fleet instead.\n`);
  }
  if (opts.open && info.hasDist) openBrowser(info.url);
} catch (err) {
  if (err && err.code === "EADDRINUSE") {
    fail(`port ${opts.port ?? process.env.PORT ?? 8787} is already in use — pass --port <n>`);
  }
  console.error(`\n  ✕ failed to start: ${err?.message ?? err}\n`);
  process.exit(1);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("\n  ⌁ uplink closed.\n");
    process.exit(0);
  });
}
