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
import { clearAuth, getToken } from "../lib/progress";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// A 401 while carrying a token means the session is dead (expired JWT, rotated
// secret). Drop it so the UI falls back to the sign-in button on next render
// instead of showing "signed in" while every owned-profile call fails.
function dropDeadSession(status: number): void {
  if (status === 401 && getToken()) clearAuth();
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    dropDeadSession(res.status);
    // Surface server-side reason where present so the caller can show a
    // specific message ("Recording too long...") rather than a blanket fail.
    let serverMsg = "";
    try {
      const j = await res.json();
      serverMsg = typeof j?.error === "string" ? j.error : "";
    } catch {
      // ignore non-JSON bodies
    }
    throw new Error(serverMsg || `${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Human text from a thrown API error: the server's friendly message when present
// (rate limits and honest-fail 503s send warm, specific copy), else the caller's
// fallback. Raw "path failed: 503" strings are never shown to students.
export function errText(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  return m && !/failed: \d+$/.test(m) ? m : fallback;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    dropDeadSession(res.status);
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    dropDeadSession(res.status);
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface HealthMode {
  gemini: "live" | "mock";
  collegeScorecard: "live" | "mock";
  db: "mongodb" | "in-memory";
}

// The server mode flags don't change within a session, so cache them briefly
// instead of re-hitting /api/health every time Settings mounts.
let healthCache: { value: { ok: boolean; mode: HealthMode }; at: number } | null = null;

export const api = {
  health: async () => {
    if (healthCache && Date.now() - healthCache.at < 60_000) return healthCache.value;
    const r = await get<{ ok: boolean; mode: HealthMode }>("/api/health");
    healthCache = { value: r, at: Date.now() };
    return r;
  },

  chat: (messages: { role: "user" | "assistant"; content: string }[], profileSummary?: string, profileId?: string) =>
    post<{ reply: string; source: string }>("/api/counselor/chat", { messages, profileSummary, profileId }),

  createProfile: (input: Record<string, unknown>) =>
    post<{ profile: { id: string } }>("/api/profile", input),

  updateProfile: (id: string, input: Record<string, unknown>) =>
    patch<{ profile: { id: string } }>(`/api/profile/${id}`, input),

  getProfile: (id: string) =>
    get<{ profile: Record<string, unknown> }>(`/api/profile/${id}`),

  // Delete my data: permanently erases everything Yaar knows about this student.
  deleteProfile: async (id: string) => {
    const res = await fetch(`${BASE}/api/profile/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`delete failed: ${res.status}`);
    return res.json() as Promise<{ ok: boolean }>;
  },

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
    post<{ report: RiskReport; needsAccount?: boolean }>("/api/risk/report", {
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
    get<{ report: RiskReport | null }>(`/api/risk/latest/${profileId}`),

  authConfig: () => get<{ googleAuthEnabled: boolean }>("/api/auth/config"),

  authGoogle: (credential: string) =>
    post<{ token: string; user: { id: string; email: string; name: string }; profileId?: string | null }>(
      "/api/auth/google",
      { credential }
    ),

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
  // flaky Web Speech API). data is base64 (no data: prefix). Optional signal lets
  // the recorder abort the in-flight request when the user leaves the page.
  transcribe: (mimeType: string, data: string, signal?: AbortSignal) =>
    post<{ text: string; source: string }>("/api/transcribe", { mimeType, data }, signal),

  // Natural text-to-speech (Gemini neural voice) -> a playable WAV (base64). source "mock"
  // means TTS is unavailable and the caller should fall back to the browser voice.
  tts: (text: string, voice?: string) =>
    post<{ audioBase64: string; mimeType: string; source: string }>("/api/tts", { text, voice }),

  // Mock tests (IELTS / TOEFL) — adaptive generation, scoring, and saved history.
  mockGenerateReading: (exam: string, profileId?: string) =>
    post<MockReadingTest>("/api/mock/reading/generate", { exam, profileId }),
  mockScoreReading: (testId: string, responses: Record<string, string>, profileId?: string) =>
    post<MockReadingResult>("/api/mock/reading/score", { testId, responses, profileId }),
  mockHistory: (profileId: string) => get<{ attempts: MockAttemptSummary[] }>(`/api/mock/history/${profileId}`),

  // Cohort percentile: "you scored higher than X% of recent attempts." Anonymous;
  // returns { percentile: null } when there isn't enough cohort data yet.
  mockCohort: (exam: string, skill: string, score: number) =>
    get<{ percentile: number | null; cohortSize: number; note?: string }>(
      `/api/mock/cohort/${encodeURIComponent(exam)}/${encodeURIComponent(skill)}?score=${encodeURIComponent(String(score))}`
    ),

  // Progress + history: trends, comparisons, weak areas, activity timeline, AI recap.
  progress: (profileId: string) => get<ProgressData>(`/api/progress/${profileId}`),

  mockGenerateWriting: (exam: string, profileId?: string) =>
    post<MockWritingTask>("/api/mock/writing/generate", { exam, profileId }),
  mockScoreWriting: (exam: string, taskType: string, prompt: string, context: string | undefined, essay: string, profileId?: string) =>
    post<MockSkillResult>("/api/mock/writing/score", { exam, taskType, prompt, context, essay, profileId }),

  mockGenerateListening: (exam: string, profileId?: string) =>
    post<MockListeningTest>("/api/mock/listening/generate", { exam, profileId }),
  mockScoreListening: (testId: string, responses: Record<string, string>, profileId?: string) =>
    post<MockReadingResult>("/api/mock/listening/score", { testId, responses, profileId }),
  mockListeningAudio: (testId: string) =>
    get<{ status: "pending" | "ready" | "failed"; audioBase64?: string; mimeType?: string }>(`/api/mock/listening/${testId}/audio`),

  mockGenerateSpeaking: (exam: string, profileId?: string) =>
    post<MockSpeakingTask>("/api/mock/speaking/generate", { exam, profileId }),
  mockScoreSpeaking: (exam: string, taskType: string, prompt: string, transcript: string, profileId?: string) =>
    post<MockSkillResult>("/api/mock/speaking/score", { exam, taskType, prompt, transcript, profileId }),

  // Parent mode — a warm, plain-language update for a parent, in any language, plus a
  // no-login shareable link.
  generateParentReport: (profileId: string, language?: string) =>
    post<{ report: ParentReport; shareToken: string; shareUrl: string }>(`/api/parent/${profileId}/report`, { language }),
  getSharedParentReport: (token: string) => get<{ report: ParentReport }>(`/api/parent/shared/${token}`),
};

export interface MockQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
}
export interface MockReadingTest {
  testId: string;
  exam: string;
  skill: string;
  title: string;
  passage: string;
  questions: MockQuestion[];
  timeSec: number;
  targetBand: string;
}
export interface MockReadingResult {
  exam: string;
  skill: string;
  rawCorrect: number;
  rawTotal: number;
  scaled: number;
  scaledLabel: string;
  byType: { type: string; correct: number; total: number }[];
  weakTypes: string[];
  feedback: string;
  questions: { id: string; type: string; prompt: string; your: string; correctAnswer: string; correct: boolean; explanation: string }[];
}
export interface MockCriterion {
  name: string;
  score: number;
  max: number;
  feedback: string;
  // Evidence-grounded fields. The backend extracts verbatim quotes from the
  // essay/transcript and a concrete fix per criterion, so the UI can render
  // a specific "this exact phrase pulls X down — replace with Y" diagnosis.
  evidenceQuote?: string;
  weakestQuote?: string;
  specificFix?: string;
}
export interface MockSkillResult {
  exam: string;
  skill: string;
  scaled: number;
  scaledLabel: string;
  criteria: MockCriterion[];
  modelNote: string;
  weakTypes: string[];
  feedback: string;
  note?: string;
}
export interface MockWritingTask {
  exam: string;
  skill: string;
  taskType: string;
  prompt: string;
  context?: string;
  minWords: number;
  timeSec: number;
}
export interface MockListeningTest {
  testId: string;
  exam: string;
  skill: string;
  title: string;
  transcript: string;
  questions: MockQuestion[];
  timeSec: number;
}
export interface MockSpeakingTask {
  exam: string;
  skill: string;
  taskType: string;
  prompt: string;
  bullets?: string[];
  prepSec: number;
  speakSec: number;
}
export interface MockAttemptSummary {
  id: string;
  exam: string;
  skill: string;
  scaled: number;
  scaledLabel: string;
  rawCorrect?: number;
  rawTotal?: number;
  weakTypes: string[];
  feedback: string;
  analysis?: unknown;
  createdAt: string;
}

// ---- Progress / history (see backend services/progress.ts) ----
export interface TrendPoint {
  date: string;
  scaled: number;
  label: string;
}
export interface SkillTrend {
  key: string;
  exam: string;
  skill: string;
  unit: "band" | "points";
  max: number;
  points: TrendPoint[];
  latest: number;
  latestLabel: string;
  previous: number | null;
  delta: number | null;
  best: number;
  attempts: number;
}
export interface ProgressData {
  totals: { mocks: number; activities: number; evidence: number; factsKnown: number; activeDays: number; streak: number };
  monthly: { thisMonth: { activities: number; mocks: number }; lastMonth: { activities: number; mocks: number } };
  skills: SkillTrend[];
  weakAreas: { type: string; count: number }[];
  timeline: { ts: string; kind: string; module?: string; summary: string; status?: string }[];
  recap: string;
  hasData: boolean;
}

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
  // Approvals + audit + pulse, the deploy-and-forget control plane.
  listApprovals: () => opsGet<{ actions: OpsAction[] }>("/api/ops/approvals"),
  approveAction: (id: string) => opsPost<{ action: OpsAction }>(`/api/ops/actions/${id}/approve`, {}),
  rejectAction: (id: string) => opsPost<{ action: OpsAction }>(`/api/ops/actions/${id}/reject`, {}),
  getSafety: () => opsGet<{ killSwitchEngaged: boolean; reason: string; totalSpendUsd: number; dailyHardCapUsd: number; callCount: number; autonomyMode: string; recentRejections: { ts: string; reason: string }[] }>("/api/ops/safety"),
  setKill: (engaged: boolean, reason?: string) => opsPost<{ killSwitchEngaged: boolean }>("/api/ops/safety/kill", { engaged, reason }),
  getPulse: () => opsGet<{ ok: boolean; autonomyMode: string; killSwitchEngaged: boolean; reason: string; spend: { today: number; cap: number; pct: number; calls: number }; scheduler?: { lastTickAt: string; staleMs: number; stale: boolean }; pendingApprovalCount: number; recentActions: { id: string; agentId: string; type: string; status: string; title: string; createdAt: string }[]; recentRejections: { ts: string; reason: string }[]; serverTime: string }>("/api/ops/pulse"),
};
