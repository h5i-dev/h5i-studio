# H5I · Fleet Command

An orbital **mission-control viewer for [`h5i team`](https://github.com/Koukyosyumei/h5i)** — the
phased, evidence-publishing multi-agent collaboration feature of h5i. Where the
built-in `h5i serve` dashboard is a utilitarian table, Fleet Command reframes a
team run as a live **launch operation**: agents are starfighters in a squadron,
their sealed candidates are flight plans, the neutral verifier is telemetry, and
the finalization policy is a **GO / NO-GO** launch lamp.

Inspired by [`agmsg-office`](../agmsg-office) (a Moe-anime viewer for `agmsg`), but
with a deep-space HUD aesthetic befitting an AI version-control sidecar.

> No mock data. Every pixel is rendered from the real `h5i` CLI running against a
> real repository.

![deck](docs/deck.png)

---

## What it shows

A team run (`h5i team`) is an event-sourced state machine. Fleet Command reads it
live and renders every part of the lifecycle:

| Deck panel | h5i concept | Source |
|---|---|---|
| **Fleet Operations** | all team runs, phase + crew + sealed count | `team list --json` |
| **Phase rail** | `draft → sealed → review → eval → cleared → launched` | `run.phase` |
| **Squadron** | roster agents as ships: env, isolation, runtime, live tool/exit | `team status` + `team compare` + `msg team` |
| **Candidates** | sealed submissions: diff envelope, verifier gates, winner | `run.submissions` + `run.verifications` |
| **Flight Plan** (modal) | a submission's diff / summary / test evidence | `team artifact show` |
| **Launch Authority** | GO/HOLD/NO-GO verdict, deciding rule, reasons | folded from `verdict` / `no_verdict` events |
| **Comms Channel** | peer reviews, grants, discussion, crew radio | folded from events + `msg history` |
| **Flight Recorder** | the full append-only event log | `team status` `events[]` |
| **Nav Log** | shared reasoning workspace (goal, milestones, trace) | `recall context show` |

The console polls continuously (4 s on an open deck, 8 s ambient) with a LIVE /
IDLE / LOST uplink indicator.

---

## Architecture

```
 browser (React + Vite, "Fleet Command" theme)
    │  fetch /api/*
    ▼
 Express read-only API  ──shells out──▶  h5i CLI  ──▶  refs/h5i/* (git)
 (server/ + vite dev middleware)
```

- **`server/h5i.mjs`** — the CLI bridge. `team` data comes from `--json`; `msg`
  and `recall context` (which have no `--json` in the installed CLI) are parsed
  from their human output by the pure functions in **`server/parse.mjs`**.
- **`server/derive.mjs`** — folds the append-only event log into the higher-order
  objects the installed `team status --json` doesn't include directly (the latest
  verdict, peer reviews, review grants, discussion).
- **`server/api.mjs`** — the read-only REST router, shared by **both** the
  standalone production server (`server/index.mjs`) and the Vite dev middleware
  (`vite.config.ts`). One source of truth, no drift.
- **`src/`** — the React SPA. A canvas warp-drift starfield, procedurally-drawn
  ship insignia (deterministic per call-sign — no image assets), and a HUD theme
  in a single `theme.css`.

Every API endpoint is a **pure read**: nothing the viewer does advances a team
run's state. (The verdict is derived from the existing event log rather than by
invoking `team finalize`, which would append a new event.)

### API

```
GET /api/health                                 service + repo + h5i version
GET /api/teams                                  TeamRun[]
GET /api/teams/:id                              { run, events, derived }
GET /api/teams/:id/compare                      CompareRow[]
GET /api/teams/:id/artifact/:artifactId?view=   diff | summary | tests
GET /api/messages?limit=                        cross-agent radio (newest first)
GET /api/roster                                 message-channel roster
GET /api/context                                shared reasoning workspace
```

---

## Run it

Requirements: **Node ≥ 18**, the **`h5i`** binary on `PATH`.

```bash
npm install

# Dev — Vite HMR + live API in one process (http://localhost:5180)
npm run dev

# Production — build the SPA, then serve it + the API on one port
npm run build
H5I_REPO=/path/to/your/h5i/repo PORT=8787 npm run serve
```

Point it at any repository with `H5I_REPO` (defaults to the current directory).
Override the binary with `H5I_BIN`.

### Seeing data

Fleet Command shows whatever team runs exist on the target clone. To create one:

```bash
h5i env create alice && h5i env create bob
h5i team create my-run --title "Refactor auth" --rounds 2
h5i team add-env my-run alice
h5i team add-env my-run bob
# … agents work in their envs, then:
h5i team submit my-run --agent <id>
h5i team freeze my-run
h5i team verify my-run --agent <id> -- <test cmd>
h5i team finalize my-run
```

---

## Tests

```bash
npm test         # parsers + event-fold + live API integration  (no browser)
npm run test:e2e # Playwright DOM e2e against the built SPA      (optional)
npm run test:all # everything
```

- **`test/parse.test.mjs`** — the CLI-text parsers, against fixtures captured
  verbatim from the real `h5i` 0.2.x CLI (msg history plain+rich merge, roster,
  context, ANSI stripping).
- **`test/derive.test.mjs`** — the event-log projection: verdict precedence
  (a later `verdict` overrides an earlier `no_verdict`), reviews, grants,
  discussion, and totality over empty input.
- **`test/api.test.mjs`** — boots the real Express router over HTTP against the
  live `h5i` CLI; team-specific cases skip (not fail) when no team is present, so
  the suite is green on a fresh clone.
- **`test/e2e.test.mjs`** — drives a real Chromium via Playwright, asserting the
  deck renders from live data with no runtime errors. Self-skips when the bundle
  isn't built or no browser is available.

---

## Theme notes

- Palette: deep-space navy void, phosphor cyan, hazard amber, plasma magenta,
  go-green. Corner-bracketed glass panels, scanline + vignette overlays.
- Type: Orbitron (display), Rajdhani (UI), Share Tech Mono (instrument data).
- Each agent's craft + livery hue is a deterministic hash of its call-sign, so an
  operative reads as the same ship everywhere — generated as SVG, zero assets.
- Respects `prefers-reduced-motion` (the starfield holds still).
