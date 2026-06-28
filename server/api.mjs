// Read-only REST API. Mounted both as Vite dev middleware (vite.config.ts) and
// by the standalone server (server/index.mjs).
//
// The data source is pluggable: the live h5i CLI bridge by default, or the
// bundled demo fleet when `--demo` is set. Both expose the same surface, so the
// router (and the event-fold) is identical for live and demo data.
//
// Every endpoint is a pure read: it never advances a team run's state. The
// finalization verdict is derived from the existing event log rather than by
// invoking `team finalize` (which would append a new verdict event).

import express from "express";
import * as h5i from "./h5i.mjs";
import { createDemoSource } from "./demo.mjs";
import { derive } from "./derive.mjs";

/** The live source wraps the h5i CLI bridge in the common source interface. */
function liveSource() {
  return {
    meta: async () => ({ repo: h5i.REPO, version: await h5i.version() }),
    teamList: h5i.teamList,
    teamStatus: h5i.teamStatus,
    teamCompare: h5i.teamCompare,
    teamArtifact: h5i.teamArtifact,
    messages: h5i.messages,
    roster: h5i.roster,
    context: h5i.context,
  };
}

export function createApiRouter(opts = {}) {
  const src = opts.demo ? createDemoSource() : opts.source || liveSource();
  const demo = Boolean(opts.demo);
  const r = express.Router();
  r.use(express.json());

  const send = (res, fn) =>
    Promise.resolve()
      .then(fn)
      .then((data) => res.json(data))
      .catch((err) => {
        res.status(err?.name === "H5iError" ? 422 : 500).json({
          error: String(err?.message ?? err),
          command: err?.command ?? null,
        });
      });

  r.get("/health", (_req, res) =>
    send(res, async () => {
      const meta = await src.meta();
      return {
        ok: true,
        service: "h5i-fleet-command",
        demo,
        repo: meta.repo,
        version: meta.version,
        time: new Date().toISOString(),
      };
    }),
  );

  r.get("/teams", (_req, res) => send(res, () => src.teamList()));

  r.get("/teams/:id", (req, res) =>
    send(res, async () => {
      const status = await src.teamStatus(req.params.id);
      const run = status.run ?? status;
      const events = status.events ?? [];
      return { run, events, derived: derive(run, events) };
    }),
  );

  r.get("/teams/:id/compare", (req, res) => send(res, () => src.teamCompare(req.params.id)));

  r.get("/teams/:id/artifact/:artifactId", (req, res) =>
    send(res, () =>
      src.teamArtifact(req.params.artifactId, req.params.id, String(req.query.view || "diff")),
    ),
  );

  r.get("/messages", (req, res) => send(res, () => src.messages(Number(req.query.limit) || 60)));

  r.get("/roster", (_req, res) => send(res, () => src.roster()));

  r.get("/context", (_req, res) => send(res, () => src.context()));

  return r;
}
