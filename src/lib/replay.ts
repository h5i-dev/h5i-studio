// Mission replay — reconstruct the deck state at any point in the operation by
// folding the append-only event log up to a cursor. Every team (live or demo)
// carries a timestamped event log, so replay is a pure, client-side time-machine
// over data already fetched. Same projection rules as the server's derive().

import type {
  Derived,
  TeamAgent,
  TeamArtifact,
  TeamDetail,
  TeamEvent,
  TeamRun,
  TeamVerification,
  Verdict,
} from "../types";

export function sortedAsc(events: TeamEvent[]): TeamEvent[] {
  return [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

function asArtifact(p: Record<string, unknown>): TeamArtifact {
  return {
    id: String(p.id),
    owner_agent: String(p.owner_agent),
    round: Number(p.round ?? 1),
    env_id: String(p.env_id ?? ""),
    commit_oid: String(p.commit_oid ?? ""),
    tree_oid: String(p.tree_oid ?? ""),
    capture_ids: (p.capture_ids as string[]) ?? [],
    files_changed: Number(p.files_changed ?? 0),
    insertions: Number(p.insertions ?? 0),
    deletions: Number(p.deletions ?? 0),
    submitted_at: String(p.submitted_at ?? ""),
    summary: (p.summary as string) ?? null,
    independent: Boolean(p.independent ?? true),
    influence_event_ids: (p.influence_event_ids as string[]) ?? [],
    influence_artifact_ids: (p.influence_artifact_ids as string[]) ?? [],
  };
}

function asVerification(p: Record<string, unknown>): TeamVerification {
  return {
    id: String(p.id),
    submission_id: String(p.submission_id),
    owner_agent: String(p.owner_agent),
    round: Number(p.round ?? 1),
    command: (p.command as string[]) ?? [],
    applies_cleanly: Boolean(p.applies_cleanly),
    tests_passed: Boolean(p.tests_passed),
    isolation: String(p.isolation ?? ""),
    capture_id: (p.capture_id as string) ?? null,
    failure: (p.failure as string) ?? null,
  };
}

/**
 * Reconstruct `{ run, events, derived }` as it stood after the first `cursor`
 * events (1-based count). The live `run` is used only to enrich fields the event
 * payloads omit (agent runtime/model, verification failure text).
 */
export function reconstruct(allEvents: TeamEvent[], liveRun: TeamRun, cursor: number): TeamDetail {
  const asc = sortedAsc(allEvents);
  return reconstructFromEvents(asc.slice(0, Math.max(0, Math.min(cursor, asc.length))), liveRun);
}

/**
 * Fold an already-chronological list of events into reconstructed deck state.
 * Used when the replay cursor lives on a *merged* timeline (events + radio
 * messages): we pass only the events in the visible prefix.
 */
export function reconstructFromEvents(visible: TeamEvent[], liveRun: TeamRun): TeamDetail {
  const liveAgents = new Map(liveRun.agents.map((a) => [a.agent_id, a]));
  const liveVers = new Map(liveRun.verifications.map((v) => [v.id, v]));

  const agents = new Map<string, TeamAgent>();
  const subsByKey = new Map<string, TeamArtifact>(); // owner@round → latest
  const versById = new Map<string, TeamVerification>();
  let phase = "draft";
  let round = 1;
  let name = liveRun.name;
  let base = liveRun.base_oid;
  let createdAt = liveRun.created_at;
  let createdBy = liveRun.created_by;

  for (const ev of visible) {
    if (typeof ev.round === "number") round = Math.max(round, ev.round);
    if (ev.phase_after) phase = ev.phase_after;
    const p = ev.payload || {};

    switch (ev.kind) {
      case "created":
        name = String(p.name ?? name);
        base = String(p.base_oid ?? base);
        createdAt = ev.ts;
        createdBy = ev.actor;
        break;
      case "agent_added": {
        const id = String(p.agent_id);
        const live = liveAgents.get(id);
        agents.set(id, {
          agent_id: id,
          env_id: String(p.env_id ?? live?.env_id ?? ""),
          runtime: live?.runtime ?? null,
          model: live?.model ?? null,
          isolation_claim: String(p.isolation_claim ?? live?.isolation_claim ?? ""),
          policy_digest: String(p.policy_digest ?? ""),
          branch_ref: String(p.branch_ref ?? ""),
          worktree_known_local: Boolean(p.worktree_known_local ?? true),
          latest_submission_id: null,
          state: String(p.state ?? "working"),
        });
        break;
      }
      case "submitted": {
        const art = asArtifact(p);
        subsByKey.set(`${art.owner_agent}@${art.round}`, art);
        const a = agents.get(art.owner_agent);
        if (a) {
          a.state = "submitted";
          a.latest_submission_id = art.id;
        }
        break;
      }
      case "verified": {
        const v = asVerification(p);
        const enriched = liveVers.get(v.id);
        versById.set(v.id, enriched ? { ...v, failure: enriched.failure } : v);
        break;
      }
      default:
        break;
    }
  }

  const run: TeamRun = {
    id: liveRun.id,
    name,
    base_oid: base,
    created_by: createdBy,
    created_at: createdAt,
    phase,
    current_round: round,
    max_rounds: liveRun.max_rounds,
    agents: [...agents.values()],
    submissions: [...subsByKey.values()],
    verifications: [...versById.values()],
  };

  return { run, events: visible, derived: foldDerived(visible) };
}

const str = (v: unknown) => (v == null ? "" : String(v));

/** Client mirror of server/derive.mjs — fold reviews/grants/discussion/verdict. */
export function foldDerived(events: TeamEvent[]): Derived {
  const reviews: Derived["reviews"] = [];
  const grants: Derived["grants"] = [];
  const discussions: Derived["discussions"] = [];
  let verdict: Verdict | null = null;

  for (const ev of events) {
    const p = ev.payload || {};
    switch (ev.kind) {
      case "review_submitted":
        reviews.push({
          id: ev.id,
          ts: ev.ts,
          reviewer: str(p.reviewer),
          target: str(p.target),
          body: str(p.body).trim(),
          round: Number(p.round ?? ev.round),
          artifacts: (p.referenced_artifacts as string[]) ?? [],
        });
        break;
      case "review_granted":
        grants.push({
          id: ev.id,
          ts: ev.ts,
          reviewer: str(p.reviewer),
          target: str(p.target),
          round: Number(p.round ?? ev.round),
          kinds: (p.artifact_kinds as string[]) ?? [],
          artifacts: (p.artifact_ids as string[]) ?? [],
        });
        break;
      case "discussion":
      case "discussed":
        discussions.push({
          id: ev.id,
          ts: ev.ts,
          from: str(p.from ?? p.sender),
          to: (p.to as string[]) ?? (p.recipients as string[]) ?? [],
          body: str(p.body).trim(),
          round: Number(p.round ?? ev.round),
          artifacts: (p.referenced_artifacts as string[]) ?? (p.artifacts as string[]) ?? [],
        });
        break;
      case "verdict":
      case "no_verdict":
        verdict = {
          selected_submission: (p.selected_submission as string) ?? null,
          method: str(p.method),
          decided_by: str(p.decided_by),
          can_auto_apply: Boolean(p.can_auto_apply),
          reasons: (p.reasons as string[]) ?? [],
          ts: ev.ts,
          resolved: ev.kind === "verdict",
        };
        break;
      default:
        break;
    }
  }
  return { verdict, reviews, grants, discussions };
}
