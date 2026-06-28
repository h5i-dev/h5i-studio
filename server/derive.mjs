// Pure event-log projection. Folds the append-only `team status` event stream
// into the higher-order objects a viewer wants but that the installed
// `team status --json` does not include directly: the latest finalization
// verdict, peer reviews, review grants and post-freeze discussion. Pure → see
// test/derive.test.mjs.

function str(v) {
  return v == null ? "" : String(v);
}

export function derive(run, events) {
  const reviews = [];
  const grants = [];
  const discussions = [];
  let verdict = run?.verdict ?? null;

  for (const ev of events || []) {
    const p = ev.payload || {};
    switch (ev.kind) {
      case "review_submitted":
        reviews.push({
          id: ev.id,
          ts: ev.ts,
          reviewer: p.reviewer,
          target: p.target,
          body: str(p.body).trim(),
          round: p.round ?? ev.round,
          artifacts: p.referenced_artifacts || [],
        });
        break;
      case "review_granted":
        grants.push({
          id: ev.id,
          ts: ev.ts,
          reviewer: p.reviewer,
          target: p.target,
          round: p.round ?? ev.round,
          kinds: p.artifact_kinds || [],
          artifacts: p.artifact_ids || [],
        });
        break;
      case "discussion":
      case "discussed":
        discussions.push({
          id: ev.id,
          ts: ev.ts,
          from: p.from || p.sender,
          to: p.to || p.recipients || [],
          body: str(p.body).trim(),
          round: p.round ?? ev.round,
          artifacts: p.referenced_artifacts || p.artifacts || [],
        });
        break;
      case "verdict":
      case "no_verdict":
        verdict = {
          selected_submission: p.selected_submission ?? null,
          method: p.method,
          decided_by: p.decided_by,
          can_auto_apply: Boolean(p.can_auto_apply),
          reasons: p.reasons || [],
          ts: ev.ts,
          resolved: ev.kind === "verdict",
        };
        break;
      default:
        break;
    }
  }
  return { verdict, reviews, grants, discussions };
}
