import type {
  AgentPlan,
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
    fetch(`${BASE}/api/profile/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  getJourney: (profileId: string) => get<{ journey: JourneyState }>(`/api/journey/${profileId}`),

  runDrop: (profileId: string) => post<{ inbox: InboxItem[]; source: string }>(`/api/engine/run-now/${profileId}`, {}),

  getInbox: (profileId: string) => get<{ items: InboxItem[]; unread: number }>(`/api/engine/inbox/${profileId}`),

  markInboxRead: (id: string) => fetch(`${BASE}/api/engine/inbox/${id}/read`, { method: "PATCH" }),

  resolveAction: (id: string, status: "in_progress" | "done" | "skipped") =>
    fetch(`${BASE}/api/engine/action/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),

  roadmap: (input: Record<string, unknown>) =>
    post<{ roadmap: Roadmap; source: string }>("/api/roadmap", input),

  searchSchools: (input: Record<string, unknown>) =>
    post<{ schools: School[]; advisorNote: string; source: string }>("/api/schools/search", input),

  visaNext: (country: string, history: VisaTurn[], documents?: string) =>
    post<{ question: string; done: boolean; source: string }>("/api/visa/next", { country, history, documents }),

  visaScore: (country: string, history: VisaTurn[], documents?: string) =>
    post<{ score: VisaScore; source: string }>("/api/visa/score", { country, history, documents }),

  draftEssay: (input: Record<string, unknown>) =>
    post<{ draft: string; source: string }>("/api/applications/draft", input),

  speakingPrompt: (exam: string) =>
    get<{ exam: string; prompt: string }>(`/api/speaking/prompt?exam=${encodeURIComponent(exam)}`),

  speakingScore: (exam: string, prompt: string, answer: string) =>
    post<{ score: SpeakingScore; source: string }>("/api/speaking/score", { exam, prompt, answer }),

  agentPlan: (profileSummary: string, completed: string[], profileId?: string) =>
    post<{ plan: AgentPlan; source: string }>("/api/agent/plan", { profileSummary, completed, profileId }),

  riskReport: (documents: { kind: string; text: string }[], profileId?: string) =>
    post<{ report: RiskReport; paid: boolean; needsPayment?: boolean; anonymous?: boolean }>("/api/risk/report", {
      documents,
      profileId,
    }),

  billingStatus: (profileId: string) =>
    get<{ billingEnabled: boolean; entitled: boolean }>(`/api/billing/status/${profileId}`),

  billingCheckout: (profileId: string) =>
    post<{ url: string | null; free?: boolean }>("/api/billing/checkout", { profileId }),

  billingConfirm: (sessionId: string) =>
    post<{ paid: boolean; profileId?: string }>("/api/billing/confirm", { sessionId }),

  authConfig: () => get<{ googleAuthEnabled: boolean }>("/api/auth/config"),

  authGoogle: (credential: string) =>
    post<{ token: string; user: { id: string; email: string; name: string } }>("/api/auth/google", { credential }),
};
