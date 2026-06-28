import type { ReactNode } from "react";

export function Panel({
  title,
  tag,
  right,
  children,
  className = "",
}: {
  title: string;
  tag?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h3>{title}</h3>
        {tag && <span className="tag">{tag}</span>}
        <span className="grow" />
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Chip({
  tone = "idle",
  dot = false,
  children,
}: {
  tone?: "idle" | "go" | "live" | "hot" | "amber" | "plasma";
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`chip ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/** Map a team-agent state string to a chip tone + label. */
export function AgentStateBadge({ state }: { state: string }) {
  const s = state.toLowerCase();
  const tone =
    s === "submitted"
      ? "live"
      : s === "working"
        ? "amber"
        : s === "applied"
          ? "go"
          : s === "failed"
            ? "hot"
            : "idle";
  const label =
    s === "submitted" ? "SEALED" : s === "working" ? "IN FLIGHT" : state.toUpperCase();
  return (
    <Chip tone={tone} dot>
      {label}
    </Chip>
  );
}

export function Empty({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{title}</div>
      {hint && <div className="sml">{hint}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label && <div className="big">{label}</div>}
    </div>
  );
}
