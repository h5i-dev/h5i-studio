import { Fragment } from "react";
import type { Phase } from "../types";
import { PHASE_LADDER, isStalled, phaseStep } from "../lib/phases";

/** The launch-ladder rail: lit nodes up to the current mission phase. */
export function PhaseRail({ phase, compact = false }: { phase: Phase; compact?: boolean }) {
  const step = phaseStep(phase);
  const stalled = isStalled(phase);
  const ladder = compact ? PHASE_LADDER.filter((p) => p.key !== "discuss") : PHASE_LADDER;

  return (
    <div className={`phaserail${stalled ? " stalled" : ""}`} role="img" aria-label={`phase ${phase}`}>
      {ladder.map((p, i) => {
        const cls = p.step < step ? "done" : p.step === step ? "current" : "";
        return (
          <Fragment key={p.key}>
            {i > 0 && <span className={`link${p.step <= step ? " done" : ""}`} />}
            <div className={`node ${cls}`}>
              <span className="ring">{p.glyph}</span>
              {!compact && <span className="lbl">{p.label}</span>}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
