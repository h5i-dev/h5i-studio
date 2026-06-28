// Bundled demo fleet — a fully-formed, h5i-faithful dataset so `--demo` shows a
// rich, replayable operation in any directory, even with no `h5i` installed.
// Event payloads mirror the real `team status --json` shapes exactly, so the
// same derive()/replay code paths run as for live data. Timestamps are anchored
// to server-start so the fleet always reads as "fresh".

const NOW = Date.now();
const iso = (minsAgo, secs = 0) => new Date(NOW - minsAgo * 60_000 + secs * 1000).toISOString();
const oid = (s) => s.padEnd(40, "0").slice(0, 40);

let _eid = 0;
const eid = () => `ev${(++_eid).toString(16).padStart(14, "0")}`;

function ev(kind, tsMin, payload, extra = {}) {
  return {
    id: eid(),
    ts: iso(tsMin),
    actor: extra.actor || "human",
    kind,
    run_id: extra.run_id,
    round: extra.round ?? 1,
    phase_before: extra.phase_before ?? null,
    phase_after: extra.phase_after ?? null,
    idempotency_key: `${kind}:${extra.run_id}:${_eid}`,
    payload,
  };
}

const POLICY = "rule:VerifierTestsPass,AppliesCleanly,SmallestDiff";

// ── Hero mission: nebula-auth ────────────────────────────────────────────────

const AGENTS = {
  soren: { env: "env/soren/auth", runtime: "claude", model: "opus-4.8", iso: "supervised" },
  nova: { env: "env/nova/auth", runtime: "codex", model: "gpt-5", iso: "container" },
  atlas: { env: "env/atlas/auth", runtime: "claude", model: "sonnet-4.6", iso: "supervised" },
};

const SUBS = {
  soren: {
    id: "sub-soren-r1-7c4a9e21",
    commit: oid("7c4a9e21"),
    files: 3,
    ins: 48,
    del: 19,
    summary:
      "Serialize refresh behind a single-flight mutex so concurrent 401s collapse into one token fetch. Adds a regression test for the thundering-herd case.",
    diff: `diff --git a/src/auth/refresh.ts b/src/auth/refresh.ts
index a1b2c3d..e4f5a6b 100644
--- a/src/auth/refresh.ts
+++ b/src/auth/refresh.ts
@@ -8,14 +8,29 @@ import { TokenStore } from "./store";
-export async function refresh(store: TokenStore): Promise<Token> {
-  const next = await fetchToken(store.refreshToken);
-  store.set(next);
-  return next;
+let inflight: Promise<Token> | null = null;
+
+// Single-flight: concurrent callers share one network refresh.
+export async function refresh(store: TokenStore): Promise<Token> {
+  if (inflight) return inflight;
+  inflight = (async () => {
+    try {
+      const next = await fetchToken(store.refreshToken);
+      store.set(next);
+      return next;
+    } finally {
+      inflight = null;
+    }
+  })();
+  return inflight;
 }
diff --git a/test/refresh.test.ts b/test/refresh.test.ts
index 0000000..1c2d3e4 100644
--- a/test/refresh.test.ts
+++ b/test/refresh.test.ts
@@ -0,0 +1,14 @@
+test("collapses concurrent refreshes into one fetch", async () => {
+  let calls = 0;
+  mockFetch(() => (calls++, token()));
+  await Promise.all([refresh(store), refresh(store), refresh(store)]);
+  expect(calls).toBe(1);
+});`,
  },
  nova: {
    id: "sub-nova-r1-3f8b1d05",
    commit: oid("3f8b1d05"),
    files: 2,
    ins: 71,
    del: 12,
    summary:
      "Full retry pipeline with exponential backoff + jitter and a circuit breaker around the IdP. Broader blast radius; one flaky timing test under load.",
    diff: `diff --git a/src/auth/refresh.ts b/src/auth/refresh.ts
index a1b2c3d..9d8e7f6 100644
--- a/src/auth/refresh.ts
+++ b/src/auth/refresh.ts
@@ -8,9 +8,40 @@ import { TokenStore } from "./store";
+import { backoff } from "../util/backoff";
+
+const MAX_RETRIES = 5;
+
 export async function refresh(store: TokenStore): Promise<Token> {
-  const next = await fetchToken(store.refreshToken);
-  store.set(next);
-  return next;
+  let lastErr: unknown;
+  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
+    try {
+      const next = await fetchToken(store.refreshToken);
+      store.set(next);
+      return next;
+    } catch (err) {
+      lastErr = err;
+      await backoff(attempt); // exponential + jitter
+    }
+  }
+  throw new RefreshError("token refresh exhausted retries", lastErr);
 }`,
  },
  atlas: {
    id: "sub-atlas-r1-b20c5af7",
    commit: oid("b20c5af7"),
    files: 1,
    ins: 9,
    del: 3,
    summary:
      "Minimal, surgical fix: guard the refresh with the store's existing lock primitive. Smallest possible diff that closes the race.",
    diff: `diff --git a/src/auth/refresh.ts b/src/auth/refresh.ts
index a1b2c3d..c0ffee1 100644
--- a/src/auth/refresh.ts
+++ b/src/auth/refresh.ts
@@ -8,9 +8,12 @@ import { TokenStore } from "./store";
 export async function refresh(store: TokenStore): Promise<Token> {
-  const next = await fetchToken(store.refreshToken);
-  store.set(next);
-  return next;
+  return store.withLock("refresh", async () => {
+    if (store.fresh()) return store.current();
+    const next = await fetchToken(store.refreshToken);
+    store.set(next);
+    return next;
+  });
 }`,
  },
};

function heroAgentEvents(rid) {
  return Object.entries(AGENTS).map(([id, a], i) =>
    ev("agent_added", 11 - i * 0.2, {
      agent_id: id,
      env_id: a.env,
      isolation_claim: a.iso,
      policy_digest: oid(`policy${i}`),
      branch_ref: `refs/heads/h5i/${a.env}`,
      worktree_known_local: true,
      state: "working",
    }, { run_id: rid, phase_before: "draft" }),
  );
}

function artifact(owner, sub, tsMin, rid) {
  return {
    id: sub.id,
    owner_agent: owner,
    round: 1,
    env_id: AGENTS[owner].env,
    commit_oid: sub.commit,
    tree_oid: oid(`tree${owner}`),
    capture_ids: [oid(`cap${owner}`).slice(0, 16)],
    files_changed: sub.files,
    insertions: sub.ins,
    deletions: sub.del,
    submitted_at: iso(tsMin),
    summary: sub.summary,
    independent: true,
    influence_event_ids: [],
    influence_artifact_ids: [],
  };
}

function verification(owner, sub, pass, tsMin, rid) {
  return {
    id: `ver-${sub.id}-${oid("v").slice(0, 8)}`,
    submission_id: sub.id,
    owner_agent: owner,
    round: 1,
    command: ["npm", "test", "--", "auth/refresh"],
    applies_cleanly: true,
    tests_passed: pass,
    isolation: AGENTS[owner].iso,
    capture_id: oid(`vcap${owner}`).slice(0, 16),
    failure: pass ? null : "1 failing: timing-sensitive retry test flaked under load",
  };
}

function buildHero() {
  const rid = "nebula-auth";
  const subs = [
    artifact("soren", SUBS.soren, 9, rid),
    artifact("nova", SUBS.nova, 8.6, rid),
    artifact("atlas", SUBS.atlas, 8.2, rid),
  ];
  const vers = [
    verification("soren", SUBS.soren, true, 6, rid),
    verification("nova", SUBS.nova, false, 5.6, rid),
    verification("atlas", SUBS.atlas, true, 5.2, rid),
  ];
  const run = {
    id: rid,
    name: "Harden the token-refresh path",
    base_oid: oid("cd93b954"),
    created_by: "human",
    created_at: iso(12),
    phase: "verdict",
    current_round: 1,
    max_rounds: 2,
    agents: Object.entries(AGENTS).map(([id, a]) => ({
      agent_id: id,
      env_id: a.env,
      runtime: a.runtime,
      model: a.model,
      isolation_claim: a.iso,
      policy_digest: oid(`policy-${id}`),
      branch_ref: `refs/heads/h5i/${a.env}`,
      worktree_known_local: true,
      latest_submission_id: SUBS[id].id,
      state: "submitted",
    })),
    submissions: subs,
    verifications: vers,
  };

  const events = [
    ev("created", 12, { name: run.name, base_oid: run.base_oid, max_rounds: 2 }, { run_id: rid, phase_after: "draft" }),
    ...heroAgentEvents(rid),
    ev("submitted", 9, subPayload("soren", SUBS.soren, 9), { run_id: rid, actor: "soren" }),
    ev("submitted", 8.6, subPayload("nova", SUBS.nova, 8.6), { run_id: rid, actor: "nova" }),
    ev("submitted", 8.2, subPayload("atlas", SUBS.atlas, 8.2), { run_id: rid, actor: "atlas" }),
    ev("frozen", 7.5, { missing_agents: [] }, { run_id: rid, phase_before: "draft", phase_after: "sealed_submit" }),
    ev("verified", 6, verPayload("soren", SUBS.soren, true), { run_id: rid }),
    ev("verified", 5.6, verPayload("nova", SUBS.nova, false), { run_id: rid }),
    ev("verified", 5.2, verPayload("atlas", SUBS.atlas, true), { run_id: rid, phase_after: "verdict" }),
    ev("review_granted", 4.6, grantPayload("nova", "soren"), { run_id: rid, actor: "nova" }),
    ev("review_submitted", 4.2, {
      reviewer: "nova",
      target: "soren",
      round: 1,
      body: "Single-flight is the right instinct and the regression test is exactly the case I'd worry about. One nit: a rejected fetch leaves `inflight` cleared (good), but consider surfacing the error to all awaiters with context.",
      referenced_artifacts: [SUBS.soren.id],
    }, { run_id: rid, actor: "nova" }),
    ev("review_granted", 4.0, grantPayload("atlas", "soren"), { run_id: rid, actor: "atlas" }),
    ev("review_submitted", 3.6, {
      reviewer: "atlas",
      target: "soren",
      round: 1,
      body: "Solid. Mine leans on the store lock instead of a module-global so it survives hot-reload, but yours is more self-contained. Either closes the race.",
      referenced_artifacts: [SUBS.atlas.id, SUBS.soren.id],
    }, { run_id: rid, actor: "atlas" }),
    ev("discussion", 3.0, {
      from: "soren",
      to: ["nova", "atlas"],
      round: 1,
      body: "Agreed atlas's lock-based version is the smaller surface. If the verifier favors smallest passing diff I'd defer to it.",
      referenced_artifacts: [SUBS.atlas.id],
    }, { run_id: rid, actor: "soren" }),
    ev("verdict", 1.2, {
      selected_submission: SUBS.atlas.id,
      method: POLICY,
      decided_by: "team-policy",
      can_auto_apply: true,
      reasons: [
        `${SUBS.atlas.id} applies cleanly`,
        `${SUBS.atlas.id} verifier tests passed via \`npm test -- auth/refresh\``,
        `${SUBS.nova.id} excluded: verifier tests failed`,
        "smallest diff among verifier-passing candidates",
      ],
    }, { run_id: rid, phase_before: "verdict", phase_after: "verdict" }),
  ];
  return { run, events };
}

function subPayload(owner, sub, tsMin) {
  return { ...artifact(owner, sub, tsMin) };
}
function verPayload(owner, sub, pass) {
  const v = verification(owner, sub, pass);
  return { id: v.id, submission_id: v.submission_id, owner_agent: owner, round: 1, command: v.command, applies_cleanly: v.applies_cleanly, tests_passed: pass, isolation: v.isolation, capture_id: v.capture_id };
}
function grantPayload(reviewer, target) {
  return {
    reviewer,
    target,
    round: 1,
    artifact_kinds: ["diff", "summary", "tests"],
    artifact_ids: [SUBS[target].id],
    granted_by: "human",
    message_id: oid(`msg-${reviewer}`).slice(0, 16),
    phase_bound: "sealed_submit",
  };
}

// ── Supporting missions (fleet variety) ──────────────────────────────────────

function buildCache() {
  const rid = "orbit-cache";
  const agents = ["vega", "lyra"].map((id, i) => ({
    agent_id: id,
    env_id: `env/${id}/cache`,
    runtime: i === 0 ? "claude" : "codex",
    model: i === 0 ? "opus-4.8" : "gpt-5",
    isolation_claim: "supervised",
    policy_digest: oid(`pol-${id}`),
    branch_ref: `refs/heads/h5i/env/${id}/cache`,
    worktree_known_local: true,
    latest_submission_id: null,
    state: "working",
  }));
  const run = {
    id: rid,
    name: "Fix cache-invalidation race",
    base_oid: oid("aa17ff02"),
    created_by: "human",
    created_at: iso(4),
    phase: "draft",
    current_round: 1,
    max_rounds: 2,
    agents,
    submissions: [],
    verifications: [],
  };
  const events = [
    ev("created", 4, { name: run.name, base_oid: run.base_oid, max_rounds: 2 }, { run_id: rid, phase_after: "draft" }),
    ...agents.map((a, i) =>
      ev("agent_added", 3.8 - i * 0.2, {
        agent_id: a.agent_id,
        env_id: a.env_id,
        isolation_claim: a.isolation_claim,
        policy_digest: a.policy_digest,
        branch_ref: a.branch_ref,
        worktree_known_local: true,
        state: "working",
      }, { run_id: rid, phase_before: "draft" }),
    ),
  ];
  return { run, events };
}

function buildMigrate() {
  const rid = "pulsar-migrate";
  const ids = ["orion", "rigel"];
  const subs = ids.map((id, i) => ({
    id: `sub-${id}-r1-${oid(id).slice(0, 8)}`,
    owner_agent: id,
    round: 1,
    env_id: `env/${id}/migrate`,
    commit_oid: oid(`c${id}`),
    tree_oid: oid(`t${id}`),
    capture_ids: [],
    files_changed: 5 + i,
    insertions: 120 + i * 30,
    deletions: 60 + i * 10,
    submitted_at: iso(7 - i),
    summary: i === 0 ? "Online migration with shadow table + backfill." : "Stop-the-world migration in a single transaction.",
    independent: true,
    influence_event_ids: [],
    influence_artifact_ids: [],
  }));
  const vers = subs.map((s, i) => ({
    id: `ver-${s.id}`,
    submission_id: s.id,
    owner_agent: s.owner_agent,
    round: 1,
    command: ["npm", "run", "migrate:test"],
    applies_cleanly: i === 0,
    tests_passed: false,
    isolation: "container",
    capture_id: oid(`vc${i}`).slice(0, 16),
    failure: i === 0 ? "backfill exceeds lock-timeout on 10M-row fixture" : "patch does not apply: conflicts in schema.sql",
  }));
  const run = {
    id: rid,
    name: "Migrate sessions table to v3",
    base_oid: oid("9e3d77c1"),
    created_by: "human",
    created_at: iso(9),
    phase: "no_verdict",
    current_round: 1,
    max_rounds: 1,
    agents: ids.map((id, i) => ({
      agent_id: id,
      env_id: `env/${id}/migrate`,
      runtime: "claude",
      model: "opus-4.8",
      isolation_claim: "container",
      policy_digest: oid(`pm-${id}`),
      branch_ref: `refs/heads/h5i/env/${id}/migrate`,
      worktree_known_local: true,
      latest_submission_id: subs[i].id,
      state: "submitted",
    })),
    submissions: subs,
    verifications: vers,
  };
  const events = [
    ev("created", 9, { name: run.name, base_oid: run.base_oid, max_rounds: 1 }, { run_id: rid, phase_after: "draft" }),
    ...ids.map((id, i) =>
      ev("agent_added", 8.8 - i * 0.2, { agent_id: id, env_id: `env/${id}/migrate`, isolation_claim: "container", policy_digest: oid(`pm-${id}`), branch_ref: `refs/heads/h5i/env/${id}/migrate`, worktree_known_local: true, state: "working" }, { run_id: rid, phase_before: "draft" }),
    ),
    ...subs.map((s, i) => ev("submitted", 7 - i, { ...s }, { run_id: rid, actor: s.owner_agent })),
    ev("frozen", 6, { missing_agents: [] }, { run_id: rid, phase_before: "draft", phase_after: "sealed_submit" }),
    ...vers.map((v, i) => ev("verified", 5 - i * 0.5, { id: v.id, submission_id: v.submission_id, owner_agent: v.owner_agent, round: 1, command: v.command, applies_cleanly: v.applies_cleanly, tests_passed: false, isolation: v.isolation, capture_id: v.capture_id }, { run_id: rid })),
    ev("no_verdict", 3, {
      selected_submission: null,
      method: POLICY,
      decided_by: "team-policy",
      can_auto_apply: false,
      reasons: ["no candidate has passing verifier evidence", "orion: backfill exceeds lock-timeout", "rigel: patch does not apply"],
    }, { run_id: rid, phase_before: "sealed_submit", phase_after: "no_verdict" }),
  ];
  return { run, events };
}

// ── Assemble ─────────────────────────────────────────────────────────────────

const HERO = buildHero();
const CACHE = buildCache();
const MIGRATE = buildMigrate();
const RUNS = { [HERO.run.id]: HERO, [CACHE.run.id]: CACHE, [MIGRATE.run.id]: MIGRATE };

const MESSAGES = [
  { from: "human", to: "all", kind: "DISPATCH", min: 11.6, body: "Mission: close the token-refresh race. Independent candidates, then we verify and finalize on smallest passing diff." },
  { from: "soren", to: "human", kind: "ACK", min: 10.4, body: "On it — going single-flight." },
  { from: "nova", to: "human", kind: "ACK", min: 10.3, body: "Taking the resilient/retry angle." },
  { from: "atlas", to: "human", kind: "ACK", min: 10.2, body: "I'll try the minimal lock-based fix." },
  { from: "human", to: "nova", kind: "REVIEW_REQUEST", min: 4.6, body: "Review soren's submission.", focus: SUBS.soren.id },
  { from: "nova", to: "soren", kind: "REVIEW", min: 4.1, body: "Single-flight LGTM; surface fetch errors to all awaiters." },
  { from: "atlas", to: "soren", kind: "REVIEW", min: 3.5, body: "Either closes the race; yours is more self-contained." },
  { from: "soren", to: "all", kind: "DISCUSS", min: 2.9, body: "Defer to the verifier on smallest passing diff — atlas's is smaller." },
  { from: "human", to: "all", kind: "TEAM_DONE", min: 0.9, body: "Verdict in: atlas cleared for launch. Nice work." },
];

function messagesList(limit = 60) {
  return MESSAGES.map((m, i) => ({
    idx: i + 1,
    ts: iso(m.min),
    from: m.from,
    to: m.to,
    body: m.body,
    kind: m.kind,
    thread: oid(`thr${i}`).slice(0, 16),
    branch: "auth",
    focus: m.focus || null,
    granted: m.kind === "REVIEW_REQUEST" ? "diff,summary,tests" : null,
  }))
    .sort((a, b) => b.idx - a.idx)
    .slice(0, limit);
}

const ROSTER = [
  { online: true, name: "human", you: true, lastSeen: iso(1) },
  { online: true, name: "soren", you: false, lastSeen: iso(3) },
  { online: true, name: "nova", you: false, lastSeen: iso(4.2) },
  { online: false, name: "atlas", you: false, lastSeen: iso(3.6) },
  { online: false, name: "vega", you: false, lastSeen: iso(3.8) },
];

const CONTEXT = {
  available: true,
  goal: "Close the token-refresh race without regressing latency",
  gitBranch: "harden-auth",
  contextBranch: "harden-auth",
  milestones: [
    { done: true, text: "Reproduce thundering-herd on concurrent 401s" },
    { done: true, text: "Three independent candidates submitted" },
    { done: true, text: "Neutral verifier replayed on each" },
    { done: false, text: "Apply winner and backport regression test" },
  ],
  branches: ["env/soren/auth", "env/nova/auth", "env/atlas/auth", "* harden-auth", "main"],
  commits: ["Open nebula-auth team run (3 candidates, smallest-passing-diff policy)"],
  trace: [
    { time: iso(10).slice(11, 19), kind: "OBSERVE", text: "read src/auth/refresh.ts" },
    { time: iso(8).slice(11, 19), kind: "THINK", text: "concurrent callers each trigger a full token fetch" },
    { time: iso(6).slice(11, 19), kind: "ACT", text: "ran neutral verifier on all candidates" },
    { time: iso(1).slice(11, 19), kind: "NOTE", text: "atlas wins on smallest passing diff" },
  ],
};

/** A data source with the same surface as the live h5i bridge. */
export function createDemoSource() {
  const find = (id) => {
    const r = RUNS[id];
    if (!r) {
      const err = new Error(`no team run '${id}'`);
      err.name = "H5iError";
      err.command = `demo team status ${id}`;
      throw err;
    }
    return r;
  };
  return {
    meta: () => ({ repo: "demo://nebula-fleet", version: "h5i demo (bundled)" }),
    teamList: async () => Object.values(RUNS).map((r) => r.run),
    teamStatus: async (id) => {
      const r = find(id);
      return { run: r.run, events: r.events };
    },
    teamCompare: async (id) => {
      const r = find(id);
      const tools = { soren: "Edit", nova: "Bash", atlas: "Edit", orion: "Bash", rigel: "Edit", vega: "Read", lyra: "Read" };
      return r.run.agents.map((a) => {
        const sub = r.run.submissions.find((s) => s.owner_agent === a.agent_id);
        return {
          agent_id: a.agent_id,
          env_id: a.env_id,
          submitted: Boolean(sub),
          submission_id: sub?.id ?? null,
          status: a.state === "submitted" ? "submitted" : "running",
          base_commit: r.run.base_oid,
          files_changed: sub?.files_changed ?? 0,
          insertions: sub?.insertions ?? 0,
          deletions: sub?.deletions ?? 0,
          last_exit: a.state === "submitted" ? 0 : null,
          last_tool: tools[a.agent_id] ?? null,
          last_result: null,
          last_counts: {},
        };
      });
    },
    teamArtifact: async (id, team, view) => {
      const r = find(team);
      const sub = r.run.submissions.find((s) => s.id === id);
      if (!sub) {
        const err = new Error(`no artifact '${id}'`);
        err.name = "H5iError";
        throw err;
      }
      const detail = SUBS[sub.owner_agent];
      return {
        id: sub.id,
        owner_agent: sub.owner_agent,
        round: sub.round,
        base_oid: r.run.base_oid,
        commit_oid: sub.commit_oid,
        files_changed: sub.files_changed,
        insertions: sub.insertions,
        deletions: sub.deletions,
        capture_ids: sub.capture_ids,
        diff: view === "diff" ? detail?.diff ?? sub.summary ?? "" : null,
        summary: sub.summary ?? null,
      };
    },
    messages: async (limit) => messagesList(limit),
    roster: async () => ROSTER,
    context: async () => CONTEXT,
  };
}
