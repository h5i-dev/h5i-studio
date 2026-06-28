// h5i CLI bridge — runs the real `h5i` binary (read-only) against a target
// repository and normalises its output. All team data comes from `--json`;
// `msg` / `recall context` have no `--json` in the installed CLI, so we parse
// their human output. No mock data: every value below is produced by h5i.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mergeHistory, parseContext, parseRoster, stripAnsi } from "./parse.mjs";

const execFileP = promisify(execFile);

/** The repository h5i operates on. Override with H5I_REPO. */
export const REPO = process.env.H5I_REPO || process.cwd();
/** The h5i binary. Override with H5I_BIN. */
const H5I_BIN = process.env.H5I_BIN || "h5i";

const DEFAULT_TIMEOUT = 25_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export { stripAnsi };

/** Run h5i with raw args. Resolves with { ok, stdout, stderr, code }. */
async function run(args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileP(H5I_BIN, args, {
      cwd: REPO,
      timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, NO_COLOR: opts.color ? undefined : "1" },
    });
    return { ok: true, stdout, stderr };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(err?.message ?? err),
      code: typeof err.code === "number" ? err.code : 1,
    };
  }
}

export class H5iError extends Error {
  constructor(message, args) {
    super(message);
    this.name = "H5iError";
    this.command = `h5i ${args.join(" ")}`;
  }
}

/** Run h5i and JSON.parse stdout. Throws H5iError on failure. */
export async function json(args) {
  const r = await run(args);
  if (!r.ok) {
    const msg = (r.stderr || r.stdout || "").trim() || `exited ${r.code}`;
    throw new H5iError(cleanErr(msg), args);
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new H5iError(`could not parse JSON output`, args);
  }
}

/** Run h5i and return raw text. Never throws; reports ok=false instead. */
export async function text(args, opts = {}) {
  const r = await run(args, opts);
  return {
    ok: r.ok,
    text: r.ok ? r.stdout : r.stdout || "",
    error: r.ok ? null : cleanErr((r.stderr || r.stdout || "").trim()),
  };
}

function cleanErr(msg) {
  return msg
    .split("\n")
    .map((l) => l.replace(/^(Error:|error:)\s*/, "").trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 600);
}

// ── Identity / health ──────────────────────────────────────────────────────

export async function version() {
  const r = await run(["--version"]);
  return r.ok ? r.stdout.trim() : "unknown";
}

// ── team (structured JSON) ──────────────────────────────────────────────────

export const teamList = () => json(["team", "list", "--json"]);
export const teamStatus = (id) => json(["team", "status", id, "--json"]);
export const teamCompare = (id) => json(["team", "compare", id, "--json"]);

export async function teamArtifact(id, team, view) {
  const flag = view === "summary" ? "--summary" : view === "tests" ? "--tests" : "--diff";
  return json(["team", "artifact", "show", id, "--team", team, flag, "--json"]);
}

// ── msg (text → structured) ─────────────────────────────────────────────────

/**
 * Cross-agent radio. The installed CLI has no `--json`, so we run two views
 * and merge them by index: `--plain` gives a full ISO timestamp + body; the
 * default (coloured) view adds the message kind, thread id and routing
 * metadata. Returns newest-first.
 */
export async function messages(limit = 60) {
  const lim = String(Math.max(1, Math.min(500, limit | 0)));
  const [plainR, richR] = await Promise.all([
    text(["msg", "history", "--plain", "--limit", lim]),
    text(["msg", "history", "--limit", lim], { color: true }),
  ]);
  return mergeHistory(plainR.text, richR.text, plainR.ok, richR.ok);
}

/** The message-channel roster: who is on the radio + last-seen. */
export async function roster() {
  const r = await text(["msg", "team"]);
  return r.ok ? parseRoster(r.text) : [];
}

/** Project the shared reasoning workspace into a compact structured view. */
export async function context() {
  const r = await text(["recall", "context", "show", "--trace"]);
  if (!r.ok) return { available: false, error: r.error };
  return parseContext(r.text);
}
