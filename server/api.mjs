// Read-only REST API over the h5i CLI. Mounted both as Vite dev middleware
// (vite.config.ts) and by the standalone server (server/index.mjs).
//
// Every endpoint is a pure read: it never advances a team run's state. The
// finalization verdict is *derived from the existing event log* rather than by
// invoking `team finalize` (which would append a new verdict event).

import express from "express";
import * as h5i from "./h5i.mjs";
import { derive } from "./derive.mjs";

export function createApiRouter() {
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
    send(res, async () => ({
      ok: true,
      service: "h5i-fleet-command",
      repo: h5i.REPO,
      version: await h5i.version(),
      time: new Date().toISOString(),
    })),
  );

  r.get("/teams", (_req, res) => send(res, () => h5i.teamList()));

  r.get("/teams/:id", (req, res) =>
    send(res, async () => {
      const status = await h5i.teamStatus(req.params.id);
      const run = status.run ?? status;
      const events = status.events ?? [];
      return { run, events, derived: derive(run, events) };
    }),
  );

  r.get("/teams/:id/compare", (req, res) => send(res, () => h5i.teamCompare(req.params.id)));

  r.get("/teams/:id/artifact/:artifactId", (req, res) =>
    send(res, () =>
      h5i.teamArtifact(req.params.artifactId, req.params.id, String(req.query.view || "diff")),
    ),
  );

  r.get("/messages", (req, res) =>
    send(res, () => h5i.messages(Number(req.query.limit) || 60)),
  );

  r.get("/roster", (_req, res) => send(res, () => h5i.roster()));

  r.get("/context", (_req, res) => send(res, () => h5i.context()));

  return r;
}
