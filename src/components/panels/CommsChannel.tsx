import { useMemo } from "react";
import type { Discussion, Grant, Message, Review } from "../../types";
import { agentHue, relTime } from "../../lib/format";
import { Chip, Panel } from "../ui";

interface Comm {
  id: string;
  ts: string | null;
  from: string;
  to: string;
  kind: string;
  tone: "live" | "amber" | "plasma" | "idle" | "go";
  body: string;
  refs: string[];
}

/**
 * Mission comms — peer reviews, post-freeze discussion, review grants and the
 * cross-agent radio (`h5i msg`) merged into one chronological channel and
 * scoped to this operation's crew.
 */
export function CommsChannel({
  reviews,
  discussions,
  grants,
  messages,
  crew,
}: {
  reviews: Review[];
  discussions: Discussion[];
  grants: Grant[];
  messages: Message[];
  crew: Set<string>;
}) {
  const comms = useMemo(() => {
    const out: Comm[] = [];
    for (const r of reviews)
      out.push({ id: `rev-${r.id}`, ts: r.ts, from: r.reviewer, to: r.target, kind: "REVIEW", tone: "live", body: r.body, refs: r.artifacts });
    for (const d of discussions)
      out.push({ id: `dis-${d.id}`, ts: d.ts, from: d.from, to: Array.isArray(d.to) ? d.to.join(", ") : d.to, kind: "DISCUSS", tone: "plasma", body: d.body, refs: d.artifacts });
    for (const g of grants)
      out.push({ id: `grant-${g.id}`, ts: g.ts, from: g.reviewer, to: g.target, kind: "GRANT", tone: "amber", body: `Review access granted: ${g.kinds.join(", ")}`, refs: g.artifacts });
    // Radio traffic between crew members (and dispatch from the human lead).
    for (const m of messages) {
      const involvesCrew = crew.has(m.from) || crew.has(m.to);
      if (!involvesCrew) continue;
      if (m.kind === "REVIEW_REQUEST" || m.kind === "TEAM_DONE") continue; // shown via grants / log
      out.push({
        id: `msg-${m.idx}`,
        ts: m.ts,
        from: m.from,
        to: m.to,
        kind: m.kind,
        tone: "idle",
        body: m.body,
        refs: m.focus ? [m.focus] : [],
      });
    }
    out.sort((a, b) => ((a.ts || "") < (b.ts || "") ? 1 : -1));
    return out;
  }, [reviews, discussions, grants, messages, crew]);

  return (
    <Panel title="Comms Channel" tag={`${comms.length} TRANSMISSIONS`}>
      {comms.length === 0 && (
        <div className="dim mono">— channel quiet · no reviews, discussion or radio traffic yet —</div>
      )}
      <div className="comms">
        {comms.map((c) => {
          const hue = agentHue(c.from);
          return (
            <div className="comm" key={c.id} style={{ borderLeftColor: `hsl(${hue} 80% 55%)` }}>
              <div className="hdr">
                <span className="route" style={{ color: `hsl(${hue} 90% 74%)` }}>{c.from}</span>
                <span className="arrow">→</span>
                <span className="route">{c.to}</span>
                <Chip tone={c.tone}>{c.kind}</Chip>
                <span className="t">{relTime(c.ts)}</span>
              </div>
              {c.body && <div className="text">{c.body}</div>}
              {c.refs.length > 0 && (
                <div className="refs">
                  {c.refs.map((r) => (
                    <span className="codepill" key={r}>{r}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
