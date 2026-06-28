// Mission phase model — maps h5i team phases onto the Fleet Command ladder.
import type { Phase } from "../types";

export interface PhaseDef {
  key: string;
  label: string;
  /** Ordinal position on the launch ladder (terminal states share the top). */
  step: number;
  glyph: string;
}

// The canonical forward ladder a healthy run climbs.
export const PHASE_LADDER: PhaseDef[] = [
  { key: "draft", label: "STAGING", step: 0, glyph: "◢" },
  { key: "sealed_submit", label: "SEALED", step: 1, glyph: "▣" },
  { key: "discuss", label: "REVIEW", step: 2, glyph: "⇄" },
  { key: "verdict", label: "EVAL", step: 3, glyph: "◈" },
  { key: "verified", label: "CLEARED", step: 4, glyph: "✦" },
  { key: "applied", label: "LAUNCHED", step: 5, glyph: "▲" },
];

const ALIAS: Record<string, string> = {
  no_verdict: "verdict",
  sealed: "sealed_submit",
};

export function phaseDef(phase: Phase): PhaseDef {
  const key = ALIAS[phase] || phase;
  return (
    PHASE_LADDER.find((p) => p.key === key) || {
      key: String(phase),
      label: String(phase).toUpperCase(),
      step: 0,
      glyph: "◌",
    }
  );
}

export function phaseStep(phase: Phase): number {
  return phaseDef(phase).step;
}

/** A run is "live"/in-flight unless it has been applied or stalled with no verdict. */
export function isTerminal(phase: Phase): boolean {
  return phase === "applied";
}

export function isStalled(phase: Phase): boolean {
  return phase === "no_verdict";
}

export function phaseTone(phase: Phase): "go" | "hot" | "live" | "idle" {
  if (phase === "applied") return "go";
  if (phase === "no_verdict") return "hot";
  if (phase === "verified" || phase === "verdict") return "live";
  return "idle";
}
