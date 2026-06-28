import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { CompareRow, ContextView, Message, RosterAgent, TeamDetail } from "../types";
import { phaseDef, phaseTone, isStalled } from "../lib/phases";
import { relTime, shortOid } from "../lib/format";
import { usePoll } from "../lib/usePoll";
import { useReplay } from "../lib/useReplay";
import { reconstructFromEvents } from "../lib/replay";
import { describeEvent } from "../lib/events";
import type { ActiveSource } from "../lib/performance";
import { PhaseRail } from "./PhaseRail";
import { ReplayBar, type Mark } from "./ReplayBar";
import { Bridge } from "./bridge/Bridge";
import { Chip, Spinner } from "./ui";
import { DiffViewer } from "./DiffViewer";
import { SquadronRoster } from "./panels/SquadronRoster";
import { CandidatePanel } from "./panels/CandidatePanel";
import { GoNoGo } from "./panels/GoNoGo";
import { MissionLog } from "./panels/MissionLog";
import { CommsChannel } from "./panels/CommsChannel";
import { ContextStrip } from "./panels/ContextStrip";

interface TimelineItem {
  ts: string;
  src: ActiveSource;
}

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
  const [focused, setFocused] = useState(false);
  const live = detail.data;

  // Crew = the operation's roster (from live state, so it is stable across the
  // replay cursor). Used to scope radio chatter and to voice messages.
  const crew = useMemo(() => new Set((live?.run.agents ?? []).map((a) => a.agent_id)), [live]);

  // The merged performance timeline: authoritative team events woven together
  // with the radio traffic between this crew, in chronological order. This is
  // what the replay cursor scrubs and what the Bridge performs.
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!live) return [];
    const items: TimelineItem[] = live.events.map((e) => ({ ts: e.ts, src: { type: "event", event: e } }));
    for (const m of messages) {
      if (!m.ts) continue;
      const involved = crew.has(m.from) || crew.has(m.to) || m.to === "all";
      if (!involved) continue;
      if (m.kind === "REVIEW_REQUEST") continue; // already shown as a grant event
      if (/team round complete/i.test(m.body)) continue; // system noise
      items.push({ ts: m.ts, src: { type: "message", message: m } });
    }
    return items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  }, [live, messages, crew]);

  const replay = useReplay(timeline.length);

  useEffect(() => {
    onError(!detail.error);
  }, [detail.error, onError]);

  // Marks for the scrubber: one per timeline item (events + radio).
  const marks = useMemo<Mark[]>(
    () =>
      timeline.map((it) => {
        if (it.src.type === "event") {
          const v = describeEvent(it.src.event);
          return { id: it.src.event.id, glyph: v.glyph, tone: v.tone, label: v.label, actor: it.src.event.actor, ts: it.ts, radio: false };
        }
        const m = it.src.message;
        return { id: `msg-${m.idx}`, glyph: "⌁", tone: "plasma", label: `RADIO · ${m.kind}`, actor: m.from, ts: it.ts, radio: true };
      }),
    [timeline],
  );

  // Resolve the current frame from the cursor.
  const cursor = replay.active ? replay.cursor : timeline.length;
  const eventsPrefix = useMemo(
    () => timeline.slice(0, cursor).flatMap((it) => (it.src.type === "event" ? [it.src.event] : [])),
    [timeline, cursor],
  );

  const view = useMemo<TeamDetail | null>(
    () => (replay.active && live ? reconstructFromEvents(eventsPrefix, live.run) : live),
    [replay.active, eventsPrefix, live],
  );

  const active: ActiveSource | null = replay.active
    ? cursor > 0
      ? timeline[cursor - 1].src
      : null
    : timeline.length
      ? timeline[timeline.length - 1].src
      : null;

  const frameTs = replay.active && cursor > 0 ? timeline[cursor - 1].ts : null;
  const highlightId =
    active?.type === "event" ? active.event.id : eventsPrefix.length ? eventsPrefix[eventsPrefix.length - 1].id : null;

  const shownMessages = useMemo(() => {
    if (!replay.active || !frameTs) return messages;
    return messages.filter((m) => !m.ts || m.ts <= frameTs);
  }, [replay.active, frameTs, messages]);

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
          {!replay.active && timeline.length > 0 && (
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

      {replay.active && <ReplayBar replay={replay} marks={marks} />}

      <div className="scroll">
        <Bridge
          detail={view}
          active={active}
          crew={crew}
          focused={focused}
          replaying={replay.active}
          onToggleFocus={() => setFocused((f) => !f)}
        />

        {!focused && (
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
        )}
      </div>

      {modal && (
        <DiffViewer team={teamId} artifactId={modal.id} owner={modal.owner} onClose={() => setModal(null)} />
      )}
    </>
  );
}
