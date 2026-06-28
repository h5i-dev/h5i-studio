import type { Replay } from "../lib/useReplay";
import { clockTime } from "../lib/format";

export interface Mark {
  id: string;
  glyph: string;
  tone: "go" | "hot" | "live" | "amber" | "plasma" | "idle";
  label: string;
  actor: string;
  ts: string;
  radio: boolean;
}

/**
 * Mission-replay transport over the merged performance timeline (team events +
 * radio chatter). Scrubs the cursor; the Bridge + panels re-render to the
 * reconstructed state, and the active mark is spoken on stage.
 */
export function ReplayBar({ replay, marks }: { replay: Replay; marks: Mark[] }) {
  const { cursor, total, playing, speed, atEnd } = replay;
  const current = cursor > 0 ? marks[cursor - 1] : null;
  const pct = total > 0 ? (cursor / total) * 100 : 0;

  return (
    <div className="replaybar panel">
      <div className="rb-row">
        <span className="rb-tag">◉ MISSION REPLAY</span>
        <span className={`rb-loop${playing ? " on" : ""}`} title="playback loops continuously">⟳ LOOP</span>

        <div className="rb-transport">
          <button className="rb-btn" onClick={replay.toStart} title="to start" aria-label="to start">⏮</button>
          <button className="rb-btn play" onClick={replay.toggle} title="play / pause" aria-label="play/pause">
            {playing ? "⏸" : "▶"}
          </button>
          <button className="rb-btn" onClick={replay.toEnd} title="to live" aria-label="to live">⏭</button>
          <button className="rb-btn speed" onClick={replay.cycleSpeed} title="playback speed">{speed}×</button>
        </div>

        <div className="rb-readout">
          {current ? (
            <>
              <span className={`rb-kind${current.radio ? " radio" : ""}`}>
                {current.radio ? "⌁ " : ""}{current.label}
              </span>
              <span className="rb-actor">@{current.actor}</span>
              <span className="rb-time mono">{clockTime(current.ts)}</span>
            </>
          ) : (
            <span className="dim mono">— mission start —</span>
          )}
        </div>

        <span className="rb-count mono">
          {cursor} / {total}
          {atEnd && <span className="rb-live"> · LIVE</span>}
        </span>
        <button className="rb-exit" onClick={replay.exit}>EXIT ✕</button>
      </div>

      <div className="rb-scrub">
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={cursor}
          onChange={(e) => replay.seek(Number(e.target.value))}
          style={{ ["--pct" as string]: `${pct}%` }}
          aria-label="replay timeline"
        />
        <div className="rb-ticks">
          {marks.map((m, i) => {
            const on = i < cursor;
            return (
              <button
                key={m.id}
                className={`rb-tick t-${m.tone}${on ? " on" : ""}${m.radio ? " radio" : ""}${i === cursor - 1 ? " cur" : ""}`}
                style={{ left: `${total > 0 ? (i / total) * 100 : 0}%` }}
                title={`${m.label} · ${m.actor} · ${clockTime(m.ts)}`}
                onClick={() => replay.seek(i + 1)}
              >
                {m.glyph}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
