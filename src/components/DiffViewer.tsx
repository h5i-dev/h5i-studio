import { useEffect, useState } from "react";
import { api } from "../api";
import type { ArtifactView } from "../types";
import { shortOid } from "../lib/format";

type Tab = "diff" | "summary" | "tests";

/** Modal overlay showing one submission's flight plan: diff / summary / tests. */
export function DiffViewer({
  team,
  artifactId,
  owner,
  onClose,
}: {
  team: string;
  artifactId: string;
  owner: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("diff");
  const [data, setData] = useState<Record<Tab, ArtifactView | undefined>>({
    diff: undefined,
    summary: undefined,
    tests: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (data[tab]) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .artifact(team, artifactId, tab)
      .then((v) => alive && setData((d) => ({ ...d, [tab]: v })))
      .catch((e) => alive && setError(String(e.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, team, artifactId, data]);

  const cur = data[tab];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h3>FLIGHT PLAN · {owner.toUpperCase()}</h3>
          <span className="tag mono">{artifactId}</span>
          <span className="grow" />
          <div className="modal-tabs">
            {(["diff", "summary", "tests"] as Tab[]).map((t) => (
              <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>

        {loading && <div className="summary-box dim">↻ retrieving telemetry…</div>}
        {error && <div className="summary-box" style={{ color: "var(--hot)" }}>⚠ {error}</div>}

        {!loading && !error && cur && tab === "diff" && <DiffBody diff={cur.diff || ""} />}
        {!loading && !error && cur && tab === "summary" && (
          <div className="summary-box">
            {cur.summary?.trim() || "— no summary recorded for this submission —"}
          </div>
        )}
        {!loading && !error && cur && tab === "tests" && (
          <div className="summary-box">
            <div className="kv">
              <span className="k">base</span>
              <span className="v">{shortOid(cur.base_oid, 12)}</span>
              <span className="k">commit</span>
              <span className="v">{shortOid(cur.commit_oid, 12)}</span>
              <span className="k">files</span>
              <span className="v">{cur.files_changed}</span>
              <span className="k">delta</span>
              <span className="v">
                +{cur.insertions} / -{cur.deletions}
              </span>
              <span className="k">captures</span>
              <span className="v">
                {cur.capture_ids.length ? cur.capture_ids.join(", ") : "— none —"}
              </span>
            </div>
            <p className="dim" style={{ marginTop: 16 }}>
              Test evidence is captured as h5i objects at verification time. Neutral verifier
              results surface on the candidate gates and the Go / No-Go panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffBody({ diff }: { diff: string }) {
  if (!diff.trim()) return <div className="summary-box dim">— empty diff —</div>;
  const lines = diff.split("\n");
  return (
    <pre className="diff">
      {lines.map((ln, i) => {
        let cls = "";
        if (ln.startsWith("+++") || ln.startsWith("---") || ln.startsWith("diff ") || ln.startsWith("index "))
          cls = "meta";
        else if (ln.startsWith("@@")) cls = "hunk";
        else if (ln.startsWith("+")) cls = "add";
        else if (ln.startsWith("-")) cls = "del";
        return (
          <span key={i} className={`dl ${cls}`}>
            {ln || " "}
          </span>
        );
      })}
    </pre>
  );
}
