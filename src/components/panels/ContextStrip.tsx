import type { ContextView } from "../../types";
import { Chip, Panel } from "../ui";

/** The shared reasoning workspace (`h5i recall context`) — goal, milestones, trace. */
export function ContextStrip({ ctx }: { ctx: ContextView | null }) {
  if (!ctx || !ctx.available) {
    return (
      <Panel title="Nav Log" tag="CONTEXT">
        <div className="dim mono">
          {ctx?.error ? `unavailable — ${ctx.error}` : "no context workspace on this branch"}
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      title="Nav Log"
      tag="SHARED CONTEXT"
      right={ctx.gitBranch ? <Chip tone="idle">⎇ {ctx.gitBranch}</Chip> : undefined}
    >
      <div className="stack">
        {ctx.goal && (
          <div>
            <div className="faint mono" style={{ fontSize: 9, letterSpacing: "0.2em" }}>OBJECTIVE</div>
            <div className="ctx-goal">{ctx.goal}</div>
          </div>
        )}

        {ctx.milestones.length > 0 && (
          <div>
            <div className="faint mono" style={{ fontSize: 9, letterSpacing: "0.2em", marginBottom: 4 }}>
              MILESTONES
            </div>
            {ctx.milestones.slice(-6).map((m, i) => (
              <div className={`ctx-mile${m.done ? " done" : ""}`} key={i}>
                <span className="box">{m.done ? "✓" : ""}</span>
                <span className={m.done ? "dim" : ""}>{m.text}</span>
              </div>
            ))}
          </div>
        )}

        {ctx.trace.length > 0 && (
          <div>
            <div className="faint mono" style={{ fontSize: 9, letterSpacing: "0.2em", marginBottom: 4 }}>
              RECENT TRACE
            </div>
            <div className="trace">
              {ctx.trace.slice(-14).reverse().map((t, i) => (
                <div className="trace-row" key={i}>
                  <span className="tt">{t.time}</span>
                  <span className={`tk ${t.kind}`}>{t.kind}</span>
                  <span className="tx">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
