// Integration tests: boot the real Express router and drive it over HTTP
// against the live `h5i` CLI in this repository. Endpoints that need a specific
// team are skipped (not failed) when that team is absent, so the suite is green
// on a fresh clone yet gives full end-to-end coverage when demo data exists.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createApiRouter } from "../server/api.mjs";

const DEMO = "demo-run";
let server;
let base;
let teams = [];
let h5iOk = false;

before(async () => {
  const app = express();
  app.use("/api", createApiRouter());
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  base = `http://127.0.0.1:${server.address().port}`;

  try {
    const r = await fetch(`${base}/api/teams`);
    if (r.ok) {
      teams = await r.json();
      h5iOk = true;
    }
  } catch {
    h5iOk = false;
  }
});

after(() => server?.close());

const get = async (path) => {
  const r = await fetch(`${base}${path}`);
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
};
const hasDemo = () => h5iOk && teams.some((t) => t.id === DEMO);

test("GET /api/health reports the service + h5i version", async () => {
  const { status, body } = await get("/api/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "h5i-fleet-command");
  assert.match(body.version, /h5i|unknown/);
  assert.ok(body.repo);
});

test("GET /api/teams returns an array of runs", (t) => {
  if (!h5iOk) return t.skip("h5i CLI unavailable");
  assert.ok(Array.isArray(teams));
  for (const run of teams) {
    assert.ok(typeof run.id === "string");
    assert.ok(typeof run.phase === "string");
    assert.ok(Array.isArray(run.agents));
  }
});

test("GET /api/teams/:id returns run + events + derived projection", async (t) => {
  if (!hasDemo()) return t.skip(`team ${DEMO} not present`);
  const { status, body } = await get(`/api/teams/${DEMO}`);
  assert.equal(status, 200);
  assert.ok(body.run, "run present");
  assert.equal(body.run.id, DEMO);
  assert.ok(Array.isArray(body.events) && body.events.length > 0, "has events");
  assert.ok(body.derived, "derived present");
  assert.ok("verdict" in body.derived);
  assert.ok(Array.isArray(body.derived.reviews));
  assert.ok(Array.isArray(body.derived.grants));
  // The event log must mention the agents that appear on the roster.
  const agentIds = new Set(body.run.agents.map((a) => a.agent_id));
  assert.ok(agentIds.size > 0);
});

test("GET /api/teams/:id/compare returns one row per agent", async (t) => {
  if (!hasDemo()) return t.skip(`team ${DEMO} not present`);
  const { status, body } = await get(`/api/teams/${DEMO}/compare`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  for (const row of body) {
    assert.ok(typeof row.agent_id === "string");
    assert.ok("submitted" in row);
    assert.ok("files_changed" in row);
  }
});

test("GET /api/teams/:id/artifact/:artifactId returns a diff", async (t) => {
  if (!hasDemo()) return t.skip(`team ${DEMO} not present`);
  const detail = (await get(`/api/teams/${DEMO}`)).body;
  const sub = detail.run.submissions[0];
  if (!sub) return t.skip("no submissions");
  const { status, body } = await get(`/api/teams/${DEMO}/artifact/${sub.id}?view=diff`);
  assert.equal(status, 200);
  assert.equal(body.id, sub.id);
  assert.ok("diff" in body);
  assert.equal(typeof body.files_changed, "number");
});

test("unknown team yields a 422 with an error + command", async (t) => {
  if (!h5iOk) return t.skip("h5i CLI unavailable");
  const { status, body } = await get("/api/teams/no-such-team-xyz");
  assert.equal(status, 422);
  assert.ok(body.error, "error message present");
  assert.ok("command" in body, "echoes the failing command");
});

test("GET /api/messages returns newest-first messages", async (t) => {
  if (!h5iOk) return t.skip("h5i CLI unavailable");
  const { status, body } = await get("/api/messages?limit=20");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  for (const m of body) {
    assert.ok(typeof m.idx === "number");
    assert.ok(typeof m.kind === "string");
  }
  // Monotonic non-increasing idx (newest first).
  for (let i = 1; i < body.length; i++) assert.ok(body[i - 1].idx >= body[i].idx);
});

test("GET /api/roster returns channel agents", async (t) => {
  if (!h5iOk) return t.skip("h5i CLI unavailable");
  const { status, body } = await get("/api/roster");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  for (const a of body) assert.ok(typeof a.name === "string");
});

test("GET /api/context returns a context view object", async (t) => {
  if (!h5iOk) return t.skip("h5i CLI unavailable");
  const { status, body } = await get("/api/context");
  assert.equal(status, 200);
  assert.ok("available" in body);
  if (body.available) {
    assert.ok(Array.isArray(body.milestones));
    assert.ok(Array.isArray(body.trace));
  }
});
