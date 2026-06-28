import type { CompareRow, RosterAgent, TeamAgent } from "../../types";
import { agentHue, callsign, relTime } from "../../lib/format";
import { ShipGlyph } from "../ShipGlyph";
import { AgentStateBadge, Chip, Panel } from "../ui";

/** The crew manifest: one craft per team agent with live env telemetry. */
export function SquadronRoster({
  agents,
  compare,
  roster,
}: {
  agents: TeamAgent[];
  compare: CompareRow[];
  roster: RosterAgent[];
}) {
  const cmpBy = new Map(compare.map((c) => [c.agent_id, c]));
  const seenBy = new Map(roster.map((r) => [r.name, r]));

  return (
    <Panel title="Squadron" tag={`${agents.length} CRAFT`}>
      {agents.length === 0 && <div className="dim mono">— no operatives assigned —</div>}
      {agents.map((a) => {
        const c = cmpBy.get(a.agent_id);
        const seen = seenBy.get(a.agent_id);
        const hue = agentHue(a.agent_id);
        return (
          <div className="ship" key={a.agent_id}>
            <span style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 120% at 0% 0%, hsl(${hue} 80% 50% / 0.10), transparent 60%)`, pointerEvents: "none" }} />
            <ShipGlyph name={a.agent_id} />
            <div className="meta">
              <div className="cs">
                <b style={{ color: `hsl(${hue} 90% 72%)` }}>{a.agent_id}</b>
                <span className="faint mono" style={{ fontSize: 9 }}>{callsign(a.agent_id)}</span>
                {seen?.online && <Chip tone="go" dot>ON RADIO</Chip>}
              </div>
              <div className="env">⌖ {a.env_id}</div>
              <div className="sub">
                <Chip tone="idle">{a.isolation_claim}</Chip>
                {a.runtime && <Chip tone="plasma">{a.runtime}</Chip>}
                {a.model && <Chip tone="idle">{a.model}</Chip>}
                {c?.last_tool && <Chip tone="amber">⚙ {c.last_tool}</Chip>}
                {c && typeof c.last_exit === "number" && (
                  <Chip tone={c.last_exit === 0 ? "go" : "hot"}>exit {c.last_exit}</Chip>
                )}
                {a.latest_submission_id && (
                  <span className="faint mono" style={{ fontSize: 9 }}>{a.latest_submission_id}</span>
                )}
                {seen?.lastSeen && (
                  <span className="faint mono" style={{ fontSize: 9 }}>seen {relTime(seen.lastSeen)}</span>
                )}
              </div>
            </div>
            <span className="state-led">
              <AgentStateBadge state={a.state} />
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
