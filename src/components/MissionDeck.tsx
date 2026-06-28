import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { CompareRow, ContextView, Message, RosterAgent, TeamDetail } from "../types";
import { phaseDef, phaseTone, isStalled } from "../lib/phases";
import { relTime, shortOid } from "../lib/format";
import { usePoll } from "../lib/usePoll";
import { useReplay } from "../lib/useReplay";
import { reconstruct, sortedAsc } from "../lib/replay";
import { PhaseRail } from "./PhaseRail";
import { ReplayBar } from "./ReplayBar";
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
  const live = detail.data;
  const replay = useReplay(live?.events.length ?? 0);

  useEffect(() => {
    onError(!detail.error);
  }, [detail.error, onError]);

  const ascEvents = useMemo(() => (live ? sortedAsc(live.events) : []), [live]);

  // The deck renders `view`: the live detail, or the reconstructed state at the
  // replay cursor when replay is engaged.
  const view = useMemo(
    () => (replay.active && live ? reconstruct(live.events, live.run, replay.cursor) : live),
    [replay.active, replay.cursor, live],
  );

  const frameTs = replay.active && view && view.events.length ? view.events[view.events.length - 1].ts : null;
  const highlightId = frameTs ? view!.events[view!.events.length - 1].id : null;

  const shownMessages = useMemo(() => {
    if (!replay.active || !frameTs) return messages;
    return messages.filter((m) => !m.ts || m.ts <= frameTs);
  }, [replay.active, frameTs, messages]);

  const crew = useMemo(
    () => new Set((view?.run.agents ?? []).map((a) => a.agent_id)),
    [view],
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
  if (!view || !live) return null;

  const { run, events, derived } = view;
  const pd = phaseDef(run.phase);
  const tone = phaseTone(run.phase);
  const shownCompare = replay.active ? [] : compare.data ?? [];

  return (
    <>
      <div className="deck-head">
        <div className="row1">
          <button className="back" onClick={onBack}>◂ FLEET</button>
          <div>
            <div className="mname">{live.run.name}</div>
            <div className="mid">{live.run.id} · OPENED BY @{live.run.created_by} · {relTime(live.run.created_at)}</div>
          </div>
          <span className="grow" style={{ flex: 1 }} />
          {!replay.active && live.events.length > 0 && (
            <button className="btn replay-toggle" onClick={replay.enter} title="Replay this operation">
              ◉ REPLAY
            </button>
          )}
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

      {replay.active && <ReplayBar replay={replay} events={ascEvents} />}

      <div className="scroll">
        <div className="deck-grid">
          <div className="deck-col">
            <CandidatePanel run={run} verdict={derived.verdict} onOpen={(id, owner) => setModal({ id, owner })} />
            <GoNoGo run={run} verdict={derived.verdict} />
            <CommsChannel
              reviews={derived.reviews}
              discussions={derived.discussions}
              grants={derived.grants}
              messages={shownMessages}
              crew={crew}
            />
          </div>
          <div className="deck-col">
            <SquadronRoster agents={run.agents} compare={shownCompare} roster={roster} />
            <MissionLog events={events} highlightId={highlightId} />
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
