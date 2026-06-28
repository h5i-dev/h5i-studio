// Unit tests for the CLI-text parsers. Fixtures are captured verbatim from the
// real `h5i` 0.2.x CLI, so these lock the contract the viewer depends on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeHistory,
  parseContext,
  parsePlainHistory,
  parseRichHistory,
  parseRoster,
  stripAnsi,
} from "../server/parse.mjs";

// ── stripAnsi ────────────────────────────────────────────────────────────────

test("stripAnsi removes SGR colour codes but keeps text", () => {
  assert.equal(stripAnsi("\x1b[1;32mGO\x1b[0m"), "GO");
  assert.equal(stripAnsi("plain"), "plain");
  assert.equal(stripAnsi("\x1b[38;5;213m●\x1b[0m nova"), "● nova");
});

// ── msg history (plain) ──────────────────────────────────────────────────────

const PLAIN = [
  "1\t2026-06-28T13:41:10.622540Z\thuman -> nova\t\tteam round complete — you may stop",
  "2\t2026-06-28T13:41:10.637384Z\thuman -> soren\t\tteam round complete — you may stop",
  "3\t2026-06-28T13:41:27.203203Z\thuman -> nova\t\tReview soren's submission. Artifact ids: sub-soren-r1-400545c19128.",
].join("\n");

test("parsePlainHistory extracts idx, ISO ts, route and body", () => {
  const rows = parsePlainHistory(PLAIN);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    idx: 1,
    ts: "2026-06-28T13:41:10.622540Z",
    from: "human",
    to: "nova",
    body: "team round complete — you may stop",
  });
  assert.equal(rows[2].to, "nova");
  assert.match(rows[2].body, /Review soren/);
});

test("parsePlainHistory ignores non-tab and header lines", () => {
  assert.deepEqual(parsePlainHistory("Message history\n\nnot a row"), []);
});

// ── msg history (rich/coloured) ──────────────────────────────────────────────

const RICH = [
  "Message history",
  "",
  "   1 13:41  human → nova  TEAM_DONE  #957281c946f67dda",
  "       team round complete — you may stop",
  "       branch implement-mvp",
  "   3 13:41  human → nova  REVIEW_REQUEST  #cc68f68de1548ce8",
  "       Review soren's team submission for demo-run.",
  "       branch implement-mvp  ·  focus sub-soren-r1-400545c19128  ·  granted diff,summary,tests",
].join("\n");

test("parseRichHistory captures kind, thread, branch, focus, granted", () => {
  const rows = parseRichHistory(RICH);
  assert.equal(rows.length, 2);

  assert.equal(rows[0].idx, 1);
  assert.equal(rows[0].kind, "TEAM_DONE");
  assert.equal(rows[0].thread, "957281c946f67dda");
  assert.equal(rows[0].branch, "implement-mvp");
  assert.equal(rows[0].body, "team round complete — you may stop");

  const rev = rows[1];
  assert.equal(rev.kind, "REVIEW_REQUEST");
  assert.equal(rev.focus, "sub-soren-r1-400545c19128");
  assert.equal(rev.granted, "diff,summary,tests");
  assert.match(rev.body, /Review soren's team submission/);
});

test("parseRichHistory tolerates ANSI colouring around the header", () => {
  const colored = "   2 13:41  \x1b[36mhuman\x1b[0m → soren  TEAM_DONE  #abc123";
  const rows = parseRichHistory(colored);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from, "human");
  assert.equal(rows[0].to, "soren");
});

// ── mergeHistory ─────────────────────────────────────────────────────────────

test("mergeHistory joins plain (ts/body) with rich (kind/thread) by index", () => {
  const merged = mergeHistory(PLAIN, RICH, true, true);
  assert.equal(merged.length, 3);
  // newest-first
  assert.equal(merged[0].idx, 3);
  // idx 1: kind comes from rich, ts/body from plain
  const one = merged.find((m) => m.idx === 1);
  assert.equal(one.kind, "TEAM_DONE");
  assert.equal(one.ts, "2026-06-28T13:41:10.622540Z");
  assert.equal(one.thread, "957281c946f67dda");
  // idx 2 has no rich entry → defaults to MSG, but plain still present
  const two = merged.find((m) => m.idx === 2);
  assert.equal(two.kind, "MSG");
  assert.equal(two.from, "human");
});

test("mergeHistory falls back to rich-only when plain failed", () => {
  const merged = mergeHistory("", RICH, false, true);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].idx, 3);
  assert.equal(merged.find((m) => m.idx === 1).kind, "TEAM_DONE");
});

test("mergeHistory returns [] when both views failed", () => {
  assert.deepEqual(mergeHistory("", "", false, false), []);
});

// ── roster ───────────────────────────────────────────────────────────────────

const ROSTER = [
  "Agents on this channel",
  "",
  "  ● human (you)   last seen 2026-06-28T13:41:43.330370Z",
  "  ● nova   last seen 2026-06-28T13:41:10.622540Z",
  "  ○ soren   last seen 2026-06-28T13:41:10.637384Z",
].join("\n");

test("parseRoster reads online flag, you-marker and last-seen", () => {
  const r = parseRoster(ROSTER);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], {
    online: true,
    name: "human",
    you: true,
    lastSeen: "2026-06-28T13:41:43.330370Z",
  });
  assert.equal(r[2].online, false);
  assert.equal(r[2].name, "soren");
  assert.equal(r[1].you, false);
});

test("parseRoster skips the heading line", () => {
  assert.equal(parseRoster(ROSTER).find((a) => a.name === "Agents"), undefined);
});

// ── context ──────────────────────────────────────────────────────────────────

const CONTEXT = [
  "── Context (depth=2) ────────────────────────────────────",
  "  Goal: Implement a cool full viewer for 'h5i team'  (branch: implement-mvp)",
  "  Git branch: implement-mvp  |  Context branch: implement-mvp",
  "",
  "  Milestones:",
  "    ✔ [x] Initial setup",
  "    ✔ [x] Mapped h5i team data contract empirically",
  "    ○ [ ] Build the viewer",
  "",
  "  Branches: env/human/alice  ·  env/human/bob  ·  * implement-mvp  ·  main",
  "",
  "  Recent Commits:",
  "    ◈ Confirmed JSON schemas for team list/status",
  "",
  "  Recent Trace:",
  "    [13:40:57] OBSERVE: read delivery.sh",
  "    [13:41:21] ACT: wrote team.rs",
].join("\n");

test("parseContext extracts goal, branches and section contents", () => {
  const c = parseContext(CONTEXT);
  assert.equal(c.available, true);
  assert.equal(c.goal, "Implement a cool full viewer for 'h5i team'");
  assert.equal(c.gitBranch, "implement-mvp");
  assert.equal(c.contextBranch, "implement-mvp");

  assert.equal(c.milestones.length, 3);
  assert.deepEqual(c.milestones[0], { done: true, text: "Initial setup" });
  assert.equal(c.milestones[2].done, false);

  assert.deepEqual(c.branches, ["env/human/alice", "env/human/bob", "* implement-mvp", "main"]);
  assert.equal(c.commits.length, 1);

  assert.equal(c.trace.length, 2);
  assert.deepEqual(c.trace[0], { time: "13:40:57", kind: "OBSERVE", text: "read delivery.sh" });
  assert.equal(c.trace[1].kind, "ACT");
});

test("parseContext is robust to an empty/garbage body", () => {
  const c = parseContext("nothing useful here");
  assert.equal(c.available, true);
  assert.equal(c.goal, null);
  assert.deepEqual(c.milestones, []);
  assert.deepEqual(c.trace, []);
});
