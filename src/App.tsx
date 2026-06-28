import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { ContextView, Health, Message, RosterAgent, TeamRun } from "./types";
import { usePoll } from "./lib/usePoll";
import { Starfield } from "./components/Starfield";
import { FleetOverview } from "./components/FleetOverview";
import { MissionDeck } from "./components/MissionDeck";
import { Spinner } from "./components/ui";

const FAST = 4000; // active deck refresh
const SLOW = 8000; // fleet / ambient refresh

export default function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [deckLive, setDeckLive] = useState(true);

  // Ambient global feeds, polled once and shared with the active deck.
  const teams = usePoll<TeamRun[]>(useCallback((s: AbortSignal) => api.teams(s), []), SLOW);
  const messages = usePoll<Message[]>(useCallback((s: AbortSignal) => api.messages(80, s), []), FAST);
  const roster = usePoll<RosterAgent[]>(useCallback((s: AbortSignal) => api.roster(s), []), SLOW);
  const context = usePoll<ContextView>(useCallback((s: AbortSignal) => api.context(s), []), SLOW);
  const health = usePoll<Health>(useCallback((s: AbortSignal) => api.health(s), []), SLOW);

  // Deep-link the selected team via the URL hash.
  useEffect(() => {
    const apply = () => {
      const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, "")).trim();
      setSelected(h || null);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const open = useCallback((id: string) => {
    window.location.hash = `#/${encodeURIComponent(id)}`;
  }, []);
  const back = useCallback(() => {
    window.location.hash = "";
  }, []);

  const connected = !teams.error && (selected ? deckLive : true);
  const liveStale = Date.now() - teams.lastOk > SLOW * 3;

  return (
    <div className="app">
      <Starfield />
      <div className="scanlines" />
      <div className="vignette" />

      <header className="topbar">
        <div className="brand" onClick={back} title="Return to fleet">
          <Sigil />
          <div className="wordmark">
            <b>H5I</b>
            <span>FLEET COMMAND</span>
          </div>
        </div>

        <div className="spacer" />

        <div className="stat">
          <span className="k">Operations</span>
          <span className="v">{teams.data?.length ?? "—"}</span>
        </div>
        <div className="stat">
          <span className="k">Repository</span>
          <span className="v">{health.data ? baseName(health.data.repo) : "—"}</span>
        </div>
        <div className="stat">
          <span className="k">h5i core</span>
          <span className="v">{health.data?.version?.replace(/^h5i\s*/, "") ?? "—"}</span>
        </div>
        <div className="stat">
          <span className="k">Uplink</span>
          <span className="v">
            <span className={`live-pip${!connected ? " err" : liveStale ? " stale" : ""}`}>
              <i />
              {!connected ? "LOST" : liveStale ? "IDLE" : "LIVE"}
            </span>
          </span>
        </div>
      </header>

      {teams.loading && !teams.data ? (
        <div className="scroll">
          <Spinner label="SCANNING FOR OPERATIONS…" />
        </div>
      ) : selected ? (
        <MissionDeck
          key={selected}
          teamId={selected}
          messages={messages.data ?? []}
          roster={roster.data ?? []}
          context={context.data ?? null}
          intervalMs={FAST}
          onBack={back}
          onError={setDeckLive}
        />
      ) : (
        <div className="scroll">
          {teams.error ? (
            <div className="errorbox">
              <div className="big">NO UPLINK TO H5I CORE</div>
              <div className="sml">
                {String((teams.error as Error)?.message ?? teams.error)}. Confirm the API server is running and{" "}
                <span className="codepill">h5i</span> is on PATH for the target repository.
              </div>
            </div>
          ) : (
            <FleetOverview teams={teams.data ?? []} onOpen={open} />
          )}
        </div>
      )}
    </div>
  );
}

function baseName(p: string): string {
  return p.replace(/\/+$/, "").split("/").pop() || p;
}

function Sigil() {
  return (
    <svg className="sigil" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="sig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ff7ff" />
          <stop offset="100%" stopColor="#c46bff" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#sig)" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="url(#sig)" strokeWidth="1" opacity="0.35" />
      <path d="M50 14 L78 78 L50 64 L22 78 Z" fill="url(#sig)" stroke="#9fe8ff" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="4" fill="#fff" />
    </svg>
  );
}
