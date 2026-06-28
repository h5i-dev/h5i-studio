// Human-facing rendering of the append-only team event log.
import type { TeamEvent } from "../types";

export interface EventViz {
  glyph: string;
  label: string;
  detail: string;
  tone: "go" | "hot" | "live" | "amber" | "idle" | "plasma";
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export function describeEvent(ev: TeamEvent): EventViz {
  const p = ev.payload || {};
  switch (ev.kind) {
    case "created":
      return {
        glyph: "✦",
        tone: "live",
        label: "MISSION OPENED",
        detail: `“${str(p.name)}” · base ${str(p.base_oid).slice(0, 8)} · ${str(p.max_rounds)} round(s)`,
      };
    case "agent_added":
      return {
        glyph: "+",
        tone: "amber",
        label: "OPERATIVE ASSIGNED",
        detail: `${str(p.agent_id)} ↔ ${str(p.env_id)} · ${str(p.isolation_claim)}`,
      };
    case "submitted":
      return {
        glyph: "▣",
        tone: "live",
        label: "CANDIDATE SEALED",
        detail: `${str(p.owner_agent)} · ${str(p.id)}`,
      };
    case "frozen":
      return {
        glyph: "❄",
        tone: "plasma",
        label: "ROUND SEALED",
        detail: Array.isArray(p.missing_agents) && p.missing_agents.length
          ? `missing: ${(p.missing_agents as string[]).join(", ")}`
          : "all candidates locked in",
      };
    case "review_granted":
      return {
        glyph: "⇄",
        tone: "amber",
        label: "REVIEW GRANTED",
        detail: `${str(p.reviewer)} → ${str(p.target)} · ${(p.artifact_kinds as string[] | undefined)?.join("/") ?? ""}`,
      };
    case "review_submitted":
      return {
        glyph: "✍",
        tone: "live",
        label: "REVIEW FILED",
        detail: `${str(p.reviewer)} → ${str(p.target)}`,
      };
    case "discussion":
    case "discussed":
      return {
        glyph: "◇",
        tone: "idle",
        label: "DISCUSSION",
        detail: `${str(p.from)} → ${Array.isArray(p.to) ? (p.to as string[]).join(",") : str(p.to)}`,
      };
    case "verified":
      return {
        glyph: "✓",
        tone: p.tests_passed ? "go" : "hot",
        label: "VERIFIER RUN",
        detail: `${str(p.owner_agent)} · tests ${p.tests_passed ? "PASS" : "FAIL"} · applies ${p.applies_cleanly ? "clean" : "DIRTY"}`,
      };
    case "verdict":
      return {
        glyph: "◈",
        tone: "go",
        label: "VERDICT",
        detail: `winner ${str(p.selected_submission)}`,
      };
    case "no_verdict":
      return {
        glyph: "⊘",
        tone: "hot",
        label: "NO VERDICT",
        detail: Array.isArray(p.reasons) && p.reasons.length ? str((p.reasons as string[])[0]) : "policy not satisfied",
      };
    case "applied":
      return {
        glyph: "▲",
        tone: "go",
        label: "WINNER LAUNCHED",
        detail: `${str(p.submission_id || p.winner)} → branch`,
      };
    default:
      return {
        glyph: "•",
        tone: "idle",
        label: ev.kind.replace(/_/g, " ").toUpperCase(),
        detail: ev.phase_after ? `→ ${ev.phase_after}` : "",
      };
  }
}
