import { useEffect } from "react";
import type { CompareRow, RosterAgent, TeamAgent } from "../types";
import { agentHue, callsign, relTime, shortOid } from "../lib/format";
import { ShipGlyph } from "./ShipGlyph";
import { AgentStateBadge, Chip } from "./ui";

/**
 * Operative dossier — opened by tapping a crew member in the room. Shows the
 * agent's binding (env, isolation, runtime/model), current state, latest sealed
 * submission, live telemetry (from `team compare`) and radio presence.
 */
export function AgentProfile({
  agent,
  compare,
  roster,
  onClose,
  onFlightPlan,
}: {
  agent: TeamAgent;
  compare: CompareRow | null;
  roster: RosterAgent | null;
  onClose: () => void;
  onFlightPlan: (artifactId: string, owner: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hue = agentHue(agent.agent_id);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel agent-profile" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="ap-glyph">
            <ShipGlyph name={agent.agent_id} size={46} />
          </span>
          <h3 style={{ color: `hsl(${hue} 90% 76%)` }}>{agent.agent_id}</h3>
          <span className="tag mono">{callsign(agent.agent_id)}</span>
          <span className="grow" />
          <AgentStateBadge state={agent.state} />
          {roster?.online && <Chip tone="go" dot>ON RADIO</Chip>}
          <button className="x" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="panel-body stack">
          <div className="kv">
            <span className="k">env</span>
            <span className="v">{agent.env_id}</span>
            <span className="k">isolation</span>
            <span className="v">{agent.isolation_claim}</span>
            {agent.runtime && (
              <>
                <span className="k">runtime</span>
                <span className="v">{agent.runtime}{agent.model ? ` · ${agent.model}` : ""}</span>
              </>
            )}
            <span className="k">branch</span>
            <span className="v">{agent.branch_ref}</span>
            <span className="k">last seen</span>
            <span className="v">{roster?.lastSeen ? relTime(roster.lastSeen) : "—"}</span>
          </div>

          {compare && (
            <div>
              <div className="faint mono" style={{ fontSize: 9, letterSpacing: "0.2em", marginBottom: 6 }}>
                LIVE TELEMETRY
              </div>
              <div className="rowflex">
                <Chip tone={compare.status === "submitted" ? "live" : "amber"}>{compare.status}</Chip>
                {compare.last_tool && <Chip tone="amber">⚙ {compare.last_tool}</Chip>}
                {typeof compare.last_exit === "number" && (
                  <Chip tone={compare.last_exit === 0 ? "go" : "hot"}>exit {compare.last_exit}</Chip>
                )}
                {compare.submitted && (
                  <span className="statline">
                    <span className="add">+{compare.insertions}</span>
                    <span className="del">−{compare.deletions}</span>
                    <span className="neu">{compare.files_changed} file{compare.files_changed === 1 ? "" : "s"}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rowflex" style={{ justifyContent: "space-between" }}>
            <span className="faint mono" style={{ fontSize: 10 }}>
              {agent.latest_submission_id ? `▦ ${shortOid(agent.latest_submission_id, 28)}` : "no submission sealed"}
            </span>
            {agent.latest_submission_id && (
              <button
                className="btn"
                onClick={() => onFlightPlan(agent.latest_submission_id as string, agent.agent_id)}
              >
                ◳ Flight plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
