import type { TeamArtifact, TeamRun, TeamVerification, Verdict } from "../../types";
import { agentHue, relTime, shortOid } from "../../lib/format";
import { Chip, Panel } from "../ui";

/**
 * Candidate trajectories — every sealed submission with its diff envelope,
 * verifier gates, and a quick way to open the full flight plan (diff).
 */
export function CandidatePanel({
  run,
  verdict,
  onOpen,
}: {
  run: TeamRun;
  verdict: Verdict | null;
  onOpen: (artifactId: string, owner: string) => void;
}) {
  const subs = [...run.submissions].sort((a, b) => b.insertions + b.deletions - (a.insertions + a.deletions));
  const verBy = new Map<string, TeamVerification>();
  for (const v of run.verifications) verBy.set(v.submission_id, v);
  const winner = verdict?.selected_submission ?? null;
  const maxDelta = Math.max(1, ...subs.map((s) => s.insertions + s.deletions));

  return (
    <Panel title="Candidates" tag={`${subs.length} SEALED`}>
      {subs.length === 0 && (
        <div className="dim mono">— no candidates sealed yet · awaiting submissions —</div>
      )}
      {subs.map((s) => (
        <Candidate
          key={s.id}
          art={s}
          ver={verBy.get(s.id)}
          isWinner={s.id === winner}
          maxDelta={maxDelta}
          onOpen={() => onOpen(s.id, s.owner_agent)}
        />
      ))}
    </Panel>
  );
}

function Candidate({
  art,
  ver,
  isWinner,
  maxDelta,
  onOpen,
}: {
  art: TeamArtifact;
  ver?: TeamVerification;
  isWinner: boolean;
  maxDelta: number;
  onOpen: () => void;
}) {
  const hue = agentHue(art.owner_agent);
  const total = art.insertions + art.deletions;
  const scale = total / maxDelta;
  const addPct = total ? (art.insertions / total) * 100 : 50;

  return (
    <div className={`cand${isWinner ? " win" : ""}`}>
      <div className="cand-head">
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: `hsl(${hue} 90% 62%)`, boxShadow: `0 0 8px hsl(${hue} 90% 62%)` }} />
        <span className="who" style={{ color: `hsl(${hue} 90% 74%)` }}>{art.owner_agent}</span>
        {isWinner && <Chip tone="go" dot>SELECTED</Chip>}
        {art.independent ? <Chip tone="idle">independent</Chip> : <Chip tone="plasma">influenced</Chip>}
        <span className="grow" />
        <span className="faint mono" style={{ fontSize: 10 }}>r{art.round} · {relTime(art.submitted_at)}</span>
        <button className="btn ghost" onClick={onOpen}>◳ Flight plan</button>
      </div>
      <div className="cand-body">
        <div className="diffbar" style={{ width: `${30 + scale * 70}%` }}>
          <span className="add" style={{ width: `${addPct}%` }} />
          <span className="del" style={{ width: `${100 - addPct}%` }} />
        </div>
        <div className="statline">
          <span className="add">+{art.insertions}</span>
          <span className="del">−{art.deletions}</span>
          <span className="neu">{art.files_changed} file{art.files_changed === 1 ? "" : "s"}</span>
          <span className="neu">▦ {shortOid(art.commit_oid)}</span>
        </div>
        <div className="gates">
          <Gate ok={ver?.applies_cleanly} label={ver ? (ver.applies_cleanly ? "APPLIES CLEAN" : "CONFLICTS") : "APPLY UNTESTED"} />
          <Gate ok={ver?.tests_passed} label={ver ? (ver.tests_passed ? "VERIFIER PASS" : "VERIFIER FAIL") : "UNVERIFIED"} />
          {ver?.isolation && <span className="gate">⛨ {ver.isolation}</span>}
          {ver?.command?.length ? (
            <span className="gate" title={ver.command.join(" ")}>$ {ver.command.join(" ").slice(0, 28)}</span>
          ) : null}
          {ver?.failure && <span className="gate fail">✕ {ver.failure.slice(0, 40)}</span>}
        </div>
      </div>
    </div>
  );
}

function Gate({ ok, label }: { ok: boolean | undefined; label: string }) {
  const cls = ok === undefined ? "" : ok ? "pass" : "fail";
  const mark = ok === undefined ? "○" : ok ? "✓" : "✕";
  return (
    <span className={`gate ${cls}`}>
      {mark} {label}
    </span>
  );
}
