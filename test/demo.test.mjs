// Tests for the bundled demo fleet. It must satisfy the same data contract as
// the live source so the same router + derive() run unchanged, and it must be
// fully self-contained (no h5i, no repo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSource } from "../server/demo.mjs";
import { derive } from "../server/derive.mjs";

const src = createDemoSource();

test("meta advertises demo mode", async () => {
  const m = await src.meta();
  assert.match(m.repo, /demo/);
  assert.match(m.version, /demo/);
});

test("teamList returns the three-mission fleet with valid shapes", async () => {
  const teams = await src.teamList();
  assert.equal(teams.length, 3);
  const ids = teams.map((t) => t.id).sort();
  assert.deepEqual(ids, ["nebula-auth", "orbit-cache", "pulsar-migrate"]);
  for (const t of teams) {
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(Array.isArray(t.agents) && t.agents.length > 0);
    assert.ok(typeof t.phase === "string");
    assert.ok(/^[0-9a-f]{40}$/.test(t.base_oid), "base_oid is a 40-char hex oid");
  }
});

test("the hero mission folds (via derive) to a clean GO verdict", async () => {
  const { run, events } = await src.teamStatus("nebula-auth");
  assert.equal(run.phase, "verdict");
  assert.equal(run.agents.length, 3);
  assert.equal(run.submissions.length, 3);
  assert.equal(run.verifications.length, 3);

  const d = derive(run, events);
  assert.ok(d.verdict, "verdict derived from events");
  assert.equal(d.verdict.selected_submission, "sub-atlas-r1-b20c5af7");
  assert.equal(d.verdict.can_auto_apply, true);
  assert.equal(d.reviews.length, 2);
  assert.equal(d.grants.length, 2);
  assert.equal(d.discussions.length, 1);

  // Winner must be a verifier-passing candidate.
  const winnerVer = run.verifications.find((v) => v.submission_id === d.verdict.selected_submission);
  assert.equal(winnerVer.tests_passed, true);
});

test("event timeline is chronologically ordered and richly populated", async () => {
  const { events } = await src.teamStatus("nebula-auth");
  assert.equal(events.length, 17);
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i - 1].ts <= events[i].ts, "events are time-ordered for replay");
  }
  const kinds = new Set(events.map((e) => e.kind));
  for (const k of ["created", "agent_added", "submitted", "frozen", "verified", "review_submitted", "verdict"]) {
    assert.ok(kinds.has(k), `timeline includes ${k}`);
  }
});

test("a stalled mission folds to a NO-GO (no_verdict)", async () => {
  const { run, events } = await src.teamStatus("pulsar-migrate");
  assert.equal(run.phase, "no_verdict");
  const d = derive(run, events);
  assert.equal(d.verdict.selected_submission, null);
  assert.equal(d.verdict.resolved, false);
  assert.ok(run.verifications.every((v) => !v.tests_passed));
});

test("compare yields one row per agent with submission stats", async () => {
  const rows = await src.teamCompare("nebula-auth");
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.ok(typeof r.agent_id === "string");
    assert.equal(r.submitted, true);
    assert.ok(r.files_changed >= 1);
  }
});

test("artifact diff resolves real unified-diff text", async () => {
  const a = await src.teamArtifact("sub-atlas-r1-b20c5af7", "nebula-auth", "diff");
  assert.equal(a.owner_agent, "atlas");
  assert.match(a.diff, /diff --git/);
  assert.ok(a.files_changed >= 1);

  const s = await src.teamArtifact("sub-atlas-r1-b20c5af7", "nebula-auth", "summary");
  assert.ok(s.summary && s.summary.length > 0);
});

test("messages are newest-first and roster/context are populated", async () => {
  const msgs = await src.messages(50);
  assert.ok(msgs.length > 0);
  for (let i = 1; i < msgs.length; i++) assert.ok(msgs[i - 1].idx >= msgs[i].idx);

  const roster = await src.roster();
  assert.ok(roster.some((a) => a.you));

  const ctx = await src.context();
  assert.equal(ctx.available, true);
  assert.ok(ctx.goal && ctx.milestones.length > 0 && ctx.trace.length > 0);
});

test("unknown team raises an H5iError (→ 422 at the API)", async () => {
  await assert.rejects(() => src.teamStatus("does-not-exist"), (e) => e.name === "H5iError");
});
