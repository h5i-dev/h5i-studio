import { useMemo } from "react";
import type { TeamDetail } from "../../types";
import { computeBeat, DIRECTOR, type ActiveSource } from "../../lib/performance";
import { phaseDef } from "../../lib/phases";
import { hash01 } from "../../lib/format";
import { CrewActor } from "./CrewActor";
import { HostCore } from "./HostCore";

/**
 * The Bridge — a spaceship meeting room where the operation is *performed*. The
 * crew are scattered around a CENTRAL COMPUTER (the Mission Director); each
 * agent's posture follows the scene beat (replay cursor, or the latest event
 * when live), and whoever is active speaks. This is the centrepiece.
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

  // Scatter the crew around the central computer — seats around a round table.
  const placed = useMemo(() => {
    const n = agents.length || 1;
    return agents.map((a, i) => {
      const jitterA = (hash01(a.agent_id + "a") - 0.5) * 0.45;
      // Offset by half a slot so no one sits dead-top-centre (where the
      // Director's speech bubble rises) — crew straddle the centre instead.
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n + jitterA;
      const jr = 0.82 + hash01(a.agent_id + "r") * 0.32;
      const x = 50 + Math.cos(ang) * 31 * jr;
      const y = 52 + Math.sin(ang) * 23 * jr;
      const depth = Math.min(1, Math.max(0, (y - 28) / 50)); // 0 (back) .. 1 (front)
      const scale = 0.72 + depth * 0.62;
      return { agent: a, x, y, scale, z: Math.round(y * 12) };
    });
  }, [agents]);

  const pd = phaseDef(detail.run.phase);
  const caption = beat.line
    ? { who: beat.speaker === DIRECTOR ? "MISSION DIRECTOR" : beat.speaker || "", line: beat.line }
    : null;

  return (
    <section className={`bridge room${focused ? " focused" : ""}`}>
      {/* room backdrop layers */}
      <div className="room-space" aria-hidden />
      <div className="room-hull" aria-hidden>
        <span className="viewport vp1" />
        <span className="viewport vp2" />
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
        <button className="bridge-focus" onClick={onToggleFocus} title={focused ? "show console" : "theater mode"}>
          {focused ? "▣ CONSOLE" : "⛶ THEATER"}
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
