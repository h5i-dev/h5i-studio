import type { TeamRun, Verdict } from "../../types";
import { Chip, Panel } from "../ui";

/**
 * The launch-authority panel: renders the finalization verdict as a GO / HOLD /
 * NO-GO lamp with the winning candidate, the deciding rule, and the policy's
 * reasoning. Mirrors `h5i team finalize` exactly — read from the event log.
 */
export function GoNoGo({ run, verdict }: { run: TeamRun; verdict: Verdict | null }) {
  const winnerArt = verdict?.selected_submission
    ? run.submissions.find((s) => s.id === verdict.selected_submission)
    : undefined;

  let lamp: "go" | "hold" | "nogo";
  let word: string;
  if (verdict?.selected_submission && verdict.can_auto_apply) {
    lamp = "go";
    word = run.phase === "applied" ? "LAUNCHED" : "GO";
  } else if (verdict?.selected_submission) {
    lamp = "hold";
    word = "HOLD";
  } else {
    lamp = "nogo";
    word = "NO-GO";
  }

  return (
    <Panel
      title="Launch Authority"
      tag="FINALIZATION POLICY"
      right={
        verdict?.resolved === false ? <Chip tone="hot">UNRESOLVED</Chip> : verdict ? <Chip tone="live">EVALUATED</Chip> : <Chip tone="idle">PENDING</Chip>
      }
    >
      <div className="gonogo">
        <div className={`gng-lamp ${lamp}`}>{word}</div>
        <div className="gng-info">
          {winnerArt ? (
            <div className="rowflex" style={{ marginBottom: 8 }}>
              <span className="mono" style={{ color: "var(--go)", fontSize: 14 }}>★ {winnerArt.owner_agent}</span>
              <span className="faint mono" style={{ fontSize: 10 }}>{winnerArt.id}</span>
            </div>
          ) : (
            <div className="dim mono" style={{ marginBottom: 8 }}>no candidate cleared for launch</div>
          )}
          {verdict ? (
            <>
              <div className="method">
                <span className="faint">RULE </span>
                {verdict.method}
                <span className="faint"> · BY </span>
                {verdict.decided_by}
              </div>
              {verdict.reasons.length > 0 && (
                <ul className="reasons">
                  {verdict.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="rowflex" style={{ marginTop: 10 }}>
                <Chip tone={verdict.can_auto_apply ? "go" : "amber"} dot>
                  {verdict.can_auto_apply ? "AUTO-APPLY CLEARED" : "MANUAL REVIEW REQUIRED"}
                </Chip>
              </div>
            </>
          ) : (
            <div className="dim mono">
              Finalization has not been evaluated. Seal the round and run the neutral verifier, then{" "}
              <span className="codepill">h5i team finalize</span> records a verdict.
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
