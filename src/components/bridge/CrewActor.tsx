import type { ActorState } from "../../lib/performance";
import { agentHue, callsign, hash01 } from "../../lib/format";

const STATE_LABEL: Record<ActorState, string> = {
  idle: "STANDBY",
  speaking: "ON COMMS",
  thinking: "REVIEWING",
  sealed: "SEALED",
  cleared: "CLEARED",
  failed: "FAILED",
  winner: "LAUNCH",
};

/**
 * A crew member — an anthropomorphised agent. A helmeted pilot drawn in the
 * agent's livery (no assets), whose posture is driven by the scene beat: bobbing
 * on standby, leaning forward on comms (with a speech bubble carrying the actual
 * review/discussion text), heads-down reviewing, shaking when the verifier fails,
 * rising on a launch beam when chosen.
 */
export function CrewActor({
  name,
  state,
  line,
  speaking,
  x,
  y,
}: {
  name: string;
  state: ActorState;
  line: string | null;
  speaking: boolean;
  x: number;
  y: number;
}) {
  const hue = agentHue(name);
  const dur = 4 + hash01(name) * 2.5; // 4–6.5s ambient bob, desynced per agent
  const delay = -hash01(name + "d") * 5;
  const sway = 6 + hash01(name + "s") * 8;

  return (
    <div
      className={`actor actor--${state}${speaking ? " speaking" : ""}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ["--hue" as string]: String(hue),
        ["--bob" as string]: `${dur}s`,
        ["--bob-delay" as string]: `${delay}s`,
        ["--sway" as string]: `${sway}px`,
      }}
    >
      {line && speaking && (
        <div className="bubble">
          <span className="bubble-name">{name}</span>
          <span className="bubble-text">{line}</span>
        </div>
      )}

      <div className="actor-body">
        <Pilot hue={hue} />
        <div className="thought">
          <i></i><i></i><i></i>
        </div>
        <div className="beam" />
        <div className="aura" />
      </div>

      <div className="nametag">
        <b style={{ color: `hsl(${hue} 90% 74%)` }}>{name}</b>
        <span className="cs">{callsign(name)}</span>
        <span className={`st st--${state}`}>{STATE_LABEL[state]}</span>
      </div>
    </div>
  );
}

function Pilot({ hue }: { hue: number }) {
  const gid = `p${Math.round(hue)}`;
  return (
    <svg className="pilot" viewBox="0 0 120 150" width="92" height="115" aria-hidden>
      <defs>
        <linearGradient id={`${gid}-suit`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 40% 26%)`} />
          <stop offset="100%" stopColor={`hsl(${hue} 45% 14%)`} />
        </linearGradient>
        <radialGradient id={`${gid}-visor`} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={`hsl(${hue} 95% 70%)`} />
          <stop offset="100%" stopColor={`hsl(${hue} 90% 32%)`} />
        </radialGradient>
      </defs>

      {/* drop shadow on the deck */}
      <ellipse className="shadow" cx="60" cy="144" rx="30" ry="6" fill="rgba(0,0,0,0.5)" />

      {/* torso / flight suit */}
      <path
        d="M30 150 Q28 96 42 86 L78 86 Q92 96 90 150 Z"
        fill={`url(#${gid}-suit)`}
        stroke={`hsl(${hue} 80% 55%)`}
        strokeWidth="1.5"
      />
      {/* shoulder lights */}
      <circle cx="40" cy="96" r="3" fill={`hsl(${hue} 95% 70%)`} />
      <circle cx="80" cy="96" r="3" fill={`hsl(${hue} 95% 70%)`} />
      {/* chest core */}
      <circle className="core" cx="60" cy="112" r="6" fill={`hsl(${hue} 95% 65%)`} />
      <circle cx="60" cy="112" r="2.5" fill="#fff" />

      {/* helmet */}
      <g className="head">
        <ellipse cx="60" cy="54" rx="34" ry="36" fill={`hsl(${hue} 30% 20%)`} stroke={`hsl(${hue} 80% 58%)`} strokeWidth="2" />
        {/* visor */}
        <path d="M40 44 Q60 30 80 44 Q82 64 60 70 Q38 64 40 44 Z" fill={`url(#${gid}-visor)`} />
        {/* visor glint */}
        <ellipse className="glint" cx="52" cy="46" rx="6" ry="3" fill="#fff" opacity="0.85" />
        {/* antenna */}
        <line x1="84" y1="30" x2="92" y2="16" stroke={`hsl(${hue} 80% 60%)`} strokeWidth="2" />
        <circle className="ant" cx="92" cy="14" r="3" fill={`hsl(${hue} 95% 70%)`} />
      </g>
    </svg>
  );
}
