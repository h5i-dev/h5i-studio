import type { ActorState } from "../../lib/performance";
import { agentHue, callsign, hash01 } from "../../lib/format";

const STATE_LABEL: Record<ActorState, string> = {
  idle: "STANDBY",
  speaking: "ON COMMS",
  thinking: "THINKING",
  sealed: "SEALED",
  cleared: "CLEARED",
  failed: "FAILED",
  winner: "LAUNCH",
};

/**
 * A crew member: every agent gets the same little space-suit avatar treatment,
 * varied only by deterministic livery color. The posture is driven by the scene
 * beat: standby bob, comms lean, thinking dots, failure shake, and launch lift.
 */
export function CrewActor({
  name,
  state,
  line,
  speaking,
  x,
  y,
  scale = 1,
  z = 1,
  onSelect,
}: {
  name: string;
  state: ActorState;
  line: string | null;
  speaking: boolean;
  x: number;
  y: number;
  scale?: number;
  z?: number;
  onSelect?: (name: string) => void;
}) {
  const hue = agentHue(name);
  const dur = 4 + hash01(name) * 2.5; // 4–6.5s ambient bob, desynced per agent
  const delay = -hash01(name + "d") * 5;
  const sway = 6 + hash01(name + "s") * 8;

  return (
    <div
      className={`actor actor--${state}${speaking ? " speaking" : ""}${onSelect ? " clickable" : ""}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: speaking ? 900 : z,
        ["--scale" as string]: String(scale),
        ["--hue" as string]: String(hue),
        ["--bob" as string]: `${dur}s`,
        ["--bob-delay" as string]: `${delay}s`,
        ["--sway" as string]: `${sway}px`,
      }}
      onClick={onSelect ? () => onSelect(name) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect(name) : undefined}
      title={onSelect ? `${name} — open dossier` : undefined}
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

      {/* inked deck shadow */}
      <ellipse className="shadow" cx="60" cy="144" rx="32" ry="7" fill="rgba(13,11,22,0.5)" />

      {/* chunky suit body */}
      <path
        d="M28 150 Q27 103 38 88 Q48 80 60 82 Q72 80 82 88 Q93 103 92 150 Z"
        fill={`url(#${gid}-suit)`}
        stroke="#10101a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M36 105 Q47 96 60 98 Q73 96 84 105" fill="none" stroke={`hsl(${hue} 80% 68%)`} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <rect x="46" y="112" width="28" height="14" rx="7" fill="#f8f0d0" stroke="#10101a" strokeWidth="3" />
      <circle className="core" cx="60" cy="119" r="3.4" fill={`hsl(${hue} 95% 58%)`} />

      {/* helmet */}
      <g className="head">
        <ellipse cx="60" cy="55" rx="35" ry="37" fill={`hsl(${hue} 58% 45%)`} stroke="#10101a" strokeWidth="4" />
        <path d="M38 49 Q47 32 68 34 Q84 37 85 52 Q84 67 64 72 Q45 72 39 61 Q36 55 38 49 Z" fill={`url(#${gid}-visor)`} stroke="#10101a" strokeWidth="4" strokeLinejoin="round" />
        <path d="M48 43 Q58 36 74 40" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <ellipse className="glint" cx="51" cy="51" rx="5" ry="2.8" fill="#fff" opacity="0.85" />
        <line x1="84" y1="31" x2="93" y2="17" stroke="#10101a" strokeWidth="5" strokeLinecap="round" />
        <line x1="84" y1="31" x2="93" y2="17" stroke={`hsl(${hue} 92% 68%)`} strokeWidth="2.5" strokeLinecap="round" />
        <circle className="ant" cx="93" cy="15" r="4.5" fill="#ffe66d" stroke="#10101a" strokeWidth="3" />
      </g>
    </svg>
  );
}
