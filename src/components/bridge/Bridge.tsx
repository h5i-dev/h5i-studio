import { useMemo } from "react";
import type { TeamDetail } from "../../types";
import { computeBeat, DIRECTOR, type ActiveSource } from "../../lib/performance";
import { phaseDef } from "../../lib/phases";
import { CrewActor } from "./CrewActor";
import { HostCore } from "./HostCore";

/**
 * The Bridge — the stage where the operation is *performed*. Each agent is a
 * crew member whose posture follows the scene; the Mission Director narrates;
 * the active beat (replay cursor, or the latest event when live) decides who is
 * speaking and what they say. This is the centrepiece — the data console below
 * is the supporting detail.
 */
export function Bridge({
  detail,
  active,
  crew,
  focused,
  replaying,
  onToggleFocus,
}: {
  detail: TeamDetail;
  active: ActiveSource | null;
  crew: Set<string>;
  focused: boolean;
  replaying: boolean;
  onToggleFocus: () => void;
}) {
  const beat = useMemo(() => computeBeat(detail, active, crew), [detail, active, crew]);
  const agents = detail.run.agents;

  // Lay the crew out along a gentle arc across the lower stage.
  const positions = useMemo(() => {
    const n = agents.length || 1;
    return agents.map((_, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = 30 + t * 60; // crew occupy centre-right; Director presides at left
      const y = 58 + Math.sin(t * Math.PI) * -8 + (i % 2 === 0 ? 0 : 6);
      return { x, y };
    });
  }, [agents]);

  const pd = phaseDef(detail.run.phase);
  const caption = beat.line
    ? { who: beat.speaker === DIRECTOR ? "MISSION DIRECTOR" : beat.speaker || "", line: beat.line }
    : null;

  return (
    <section className={`bridge${focused ? " focused" : ""}`}>
      <div className="bridge-grid" aria-hidden />
      <div className="bridge-horizon" aria-hidden />

      <div className="bridge-hud">
        <span className="bridge-phase">
          <i className="dot" /> {pd.glyph} {pd.label}
        </span>
        <span className="grow" />
        <button className="bridge-focus" onClick={onToggleFocus} title={focused ? "show console" : "theater mode"}>
          {focused ? "▣ CONSOLE" : "⛶ THEATER"}
        </button>
      </div>

      <HostCore speaking={beat.director.speaking} line={beat.director.line} mood={beat.director.mood} />

      <div className="stage">
        {agents.length === 0 && <div className="stage-empty">— awaiting crew assignment —</div>}
        {agents.map((a, i) => (
          <CrewActor
            key={a.agent_id}
            name={a.agent_id}
            state={beat.states[a.agent_id] ?? "idle"}
            line={beat.speaker === a.agent_id ? beat.line : null}
            speaking={beat.speaker === a.agent_id}
            x={positions[i].x}
            y={positions[i].y}
          />
        ))}
      </div>

      {caption && (
        <div className={`caption${beat.speaker === DIRECTOR ? " director" : ""}`}>
          <span className="cap-who">{caption.who}</span>
          <span className="cap-sep">›</span>
          <span className="cap-line">{caption.line}</span>
          {replaying && <span className="cap-live">◉ REPLAY</span>}
        </div>
      )}
    </section>
  );
}
