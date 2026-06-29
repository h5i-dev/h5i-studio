import { useMemo } from "react";
import type { TeamDetail } from "../../types";
import { computeBeat, DIRECTOR, type ActiveSource } from "../../lib/performance";
import { phaseDef } from "../../lib/phases";
import { CrewActor } from "./CrewActor";
import { HostCore } from "./HostCore";

/**
 * The Bridge: a comic spaceship control room where equal agents are performed
 * as crew avatars. The neutral Ship Core handles operation-wide beats.
 */
export function Bridge({
  detail,
  active,
  crew,
  focused,
  replaying,
  onToggleFocus,
  onSelectAgent,
}: {
  detail: TeamDetail;
  active: ActiveSource | null;
  crew: Set<string>;
  focused: boolean;
  replaying: boolean;
  onToggleFocus: () => void;
  onSelectAgent: (name: string) => void;
}) {
  const beat = useMemo(() => computeBeat(detail, active, crew), [detail, active, crew]);
  const agents = detail.run.agents;

  // Scatter the crew flanking the central computer — left & right arcs, leaving
  // top-centre clear (Director's bubble) and bottom-centre clear (the computer).
  const placed = useMemo(() => {
    const n = agents.length || 1;
    const rightCount = Math.ceil(n / 2);
    const leftCount = n - rightCount;
    let ri = 0;
    let li = 0;
    const deg = (d: number) => (d * Math.PI) / 180;
    return agents.map((a, i) => {
      let ang: number;
      if (i % 2 === 0) {
        const t = rightCount > 1 ? ri / (rightCount - 1) : 0.5;
        ang = deg(-56 + t * 112); // right arc, around 0°
        ri++;
      } else {
        const t = leftCount > 1 ? li / (leftCount - 1) : 0.5;
        ang = deg(124 + t * 112); // left arc, around 180°
        li++;
      }
      const x = 50 + Math.cos(ang) * 34;
      const y = 54 + Math.sin(ang) * 23;
      const depth = Math.min(1, Math.max(0, (y - 26) / 50)); // 0 (back) .. 1 (front)
      const scale = 0.72 + depth * 0.58;
      return { agent: a, x, y, scale, z: Math.round(y * 12) };
    });
  }, [agents]);

  const pd = phaseDef(detail.run.phase);
  const caption = beat.line ? { who: beat.speaker === DIRECTOR ? "SHIP CORE" : beat.speaker || "", line: beat.line } : null;

  return (
    <section className={`bridge room${focused ? " focused" : ""}`}>
      {/* room backdrop layers */}
      <div className="room-space" aria-hidden />
      <div className="room-hull" aria-hidden>
        <span className="hatch-door" />
        <span className="viewport vp1 mars-window" />
        <span className="ceiling-pipework pipework-a" />
        <span className="ceiling-pipework pipework-b" />
        <span className="station st1" />
        <span className="station st2" />
        <span className="station st3" />
        <span className="station st4" />
      </div>
      <div className="room-floor" aria-hidden />

      <div className="bridge-hud">
        <span className="bridge-phase">
          <i className="dot" /> {pd.glyph} {pd.label}
        </span>
        <span className="grow" />
        <button
          className="bridge-focus"
          onClick={onToggleFocus}
          title={focused ? "show the data panels" : "back to the full room"}
        >
          {focused ? "▦ DETAILS" : "⛶ THEATER"}
        </button>
      </div>

      <div className="stage">
        {agents.length === 0 && <div className="stage-empty">— awaiting crew assignment —</div>}

        {/* central computer sits mid-depth; front crew overlap it */}
        <div className="host-anchor" style={{ zIndex: Math.round(52 * 12) + 1 }}>
          <HostCore speaking={beat.director.speaking} line={beat.director.line} mood={beat.director.mood} />
        </div>

        {placed.map((p) => (
          <CrewActor
            key={p.agent.agent_id}
            name={p.agent.agent_id}
            state={beat.states[p.agent.agent_id] ?? "idle"}
            line={beat.speaker === p.agent.agent_id ? beat.line : null}
            speaking={beat.speaker === p.agent.agent_id}
            x={p.x}
            y={p.y}
            scale={p.scale}
            z={p.z}
            onSelect={onSelectAgent}
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
