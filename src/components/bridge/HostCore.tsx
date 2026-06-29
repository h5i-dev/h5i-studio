/**
 * The Ship Core: a neutral room computer for operation-wide beats. It is not a
 * special agent persona; it just gives the crew deck a shared focal point.
 */
export function HostCore({
  speaking,
  line,
  mood,
}: {
  speaking: boolean;
  line: string | null;
  mood: "neutral" | "go" | "nogo";
}) {
  return (
    <div className={`host host--${mood}${speaking ? " speaking" : ""}`}>
      {speaking && line && (
        <div className="host-bubble">
          <span className="host-name">SHIP CORE</span>
          <span className="host-text">{line}</span>
        </div>
      )}

      <svg className="host-rig" viewBox="0 0 200 260" width="200" height="260" aria-label="central computer">
        <defs>
          <radialGradient id="cc-core" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="42%" stopColor="var(--host-c)" />
            <stop offset="100%" stopColor="var(--host-c2)" />
          </radialGradient>
          <linearGradient id="cc-col" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--host-c)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0a1730" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="cc-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--host-c)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--host-c)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* floor pad + shadow */}
        <ellipse cx="100" cy="246" rx="74" ry="13" fill="rgba(0,0,0,0.45)" />
        <ellipse className="cc-pad" cx="100" cy="244" rx="66" ry="11" fill="none" stroke="var(--host-c)" strokeWidth="1.5" opacity="0.5" />

        {/* hexagonal pedestal */}
        <path d="M58 244 L52 196 L78 178 L122 178 L148 196 L142 244 Z" fill="url(#cc-col)" stroke="var(--host-c)" strokeWidth="1.5" opacity="0.85" />
        {/* server light bars */}
        <g className="cc-bars">
          <rect x="70" y="192" width="60" height="4" rx="2" fill="var(--host-c)" opacity="0.8" />
          <rect x="72" y="202" width="56" height="4" rx="2" fill="var(--host-c)" opacity="0.55" />
          <rect x="74" y="212" width="52" height="4" rx="2" fill="var(--host-c)" opacity="0.8" />
          <rect x="76" y="222" width="48" height="4" rx="2" fill="var(--host-c)" opacity="0.45" />
        </g>

        {/* holo projection beam from pedestal up to the core */}
        <path className="cc-holo" d="M78 178 L92 92 L108 92 L122 178 Z" fill="url(#cc-beam)" />

        {/* orbital rings around the core */}
        <g className="cc-rings">
          <ellipse className="cc-r1" cx="100" cy="92" rx="46" ry="16" fill="none" stroke="var(--host-c)" strokeWidth="1.5" opacity="0.55" />
          <ellipse className="cc-r2" cx="100" cy="92" rx="34" ry="40" fill="none" stroke="var(--host-c)" strokeWidth="1" strokeDasharray="5 7" opacity="0.5" />
        </g>

        {/* the AI core / optic */}
        <g className="cc-core">
          <circle cx="100" cy="92" r="30" fill="url(#cc-core)" />
          <circle className="cc-pupil" cx="100" cy="92" r="12" fill="#04060e" />
          <circle className="cc-spark" cx="100" cy="92" r="4.5" fill="#fff" />
        </g>
      </svg>

      <div className="host-tag">SHIP CORE</div>
    </div>
  );
}
