// Domain types — mirror the h5i `team` JSON contract (TeamRun, TeamArtifact,
// TeamVerification, TeamEvent …) plus the derived objects the API folds out of
// the event log. Field names match the CLI output verbatim.

export type Phase =
  | "draft"
  | "sealed_submit"
  | "discuss"
  | "verdict"
  | "verified"
  | "applied"
  | "no_verdict"
  | string;

export interface TeamAgent {
  agent_id: string;
  env_id: string;
  runtime?: string | null;
  model?: string | null;
  isolation_claim: string;
  policy_digest: string;
  branch_ref: string;
  worktree_known_local: boolean;
  latest_submission_id?: string | null;
  state: string;
}

export interface TeamArtifact {
  id: string;
  owner_agent: string;
  round: number;
  env_id: string;
  commit_oid: string;
  tree_oid: string;
  capture_ids: string[];
  files_changed: number;
  insertions: number;
  deletions: number;
  submitted_at: string;
  summary?: string | null;
  independent: boolean;
  influence_event_ids: string[];
  influence_artifact_ids: string[];
}

export interface TeamVerification {
  id: string;
  submission_id: string;
  owner_agent: string;
  round: number;
  command: string[];
  applies_cleanly: boolean;
  tests_passed: boolean;
  isolation: string;
  capture_id?: string | null;
  failure?: string | null;
}

export interface TeamRun {
  id: string;
  name: string;
  base_oid: string;
  created_by: string;
  created_at: string;
  phase: Phase;
  current_round: number;
  max_rounds: number;
  agents: TeamAgent[];
  submissions: TeamArtifact[];
  verifications: TeamVerification[];
  verdict?: Verdict | null;
}

export interface TeamEvent {
  id: string;
  ts: string;
  actor: string;
  kind: string;
  run_id: string;
  round: number;
  parent_event_id?: string | null;
  phase_before?: string | null;
  phase_after?: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

export interface Verdict {
  selected_submission: string | null;
  method: string;
  decided_by: string;
  can_auto_apply: boolean;
  reasons: string[];
  ts?: string;
  resolved?: boolean;
}

export interface Review {
  id: string;
  ts: string;
  reviewer: string;
  target: string;
  body: string;
  round: number;
  artifacts: string[];
}

export interface Grant {
  id: string;
  ts: string;
  reviewer: string;
  target: string;
  round: number;
  kinds: string[];
  artifacts: string[];
}

export interface Discussion {
  id: string;
  ts: string;
  from: string;
  to: string | string[];
  body: string;
  round: number;
  artifacts: string[];
}

export interface Derived {
  verdict: Verdict | null;
  reviews: Review[];
  grants: Grant[];
  discussions: Discussion[];
}

export interface TeamDetail {
  run: TeamRun;
  events: TeamEvent[];
  derived: Derived;
}

export interface CompareRow {
  agent_id: string;
  env_id: string;
  submitted: boolean;
  submission_id: string | null;
  status: string;
  base_commit: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  last_exit: number | null;
  last_tool: string | null;
  last_result: string | null;
  last_counts: Record<string, number>;
}

export interface ArtifactView {
  id: string;
  owner_agent: string;
  round: number;
  base_oid: string;
  commit_oid: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  capture_ids: string[];
  diff?: string | null;
  summary?: string | null;
}

export interface Message {
  idx: number;
  ts: string | null;
  from: string;
  to: string;
  body: string;
  kind: string;
  thread: string | null;
  branch: string | null;
  focus: string | null;
  granted: string | null;
}

export interface RosterAgent {
  online: boolean;
  name: string;
  you: boolean;
  lastSeen: string | null;
}

export interface ContextTrace {
  time: string;
  kind: string;
  text: string;
}

export interface ContextView {
  available: boolean;
  error?: string;
  goal: string | null;
  gitBranch: string | null;
  contextBranch: string | null;
  milestones: { done: boolean; text: string }[];
  branches: string[];
  commits: string[];
  trace: ContextTrace[];
}

export interface Health {
  ok: boolean;
  service: string;
  demo?: boolean;
  repo: string;
  version: string;
  time: string;
}
