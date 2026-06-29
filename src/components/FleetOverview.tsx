import type { TeamRun } from "../types";
import { phaseDef, phaseTone, isStalled } from "../lib/phases";
import { relTime, shortOid, pluralize } from "../lib/format";
import { PhaseRail } from "./PhaseRail";
import { ShipGlyph } from "./ShipGlyph";
import { Chip, Empty } from "./ui";

/** The hangar: every team run as a mission card. Click to enter the deck. */
export function FleetOverview({
  teams,
  onOpen,
}: {
  teams: TeamRun[];
  onOpen: (id: string) => void;
}) {
  if (teams.length === 0) {
    return (
      <div className="view-pad">
        <Empty
          title="NO ACTIVE OPERATIONS"
          hint={
            <>
              No <span className="codepill">h5i team</span> runs exist on this clone yet. Open one with{" "}
              <span className="codepill">h5i team create &lt;name&gt;</span>, bind envs with{" "}
              <span className="codepill">h5i team add-env</span>, and the operation will appear here.
            </>
          }
        />
      </div>
    );
  }

  const sorted = [...teams].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <div className="view-pad">
      <div className="section-title">
        <h2>TEAM OPERATIONS</h2>
        <span className="sub">{pluralize(teams.length, "MISSION")} · LIVE</span>
      </div>
      <div className="fleet-grid">
        {sorted.map((t) => (
          <MissionCard key={t.id} run={t} onOpen={() => onOpen(t.id)} />
        ))}
      </div>
    </div>
  );
}

function MissionCard({ run, onOpen }: { run: TeamRun; onOpen: () => void }) {
  const pd = phaseDef(run.phase);
  const tone = phaseTone(run.phase);
  const submitted = run.submissions.length;
  const verified = run.verifications.filter((v) => v.tests_passed).length;

  return (
    <div className="panel mission-card" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}>
      <div className="mc-head">
        <div className="mc-title">
          <div className="name">{run.name}</div>
          <div className="id">{run.id}</div>
        </div>
        <Chip tone={tone === "go" ? "go" : tone === "hot" ? "hot" : tone === "live" ? "live" : "idle"} dot>
          {isStalled(run.phase) ? "NO-GO" : pd.label}
        </Chip>
      </div>
      <div className="mc-body">
        <PhaseRail phase={run.phase} compact />
        <div className="mc-stats">
          <div className="mc-stat">
            <div className="n">{run.agents.length}</div>
            <div className="l">Crew</div>
          </div>
          <div className="mc-stat">
            <div className="n">{submitted}</div>
            <div className="l">Sealed</div>
          </div>
          <div className="mc-stat">
            <div className="n">
              {run.current_round}
              <span className="dim" style={{ fontSize: 12 }}>/{run.max_rounds}</span>
            </div>
            <div className="l">Round</div>
          </div>
        </div>
        <div className="rowflex" style={{ justifyContent: "space-between" }}>
          <div className="crew-strip">
            {run.agents.slice(0, 6).map((a) => (
              <span key={a.agent_id} style={{ marginLeft: -6 }} title={a.agent_id}>
                <ShipGlyph name={a.agent_id} size={30} />
              </span>
            ))}
          </div>
          <div className="rowflex">
            {verified > 0 && <Chip tone="go">{verified} ✓ VERIFIED</Chip>}
            <span className="faint mono" style={{ fontSize: 10 }}>
              base {shortOid(run.base_oid)} · {relTime(run.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
