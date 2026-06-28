// Pure parsers for h5i human-readable CLI output. No I/O — every function maps
// a captured string to structured data, which makes them directly unit-testable
// (see test/parse.test.mjs). h5i.mjs wires these to the live CLI.

/** Strip ANSI/VT escape sequences from CLI output. */
export function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

// ── msg history ──────────────────────────────────────────────────────────────

/** Parse `h5i msg history --plain` (tab-separated, full ISO timestamps). */
export function parsePlainHistory(raw) {
  const out = [];
  for (const line of stripAnsi(raw).split("\n")) {
    if (!line.includes("\t")) continue;
    const parts = line.split("\t");
    const idx = Number(parts[0]);
    if (!Number.isFinite(idx)) continue;
    const route = (parts[2] || "").trim();
    const [from, to] = route.split(/\s*->\s*/);
    const body = (parts[parts.length - 1] || "").trim();
    out.push({ idx, ts: (parts[1] || "").trim(), from: from || "?", to: to || "?", body });
  }
  return out;
}

export const RICH_HEADER =
  /^\s*(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(\S+)\s*(?:→|->)\s*(\S+)\s+([A-Z_]+)\s+#([0-9a-f]+)\s*$/;

/** Parse the default (coloured) `h5i msg history` view: kind, thread, metadata. */
export function parseRichHistory(raw) {
  const lines = stripAnsi(raw).split("\n");
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
  };
  for (const line of lines) {
    const h = line.match(RICH_HEADER);
    if (h) {
      flush();
      cur = {
        idx: Number(h[1]),
        time: h[2],
        from: h[3],
        to: h[4],
        kind: h[5],
        thread: h[6],
        body: "",
        branch: null,
        focus: null,
        granted: null,
        risk: null,
      };
      continue;
    }
    if (!cur) continue;
    const t = line.trim();
    if (!t) continue;
    // A metadata line is one whose `·`-separated segments are all key/value
    // pairs (branch …, focus …, granted …). Anything else is body text.
    const segs = t.split("·").map((s) => s.trim());
    const meta = segs
      .map((s) => s.match(/^(branch|focus|granted|risk|priority|deadline)\s+(.+)$/))
      .filter(Boolean);
    if (meta.length > 0) {
      for (const m of meta) cur[m[1]] = m[2].trim();
    } else {
      cur.body = cur.body ? `${cur.body}\n${t}` : t;
    }
  }
  flush();
  return out;
}

/** Merge the plain + rich views by index → unified, newest-first messages. */
export function mergeHistory(plainRaw, richRaw, plainOk, richOk) {
  const byIdx = new Map();
  if (richOk) for (const m of parseRichHistory(richRaw)) byIdx.set(m.idx, m);

  const out = [];
  if (plainOk) {
    for (const p of parsePlainHistory(plainRaw)) {
      const rich = byIdx.get(p.idx) || {};
      out.push({
        idx: p.idx,
        ts: p.ts,
        from: p.from,
        to: p.to,
        body: p.body,
        kind: rich.kind || "MSG",
        thread: rich.thread || null,
        branch: rich.branch || null,
        focus: rich.focus || null,
        granted: rich.granted || null,
      });
    }
  } else if (richOk) {
    for (const m of byIdx.values()) {
      out.push({
        idx: m.idx,
        ts: m.time || null,
        from: m.from,
        to: m.to,
        body: m.body,
        kind: m.kind || "MSG",
        thread: m.thread || null,
        branch: m.branch || null,
        focus: m.focus || null,
        granted: m.granted || null,
      });
    }
  }
  out.sort((a, b) => b.idx - a.idx);
  return out;
}

// ── msg team (roster) ────────────────────────────────────────────────────────

/** Parse `h5i msg team` → channel roster with online flag + last-seen. */
export function parseRoster(raw) {
  const out = [];
  for (const line of stripAnsi(raw).split("\n")) {
    const m = line.match(/^\s*([●○])\s+(\S+)(\s+\(you\))?\s*(?:·|—)?\s*(?:last seen\s+(\S+))?/);
    if (!m) continue;
    if (m[2] === "Agents") continue;
    out.push({ online: m[1] === "●", name: m[2], you: Boolean(m[3]), lastSeen: m[4] || null });
  }
  return out;
}

// ── recall context show ──────────────────────────────────────────────────────

/** Parse `h5i recall context show --trace` into a structured nav-log view. */
export function parseContext(raw) {
  const lines = stripAnsi(raw).split("\n");
  const ctx = {
    available: true,
    goal: null,
    gitBranch: null,
    contextBranch: null,
    milestones: [],
    branches: [],
    commits: [],
    trace: [],
  };
  let section = null;
  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (!t) continue;

    const goal = t.match(/Goal:\s*(.+?)\s*(?:\(branch:.*)?$/);
    if (goal && !ctx.goal) {
      ctx.goal = goal[1].trim();
      continue;
    }
    const gb = t.match(/Git branch:\s*(\S+)\s*\|\s*Context branch:\s*(\S+)/);
    if (gb) {
      ctx.gitBranch = gb[1];
      ctx.contextBranch = gb[2];
      continue;
    }
    if (/^Milestones:/.test(t)) {
      section = "milestones";
      continue;
    }
    if (/^Branches:/.test(t)) {
      ctx.branches = t
        .replace(/^Branches:\s*/, "")
        .split("·")
        .map((s) => s.trim())
        .filter(Boolean);
      section = null;
      continue;
    }
    if (/^Recent Commits:/.test(t)) {
      section = "commits";
      continue;
    }
    if (/^Recent Trace:/.test(t)) {
      section = "trace";
      continue;
    }

    if (section === "milestones") {
      const m = t.match(/\[(x| )\]\s+(.*)$/);
      if (m) ctx.milestones.push({ done: m[1] === "x", text: m[2].trim() });
      continue;
    }
    if (section === "commits") {
      const m = t.match(/^[◈•*◆-]\s*(.+)$/);
      if (m) ctx.commits.push(m[1].trim());
      continue;
    }
    if (section === "trace") {
      const m = t.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([A-Z]+):\s*(.+)$/);
      if (m) ctx.trace.push({ time: m[1], kind: m[2], text: m[3].trim() });
      continue;
    }
  }
  return ctx;
}
