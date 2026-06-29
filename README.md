<p align="center">
  <img src="./docs/logo.png" alt="H5I Fleet Command" height="112">
</p>

<p align="center">
  <a href="#6-license"><img alt="Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  <a href="https://github.com/h5i-dev/h5i"><img alt="powered by h5i" src="https://img.shields.io/badge/powered%20by-h5i-6f42c1"></a>
  <img alt="read-only, no mock data" src="https://img.shields.io/badge/real%20h5i%20data-read--only-2ea44f">
</p>

<h1 align="center">Don't read your agent team. Watch it.</h1>

[h5i](https://github.com/h5i-dev/h5i) runs a **team of coding agents** on the same task, sealed in their own sandboxes, then peer-reviews and verifies them and merges the one that passes. **H5I Fleet Command** is the viewer that turns one of those runs into a live **starship bridge**: each agent is a crew member who reports in, seals a candidate, speaks its *actual* review, and — if the neutral verifier clears it — **launches**. The Mission Director (the central computer) narrates the **GO / NO-GO** verdict. Hit **replay** to watch the whole operation again, or **export it as a GIF**.

> ***Your agent team isn't a table of rows. It's a crew with a story.***

<p align="center">
  <img src="./docs/hero.gif" alt="A spaceship meeting room: crew members scattered around a central computer report in, seal candidates, review each other in speech bubbles, and the winner launches on a beam while the Mission Director announces the verdict." width="96%">
</p>

<table align="center">
  <tr>
    <td align="center"><strong>Anthropomorphic bridge</strong><br><sub>agents are crew, not rows</sub></td>
    <td align="center"><strong>Mission replay</strong><br><sub>scrub or loop the whole run</sub></td>
    <td align="center"><strong>GIF export</strong><br><sub>share the replay, one command</sub></td>
    <td align="center"><strong>Real h5i, read-only</strong><br><sub>no mock, no SaaS</sub></td>
  </tr>
</table>

**Who it's for:** anyone running `h5i team` (Claude Code / Codex ensembles) who wants to *see* — and share — what the team actually did, instead of squinting at a table of diffs.

---

## 1. Quick start

No install, no `h5i`, no repo — explore a bundled demo fleet (with replay):

```bash
npx @h5i/studio --demo
```

Then point it at a real h5i repository:

```bash
npx @h5i/studio                 # the repo in the current directory
npx @h5i/studio -r ../project   # another repo
```

Or install it for repeated use:

```bash
npm i -g @h5i/studio
h5i-studio                       # opens the console in your browser
```

Requirements: **Node ≥ 18**, and the **`h5i`** binary on `PATH` (not needed for `--demo`).

---

## 2. The bridge

Opening an operation drops you straight into the **meeting room** — the centrepiece. The data console is one click away (**▦ DETAILS**), but the story is on stage:

- **Crew** — each `h5i team` agent is a character drawn in its own livery (no image assets), scattered around the room with depth. Posture follows the run: *standby* → *on comms* (a speech bubble with the real review / discussion text) → *reviewing* → shaking & grey when the *verifier fails* → rising on a golden beam when *launched*.
- **Central computer** — the Mission Director presides in the middle, opens the operation, calls the round sealed, and announces the **GO / NO-GO** verdict, glowing green or red.
- **Tap a crew member** for their dossier — env, isolation, runtime/model, live tool/exit, and a jump to their diff.
- **Radio chatter** (`h5i msg`) is woven into the same timeline, so the crew also speak their dispatches, acks and discussion.

<p align="center">
  <img src="./docs/launch.png" alt="The central computer turns green and announces the verdict; the winning crew member rises on a launch beam." width="80%">
</p>

> Where `h5i serve` gives you the *data*, Fleet Command gives you the *cast*. (Inspired by [`agmsg-office`](https://github.com/fujibee/agmsg).)

---

## 3. Replay & GIF export

Every team carries a timestamped, append-only event log, so any operation can be **replayed**. Hit **◉ REPLAY** and the room performs the run beat by beat — looping continuously — while a scrubber lets you play / pause, change speed (1–8×), or jump to any moment. Reconstruction is pure and client-side, so it works on live *and* demo data.

Render that replay to a shareable **animated GIF** from the CLI (in-process, no ffmpeg):

```bash
h5i-studio export <team> -o run.gif        # in an h5i repo
h5i-studio export --demo nebula-auth        # from the bundled fleet
h5i-studio export my-run --width 1200 --frame-ms 1800
```

GIF export needs Playwright + Chromium once (`npm i -D playwright && npx playwright install chromium`) — kept out of the package's runtime deps so a normal install stays lean.

---

## 4. How it reads h5i

Fleet Command is a **read-only** lens over the real `h5i` CLI — **no mock data**, and it never advances a run's state:

| Shows | From |
|---|---|
| fleet, roster, phase, submissions, verifications | `h5i team list / status / compare --json` |
| diffs, summaries, test evidence | `h5i team artifact show` |
| the GO / NO-GO verdict | folded from the `verdict` / `no_verdict` events |
| reviews, grants, discussion, crew radio | events + `h5i msg history` |

A small Express server shells out to `h5i` and serves JSON; the React app renders it. The same API powers the dev server and the standalone `h5i-studio` binary, so live and demo data run identical code paths.

---

## 5. From source

```bash
npm install
npm run dev          # Vite HMR + live API in one process
npm run build && npm run serve   # build the SPA, serve it + the API

npm test             # parsers + event-fold + live API (no browser)
npm run test:e2e     # Playwright DOM e2e + GIF export (optional)
```

The bundled `--demo` fleet is what the end-to-end tests run against, so the demo stays correct.

---

## 6. License

Apache-2.0 — see [LICENSE](LICENSE). Built for, and on top of, [h5i](https://github.com/h5i-dev/h5i).
