import { useMemo } from "react";
import { agentHue, hash01 } from "../lib/format";

/**
 * A deterministic starfighter insignia generated purely from the agent's
 * call-sign — same name always yields the same craft + livery hue. No assets,
 * no network: an SVG procedurally varied by a stable hash so every operative
 * reads as a distinct ship on the deck.
 */
export function ShipGlyph({ name, size = 46 }: { name: string; size?: number }) {
  const { hue, path, wing } = useMemo(() => {
    const h = agentHue(name);
    const r1 = hash01(name + "a");
    const r2 = hash01(name + "b");
    const variant = Math.floor(hash01(name + "v") * 3);
    // Three fuselage silhouettes (interceptor / cruiser / scout).
    const bodies = [
      "M50 6 L70 60 L50 50 L30 60 Z",
      "M50 8 L64 36 L62 64 L38 64 L36 36 Z",
      "M50 4 L60 30 L74 64 L50 54 L26 64 L40 30 Z",
    ];
    const wings = [
      "M30 60 L8 74 L34 56 Z M70 60 L92 74 L66 56 Z",
      "M36 40 L6 52 L38 50 Z M64 40 L94 52 L62 50 Z",
      "M26 64 L4 80 L34 60 Z M74 64 L96 80 L66 60 Z",
    ];
    return { hue: h, path: bodies[variant], wing: wings[variant], r1, r2 };
  }, [name]);

  const gid = `g-${name.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 100 100" aria-label={`${name} craft`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 95% 72%)`} />
          <stop offset="100%" stopColor={`hsl(${hue + 18} 80% 42%)`} />
        </linearGradient>
        <radialGradient id={`${gid}-c`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor={`hsl(${hue} 95% 60%)`} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke={`hsl(${hue} 80% 55% / 0.25)`} strokeWidth="1" />
      <path d={wing} fill={`hsl(${hue} 70% 38%)`} stroke={`hsl(${hue} 90% 60%)`} strokeWidth="1.4" />
      <path d={path} fill={`url(#${gid})`} stroke={`hsl(${hue} 95% 78%)`} strokeWidth="1.6" />
      <circle cx="50" cy="40" r="6" fill={`url(#${gid}-c)`} />
      <circle cx="50" cy="40" r="2.6" fill="#fff" />
    </svg>
  );
}
