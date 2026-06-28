/**
 * The Mission Director — the operation's host/narrator, drawn as the ship's AI
 * core (a sentient optic). It is the space-fleet analogue of agmsg-office's boss
 * character: it opens the operation, calls the round sealed, and announces the
 * GO / NO-GO verdict.
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
          <span className="host-name">MISSION DIRECTOR</span>
          <span className="host-text">{line}</span>
        </div>
      )}
      <div className="host-core" aria-label="mission director">
        <svg viewBox="0 0 120 120" width="84" height="84">
          <defs>
            <radialGradient id="hc" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="var(--host-c)" />
              <stop offset="100%" stopColor="var(--host-c2)" />
            </radialGradient>
          </defs>
          <circle className="ring r1" cx="60" cy="60" r="54" fill="none" stroke="var(--host-c)" strokeWidth="1.5" opacity="0.4" />
          <circle className="ring r2" cx="60" cy="60" r="44" fill="none" stroke="var(--host-c)" strokeWidth="1" strokeDasharray="6 8" opacity="0.6" />
          <circle cx="60" cy="60" r="30" fill="url(#hc)" />
          <circle className="pupil" cx="60" cy="60" r="11" fill="#04060e" />
          <circle className="spark" cx="60" cy="60" r="4" fill="#fff" />
        </svg>
      </div>
      <div className="host-tag">MISSION DIRECTOR</div>
    </div>
  );
}
