// Unit tests for the event-log projection. Event fixtures mirror the real
// `team status --json` payloads captured from the CLI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derive } from "../server/derive.mjs";

const ev = (kind, payload, extra = {}) => ({
  id: `e-${kind}-${Math.abs(hash(kind + JSON.stringify(payload)))}`,
  ts: extra.ts || "2026-06-28T13:41:00.000000Z",
  actor: "human",
  kind,
  run_id: "demo-run",
  round: 1,
  payload,
  ...extra,
});

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const EVENTS = [
  ev("created", { name: "Refactor auth", base_oid: "cd93b95", max_rounds: 2 }),
  ev("agent_added", { agent_id: "soren", env_id: "env/human/alice", isolation_claim: "supervised" }),
  ev("agent_added", { agent_id: "nova", env_id: "env/human/bob", isolation_claim: "supervised" }),
  ev("submitted", { owner_agent: "soren", id: "sub-soren-r1-400545c19128" }),
  ev("submitted", { owner_agent: "nova", id: "sub-nova-r1-45e3a361ccc1" }),
  ev("frozen", { missing_agents: [] }),
  ev(
    "no_verdict",
    { selected_submission: null, method: "rule:Tests", decided_by: "team-policy", can_auto_apply: false, reasons: ["no candidate has passing verifier evidence"] },
    { ts: "2026-06-28T13:41:10.000000Z" },
  ),
  ev("verified", { owner_agent: "soren", submission_id: "sub-soren-r1-400545c19128", tests_passed: true, applies_cleanly: true }),
  ev(
    "review_granted",
    { reviewer: "nova", target: "soren", artifact_kinds: ["diff", "summary", "tests"], artifact_ids: ["sub-soren-r1-400545c19128"] },
    { ts: "2026-06-28T13:41:20.000000Z" },
  ),
  ev(
    "review_submitted",
    { reviewer: "nova", target: "soren", body: "Solid approach, but missing error handling.\n", referenced_artifacts: ["sub-soren-r1-400545c19128"] },
    { ts: "2026-06-28T13:41:25.000000Z" },
  ),
  ev(
    "verdict",
    { selected_submission: "sub-soren-r1-400545c19128", method: "rule:VerifierTestsPass,AppliesCleanly,SmallestDiff", decided_by: "team-policy", can_auto_apply: true, reasons: ["applies cleanly", "tests passed", "smallest diff"] },
    { ts: "2026-06-28T13:41:30.000000Z" },
  ),
];

test("derive picks the latest verdict (verdict overrides earlier no_verdict)", () => {
  const d = derive({}, EVENTS);
  assert.ok(d.verdict);
  assert.equal(d.verdict.selected_submission, "sub-soren-r1-400545c19128");
  assert.equal(d.verdict.can_auto_apply, true);
  assert.equal(d.verdict.resolved, true);
  assert.equal(d.verdict.reasons.length, 3);
});

test("derive surfaces no_verdict as unresolved when it is the last decision", () => {
  const upTo = EVENTS.slice(0, 7); // ends at no_verdict
  const d = derive({}, upTo);
  assert.equal(d.verdict.selected_submission, null);
  assert.equal(d.verdict.resolved, false);
  assert.equal(d.verdict.can_auto_apply, false);
});

test("derive collects peer reviews with trimmed body and artifacts", () => {
  const d = derive({}, EVENTS);
  assert.equal(d.reviews.length, 1);
  assert.deepEqual(
    { reviewer: d.reviews[0].reviewer, target: d.reviews[0].target, body: d.reviews[0].body },
    { reviewer: "nova", target: "soren", body: "Solid approach, but missing error handling." },
  );
  assert.deepEqual(d.reviews[0].artifacts, ["sub-soren-r1-400545c19128"]);
});

test("derive collects review grants with kinds + artifact ids", () => {
  const d = derive({}, EVENTS);
  assert.equal(d.grants.length, 1);
  assert.equal(d.grants[0].reviewer, "nova");
  assert.deepEqual(d.grants[0].kinds, ["diff", "summary", "tests"]);
  assert.deepEqual(d.grants[0].artifacts, ["sub-soren-r1-400545c19128"]);
});

test("derive understands discussion events (from/to/body)", () => {
  const withDiscuss = [
    ...EVENTS,
    ev("discussion", { from: "soren", to: ["nova"], body: "I'll fold in your suggestion.", referenced_artifacts: [] }, { ts: "2026-06-28T13:42:00.000000Z" }),
  ];
  const d = derive({}, withDiscuss);
  assert.equal(d.discussions.length, 1);
  assert.equal(d.discussions[0].from, "soren");
  assert.deepEqual(d.discussions[0].to, ["nova"]);
});

test("derive prefers run.verdict when no verdict event exists", () => {
  const preset = { verdict: { selected_submission: "x", method: "preset", decided_by: "host", can_auto_apply: false, reasons: [] } };
  const d = derive(preset, EVENTS.slice(0, 6)); // no verdict/no_verdict events
  assert.equal(d.verdict.selected_submission, "x");
});

test("derive is total over empty / missing inputs", () => {
  assert.deepEqual(derive({}, []), { verdict: null, reviews: [], grants: [], discussions: [] });
  assert.deepEqual(derive(null, undefined), { verdict: null, reviews: [], grants: [], discussions: [] });
});

test("derive ignores unrelated event kinds without throwing", () => {
  const d = derive({}, [ev("created", {}), ev("agent_added", {}), ev("frozen", { missing_agents: [] })]);
  assert.equal(d.reviews.length, 0);
  assert.equal(d.verdict, null);
});
