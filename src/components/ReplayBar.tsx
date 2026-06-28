import type { TeamEvent } from "../types";
import type { Replay } from "../lib/useReplay";
import { describeEvent } from "../lib/events";
import { clockTime } from "../lib/format";

/**
 * Mission-replay transport. Scrubs the timestamped event log; the deck panels
 * re-render to the reconstructed state at the cursor as it plays forward.
 */
export function ReplayBar({ replay, events }: { replay: Replay; events: TeamEvent[] }) {
  const { cursor, total, playing, speed, atEnd } = replay;
  const current = cursor > 0 ? events[cursor - 1] : null;
  const viz = current ? describeEvent(current) : null;
  const pct = total > 0 ? (cursor / total) * 100 : 0;

  return (
    <div className="replaybar panel">
      <div className="rb-row">
        <span className="rb-tag">◉ MISSION REPLAY</span>

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
              <span className="rb-kind">{viz?.label}</span>
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
          {events.map((ev, i) => {
            const v = describeEvent(ev);
            const on = i < cursor;
            return (
              <button
                key={ev.id}
                className={`rb-tick t-${v.tone}${on ? " on" : ""}${i === cursor - 1 ? " cur" : ""}`}
                style={{ left: `${total > 0 ? (i / total) * 100 : 0}%` }}
                title={`${v.label} · ${clockTime(ev.ts)}`}
                onClick={() => replay.seek(i + 1)}
              >
                {v.glyph}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
