import type {
  AgentPlan,
  EvidenceArtifact,
  InboxItem,
  JourneyState,
  RiskReport,
  Roadmap,
  School,
  SpeakingScore,
  VisaScore,
  VisaTurn,
} from "../lib/types";
import { getToken } from "../lib/progress";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface HealthMode {
  gemini: "live" | "mock";
  collegeScorecard: "live" | "mock";
  db: "mongodb" | "in-memory";
}

export const api = {
  health: () => get<{ ok: boolean; mode: HealthMode }>("/api/health"),

  chat: (messages: { role: "user" | "assistant"; content: string }[], profileSummary?: string, profileId?: string) =>
    post<{ reply: string; source: string }>("/api/counselor/chat", { messages, profileSummary, profileId }),

  createProfile: (input: Record<string, unknown>) =>
    post<{ profile: { id: string } }>("/api/profile", input),

  updateProfile: (id: string, input: Record<string, unknown>) =>
    patch<{ profile: { id: string } }>(`/api/profile/${id}`, input),

  getProfile: (id: string) =>
    get<{ profile: Record<string, unknown> }>(`/api/profile/${id}`),

  // Sample students for instant demos / showing Yaar adapts to different journeys.
  listPersonas: () => get<{ personas: { key: string; label: string; blurb: string }[] }>("/api/profile/personas"),
  seedPersona: (persona: string) => post<{ profile: { id: string } }>("/api/profile/seed-persona", { persona }),

  getJourney: (profileId: string) => get<{ journey: JourneyState }>(`/api/journey/${profileId}`),

  completeModule: (profileId: string, module: string) =>
    post<{ journey: JourneyState }>(`/api/journey/${profileId}/complete`, { module }),

  runDrop: (profileId: string) => post<{ inbox: InboxItem[]; source: string }>(`/api/engine/run-now/${profileId}`, {}),

  getInbox: (profileId: string) => get<{ items: InboxItem[]; unread: number }>(`/api/engine/inbox/${profileId}`),

  markInboxRead: (id: string) => patch<{ ok: boolean }>(`/api/engine/inbox/${id}/read`),

  resolveAction: (id: string, status: "in_progress" | "done" | "skipped") =>
    patch<{ action: unknown }>(`/api/engine/action/${id}`, { status }),

  roadmap: (input: Record<string, unknown>) =>
    post<{ roadmap: Roadmap; source: string }>("/api/roadmap", input),

  searchSchools: (input: Record<string, unknown>) =>
    post<{ schools: School[]; advisorNote: string; source: string }>("/api/schools/search", input),

  visaNext: (country: string, history: VisaTurn[], documents?: string, profileId?: string) =>
    post<{ question: string; done: boolean; source: string }>("/api/visa/next", { country, history, documents, profileId }),

  visaScore: (country: string, history: VisaTurn[], documents?: string, profileId?: string) =>
    post<{ score: VisaScore; source: string }>("/api/visa/score", { country, history, documents, profileId }),

  draftEssay: (input: Record<string, unknown>) =>
    post<{ draft: string; source: string }>("/api/applications/draft", input),

  speakingPrompt: (exam: string) =>
    get<{ exam: string; prompt: string }>(`/api/speaking/prompt?exam=${encodeURIComponent(exam)}`),

  speakingScore: (exam: string, prompt: string, answer: string, profileId?: string) =>
    post<{ score: SpeakingScore; source: string }>("/api/speaking/score", { exam, prompt, answer, profileId }),

  agentPlan: (profileSummary: string, completed: string[], profileId?: string) =>
    post<{ plan: AgentPlan; source: string }>("/api/agent/plan", { profileSummary, completed, profileId }),

  whatIf: (scenario: string, profileId?: string, profileSummary?: string) =>
    post<{ scenario: string; impact: string; opensUp: string[]; watchOut: string[]; verdict: string; source: string }>(
      "/api/whatif",
      { scenario, profileId, profileSummary }
    ),

  riskReport: (documents: { kind: string; text: string }[], profileId?: string) =>
    post<{ report: RiskReport; paid: boolean; needsPayment?: boolean; needsAccount?: boolean }>("/api/risk/report", {
      documents,
      profileId,
    }),

  // Upload photos/PDFs of documents; Gemini reads them and returns fields to confirm.
  riskExtract: (files: { kind: string; mimeType: string; data: string; filename?: string }[]) =>
    post<{ extracted: { field: string; value: string; confidence?: "high" | "medium" | "low" }[]; warnings: string[] }>(
      "/api/risk/extract",
      { files }
    ),

  riskLatest: (profileId: string) =>
    get<{ report: RiskReport | null; entitled: boolean }>(`/api/risk/latest/${profileId}`),

  billingStatus: (profileId: string) =>
    get<{ billingEnabled: boolean; entitled: boolean }>(`/api/billing/status/${profileId}`),

  billingCheckout: (profileId: string) =>
    post<{ url: string | null; free?: boolean }>("/api/billing/checkout", { profileId }),

  billingConfirm: (sessionId: string) =>
    post<{ paid: boolean; profileId?: string }>("/api/billing/confirm", { sessionId }),

  authConfig: () => get<{ googleAuthEnabled: boolean }>("/api/auth/config"),

  authGoogle: (credential: string) =>
    post<{ token: string; user: { id: string; email: string; name: string } }>("/api/auth/google", { credential }),

  // Coaches
  coachRecommender: (input: Record<string, unknown>) =>
    post<{ requestMessage: string; bragSheet: string[]; projectSummary: string; logistics: string[]; source: string }>(
      "/api/coach/recommender",
      input
    ),
  coachFunding: (input: Record<string, unknown>) =>
    post<{ costExplanation: string; sponsorStory: string; gapAnalysis: string; howToClose: string[]; parentExplainer: string; gapUsd: number | null; source: string }>(
      "/api/coach/funding",
      input
    ),
  coachMilestones: (input: Record<string, unknown>) =>
    post<{ overview: string; terms: { term: string; focus: string; milestones: { area: string; action: string; proof: string }[] }[]; source: string }>(
      "/api/coach/milestones",
      input
    ),
  coachF1: (input: Record<string, unknown>) =>
    post<{ answer: string; mustDo: string[]; checkWithDSO: boolean; disclaimer: string; source: string }>("/api/coach/f1-status", input),

  // Evidence Vault
  addEvidence: (input: Record<string, unknown>) => post<{ evidence: EvidenceArtifact }>("/api/evidence", input),
  listEvidence: (profileId: string) => get<{ evidence: EvidenceArtifact[] }>(`/api/evidence/${profileId}`),
  summarizeEvidence: (profileId: string) =>
    post<{ activityLines: string[]; essayParagraph: string; source: string }>(`/api/evidence/${profileId}/summarize`, {}),

  // Memory ("mind") — the per-user brief + structured facts Yaar builds over time.
  getMemory: (profileId: string) =>
    get<{ brief: string | null; facts: { key: string; type: string; value: string; confidence: number; source: string }[] }>(
      `/api/memory/${profileId}`
    ),
  consolidateMemory: (profileId: string) =>
    post<{ brief: string; insights: number; source: string }>(`/api/memory/${profileId}/consolidate`, {}),

  // Transcribe a recorded audio clip with Gemini (reliable replacement for the browser's
  // flaky Web Speech API). data is base64 (no data: prefix).
  transcribe: (mimeType: string, data: string) =>
    post<{ text: string; source: string }>("/api/transcribe", { mimeType, data }),

  // Parent mode — a warm, plain-language update for a parent, in any language, plus a
  // no-login shareable link.
  generateParentReport: (profileId: string, language?: string) =>
    post<{ report: ParentReport; shareToken: string; shareUrl: string }>(`/api/parent/${profileId}/report`, { language }),
  getSharedParentReport: (token: string) => get<{ report: ParentReport }>(`/api/parent/shared/${token}`),
};

export interface ParentReport {
  childName: string;
  whereTheyAre: string;
  doingWell: string;
  watchFor: string;
  theMoney: string;
  howYouCanHelp: string[];
  nextMilestones: string[];
  language: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Ops API — the autonomous-company control plane (admin-gated in prod, open on
// localhost in dev). Kept separate from `api` because it carries an admin token
// header rather than the per-user bearer token.
// ---------------------------------------------------------------------------

export type AutonomyMode = "dry_run" | "assist" | "live";

export interface OpsEmployee {
  id: string;
  title: string;
  department: string;
  mission: string;
  cadence: string;
  allowedActions: string[];
}

export interface OrgResponse {
  autonomyMode: AutonomyMode;
  employees: OpsEmployee[];
}

export type ActionStatus = "dry_run" | "pending_approval" | "approved" | "executed" | "rejected" | "failed";

export interface OpsAction {
  id: string;
  agentId: string;
  department: string;
  type: string;
  external: boolean;
  channel?: string;
  title: string;
  payload: unknown;
  riskLevel: string;
  status: ActionStatus;
}

export interface OpsTask {
  id: string;
  title: string;
  detail: string;
  department: string;
  status: string;
}

export interface BoardroomTurn {
  agentId: string;
  title: string;
  department: string;
  message: string;
  ts: number | string;
}

export interface BoardroomResponse {
  topic?: string;
  startedAt?: number | string;
  source?: string;
  review?: { approved: boolean; reason: string };
  transcript: BoardroomTurn[];
  tasks: OpsTask[];
  actions: OpsAction[];
}

export interface RunEmployeeResponse {
  employee: string;
  title: string;
  summary: string;
  actions: OpsAction[];
  source?: string;
}

function opsHeaders(): Record<string, string> {
  const t = localStorage.getItem("yaar.adminToken");
  return t ? { "X-Admin-Token": t } : {};
}

// Error that preserves the HTTP status so callers can detect 503 (admin required)
// and prompt for an admin token rather than showing a generic failure.
export class OpsError extends Error {
  status: number;
  constructor(path: string, status: number) {
    super(`${path} failed: ${status}`);
    this.name = "OpsError";
    this.status = status;
  }
}

async function opsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...opsHeaders() } });
  if (!res.ok) throw new OpsError(path, res.status);
  return res.json() as Promise<T>;
}

async function opsPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opsHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OpsError(path, res.status);
  return res.json() as Promise<T>;
}

export const ops = {
  getOrg: () => opsGet<OrgResponse>("/api/ops/org"),
  runBoardroom: (topic?: string) => opsPost<BoardroomResponse>("/api/ops/boardroom", { topic }),
  latestBoardroom: () => opsGet<BoardroomResponse>("/api/ops/boardroom/latest"),
  listActions: () => opsGet<{ actions: OpsAction[] }>("/api/ops/actions"),
  listTasks: () => opsGet<{ tasks: OpsTask[] }>("/api/ops/tasks"),
  runEmployee: (id: string) => opsPost<RunEmployeeResponse>(`/api/ops/run/${id}`, {}),
};
