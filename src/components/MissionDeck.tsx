import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { CompareRow, ContextView, Message, RosterAgent, TeamDetail } from "../types";
import { phaseDef, phaseTone, isStalled } from "../lib/phases";
import { relTime, shortOid } from "../lib/format";
import { usePoll } from "../lib/usePoll";
import { PhaseRail } from "./PhaseRail";
import { Chip, Spinner } from "./ui";
import { DiffViewer } from "./DiffViewer";
import { SquadronRoster } from "./panels/SquadronRoster";
import { CandidatePanel } from "./panels/CandidatePanel";
import { GoNoGo } from "./panels/GoNoGo";
import { MissionLog } from "./panels/MissionLog";
import { CommsChannel } from "./panels/CommsChannel";
import { ContextStrip } from "./panels/ContextStrip";

/** The command deck for a single operation. Polls detail + compare live. */
export function MissionDeck({
  teamId,
  messages,
  roster,
  context,
  intervalMs,
  onBack,
  onError,
}: {
  teamId: string;
  messages: Message[];
  roster: RosterAgent[];
  context: ContextView | null;
  intervalMs: number;
  onBack: () => void;
  onError: (live: boolean) => void;
}) {
  const fetchDetail = useCallback((s: AbortSignal) => api.team(teamId, s), [teamId]);
  const fetchCompare = useCallback((s: AbortSignal) => api.compare(teamId, s), [teamId]);

  const detail = usePoll<TeamDetail>(fetchDetail, intervalMs);
  const compare = usePoll<CompareRow[]>(fetchCompare, intervalMs);

  const [modal, setModal] = useState<{ id: string; owner: string } | null>(null);

  useEffect(() => {
    onError(!detail.error);
  }, [detail.error, onError]);

  const crew = useMemo(
    () => new Set((detail.data?.run.agents ?? []).map((a) => a.agent_id)),
    [detail.data],
  );

  if (detail.loading && !detail.data) {
    return <Spinner label="ESTABLISHING UPLINK…" />;
  }
  if (detail.error && !detail.data) {
    return (
      <div className="errorbox">
        <div className="big">UPLINK FAILED</div>
        <div className="sml">{detail.error instanceof ApiError ? detail.error.message : String(detail.error)}</div>
        <button className="btn" onClick={onBack}>◂ Return to fleet</button>
      </div>
    );
  }
  if (!detail.data) return null;

  const { run, events, derived } = detail.data;
  const pd = phaseDef(run.phase);
  const tone = phaseTone(run.phase);
  const cmp = compare.data ?? [];

  return (
    <>
      <div className="deck-head">
        <div className="row1">
          <button className="back" onClick={onBack}>◂ FLEET</button>
          <div>
            <div className="mname">{run.name}</div>
            <div className="mid">{run.id} · OPENED BY @{run.created_by} · {relTime(run.created_at)}</div>
          </div>
          <span className="grow" style={{ flex: 1 }} />
          <Chip tone={tone === "go" ? "go" : tone === "hot" ? "hot" : tone === "live" ? "live" : "amber"} dot>
            {isStalled(run.phase) ? "NO-GO" : pd.label}
          </Chip>
        </div>
        <div className="row2">
          <PhaseRail phase={run.phase} />
          <div className="kv">
            <span className="k">base</span>
            <span className="v">{shortOid(run.base_oid, 12)}</span>
            <span className="k">round</span>
            <span className="v">{run.current_round} / {run.max_rounds}</span>
          </div>
        </div>
      </div>

      <div className="scroll">
        <div className="deck-grid">
          <div className="deck-col">
            <CandidatePanel run={run} verdict={derived.verdict} onOpen={(id, owner) => setModal({ id, owner })} />
            <GoNoGo run={run} verdict={derived.verdict} />
            <CommsChannel
              reviews={derived.reviews}
              discussions={derived.discussions}
              grants={derived.grants}
              messages={messages}
              crew={crew}
            />
          </div>
          <div className="deck-col">
            <SquadronRoster agents={run.agents} compare={cmp} roster={roster} />
            <MissionLog events={events} />
            <ContextStrip ctx={context} />
          </div>
        </div>
      </div>

      {modal && (
        <DiffViewer team={teamId} artifactId={modal.id} owner={modal.owner} onClose={() => setModal(null)} />
      )}
    </>
  );
}
