// The performance layer — turns the team's event timeline into a *staged scene*.
// This is the anthropomorphic heart of the viewer: agents are a cast, the run is
// a play. Given the reconstructed state and the "active" event (the replay
// cursor, or the latest beat when live), it decides every character's posture
// and who is speaking which line — so the Bridge can perform it.

import type { Derived, Message, TeamDetail, TeamEvent, TeamRun } from "../types";

export const DIRECTOR = "__director__";

/** A beat's source: an authoritative team event, or a radio transmission. */
export type ActiveSource =
  | { type: "event"; event: TeamEvent }
  | { type: "message"; message: Message };

export type ActorState =
  | "idle"
  | "speaking"
  | "thinking"
  | "sealed"
  | "cleared"
  | "failed"
  | "winner";

export interface Beat {
  /** Agent id of the active speaker, the DIRECTOR, or null (quiet scene). */
  speaker: string | null;
  /** The spoken line (subtitle / bubble), or null. */
  line: string | null;
  /** Persistent posture for every agent currently on stage. */
  states: Record<string, ActorState>;
  /** Director narration overlay. */
  director: { speaking: boolean; line: string | null; mood: "neutral" | "go" | "nogo" };
}

function clip(s: string, n = 150): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Fold persistent posture (sealed / cleared / failed / winner) from the run. */
function basePostures(run: TeamRun, derived: Derived): Record<string, ActorState> {
  const states: Record<string, ActorState> = {};
  const winner = derived.verdict?.selected_submission ?? null;
  const verByOwner = new Map<string, boolean>();
  for (const v of run.verifications) {
    // last write wins; a passing verification is the meaningful one
    if (!verByOwner.has(v.owner_agent) || v.tests_passed) verByOwner.set(v.owner_agent, v.tests_passed);
  }
  for (const a of run.agents) {
    const sub = a.latest_submission_id;
    let st: ActorState = "idle";
    if (sub) st = "sealed";
    if (verByOwner.has(a.agent_id)) st = verByOwner.get(a.agent_id) ? "cleared" : "failed";
    if (sub && sub === winner) st = "winner";
    states[a.agent_id] = st;
  }
  return states;
}

/** The active line: who speaks, what they say, for the event at the cursor. */
function activeLine(
  ev: TeamEvent | null,
  run: TeamRun,
): { speaker: string | null; line: string | null; director: boolean; mood: "neutral" | "go" | "nogo" } {
  if (!ev) return { speaker: null, line: null, director: false, mood: "neutral" };
  const p = ev.payload || {};
  const s = (v: unknown) => (v == null ? "" : String(v));

  switch (ev.kind) {
    case "created":
      return {
        speaker: DIRECTOR,
        director: true,
        mood: "neutral",
        line: `Operation "${s(p.name)}" is open. Independent candidates — smallest passing diff wins.`,
      };
    case "agent_added":
      return { speaker: s(p.agent_id), line: `${s(p.agent_id)}, reporting for duty.`, director: false, mood: "neutral" };
    case "submitted": {
      const sub = run.submissions.find((x) => x.id === s(p.id));
      const line = sub?.summary ? clip(sub.summary) : "Candidate sealed — this is my approach.";
      return { speaker: s(p.owner_agent), line, director: false, mood: "neutral" };
    }
    case "frozen":
      return { speaker: DIRECTOR, director: true, mood: "neutral", line: "Round sealed. All candidates locked — verification begins." };
    case "verified":
      return {
        speaker: s(p.owner_agent),
        director: false,
        mood: "neutral",
        line: p.tests_passed ? "Verifier's green. Applies clean." : "Verifier failed — my patch didn't hold up.",
      };
    case "review_granted":
      return { speaker: s(p.reviewer), line: `Pulling up ${s(p.target)}'s submission to review…`, director: false, mood: "neutral" };
    case "review_submitted":
      return { speaker: s(p.reviewer), line: clip(s(p.body)) || `Reviewed ${s(p.target)}.`, director: false, mood: "neutral" };
    case "discussion":
    case "discussed":
      return { speaker: s(p.from), line: clip(s(p.body)) || "Let's talk it through.", director: false, mood: "neutral" };
    case "verdict": {
      const win = run.submissions.find((x) => x.id === s(p.selected_submission));
      return {
        speaker: DIRECTOR,
        director: true,
        mood: "go",
        line: win ? `Verdict: ${win.owner_agent} is cleared for launch.` : "Verdict recorded.",
      };
    }
    case "no_verdict":
      return { speaker: DIRECTOR, director: true, mood: "nogo", line: "No candidate cleared. Mission holds — NO-GO." };
    default:
      return { speaker: null, line: null, director: false, mood: "neutral" };
  }
}

/** A radio transmission, spoken by its sender (crew) or relayed by the Director
 * (the human commander and any non-crew callers). */
function messageLine(
  m: Message,
  crew: Set<string>,
): { speaker: string | null; line: string | null; director: boolean; mood: "neutral" | "go" | "nogo" } {
  const isCrew = crew.has(m.from);
  const body = clip(m.body || "");
  return { speaker: isCrew ? m.from : DIRECTOR, line: body || null, director: !isCrew, mood: "neutral" };
}

/** Compute the full stage beat for the current frame. */
export function computeBeat(view: TeamDetail, active: ActiveSource | null, crew: Set<string>): Beat {
  const states = basePostures(view.run, view.derived);
  const isReviewGrant = active?.type === "event" && active.event.kind === "review_granted";
  const a = !active
    ? { speaker: null, line: null, director: false, mood: "neutral" as const }
    : active.type === "event"
      ? activeLine(active.event, view.run)
      : messageLine(active.message, crew);

  // The active speaker gets a transient acting posture, unless a terminal
  // posture (winner/failed) should keep reading.
  if (a.speaker && a.speaker !== DIRECTOR && states[a.speaker] !== undefined) {
    const persistent = states[a.speaker];
    if (persistent !== "winner" && persistent !== "failed") {
      states[a.speaker] = isReviewGrant ? "thinking" : "speaking";
    }
  }

  return {
    speaker: a.speaker,
    line: a.line,
    states,
    director: { speaking: a.director, line: a.director ? a.line : null, mood: a.mood },
  };
}
