import type {
  ArtifactView,
  CompareRow,
  ContextView,
  Health,
  Message,
  RosterAgent,
  TeamDetail,
  TeamRun,
} from "./types";

const BASE = "/api";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Bad response from ${path}`);
  }
  if (!res.ok) {
    const err = body as { error?: string; command?: string } | null;
    throw new ApiError(err?.error || `Request failed (${res.status})`, err?.command ?? null, res.status);
  }
  return body as T;
}

export class ApiError extends Error {
  command: string | null;
  status: number;
  constructor(message: string, command: string | null, status: number) {
    super(message);
    this.name = "ApiError";
    this.command = command;
    this.status = status;
  }
}

export const api = {
  health: (signal?: AbortSignal) => get<Health>("/health", signal),
  teams: (signal?: AbortSignal) => get<TeamRun[]>("/teams", signal),
  team: (id: string, signal?: AbortSignal) => get<TeamDetail>(`/teams/${encodeURIComponent(id)}`, signal),
  compare: (id: string, signal?: AbortSignal) =>
    get<CompareRow[]>(`/teams/${encodeURIComponent(id)}/compare`, signal),
  artifact: (team: string, artifactId: string, view: "diff" | "summary" | "tests", signal?: AbortSignal) =>
    get<ArtifactView>(
      `/teams/${encodeURIComponent(team)}/artifact/${encodeURIComponent(artifactId)}?view=${view}`,
      signal,
    ),
  messages: (limit = 60, signal?: AbortSignal) => get<Message[]>(`/messages?limit=${limit}`, signal),
  roster: (signal?: AbortSignal) => get<RosterAgent[]>("/roster", signal),
  context: (signal?: AbortSignal) => get<ContextView>("/context", signal),
};
