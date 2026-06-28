import type { TeamEvent } from "../../types";
import { clockTime, relTime } from "../../lib/format";
import { describeEvent } from "../../lib/events";
import { Panel } from "../ui";

const TONE_COLOR: Record<string, string> = {
  go: "var(--go)",
  hot: "var(--hot)",
  live: "var(--phosphor)",
  amber: "var(--amber)",
  plasma: "var(--plasma)",
  idle: "var(--idle)",
};

/** The flight recorder: the append-only event log, newest first. */
export function MissionLog({ events, highlightId }: { events: TeamEvent[]; highlightId?: string | null }) {
  const rows = [...events].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return (
    <Panel title="Flight Recorder" tag={`${events.length} EVENTS`}>
      {rows.length === 0 && <div className="dim mono">— no telemetry —</div>}
      <div className="log">
        {rows.map((ev) => {
          const v = describeEvent(ev);
          const color = TONE_COLOR[v.tone] || "var(--phosphor)";
          return (
            <div className={`log-row${ev.id === highlightId ? " cur" : ""}`} key={ev.id}>
              <span className="node" style={{ color, borderColor: color }}>
                {v.glyph}
              </span>
              <div className="body">
                <div className="line1">
                  <div className="line1-main">
                    <span className="kind" style={{ color }}>{v.label}</span>
                    <span className="actor">@{ev.actor}</span>
                    {ev.phase_after && ev.phase_after !== ev.phase_before && (
                      <span className="faint mono" style={{ fontSize: 9, whiteSpace: "nowrap" }}>→ {ev.phase_after}</span>
                    )}
                  </div>
                  <span className="t" title={ev.ts}>
                    {clockTime(ev.ts)} · {relTime(ev.ts)}
                  </span>
                </div>
                {v.detail && <div className="detail">{v.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
