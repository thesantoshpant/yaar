// Frontend mirror of the backend response shapes we use.

export interface RoadmapStep {
  phase: string;
  timeframe: string;
  actions: string[];
  why: string;
}
export interface Roadmap {
  summary: string;
  realisticOutcome: string;
  steps: RoadmapStep[];
  estimatedTotalCostUsd?: string;
  redFlags: string[];
}

export interface School {
  name: string;
  city?: string;
  state?: string;
  admitRate?: number;
  netPriceUsd?: number;
  medianEarningsUsd?: number;
  size?: number;
  url?: string;
  category?: "reach" | "match" | "safety";
  fitReason?: string;
}

export interface VisaTurn {
  role: "officer" | "student";
  text: string;
}
export interface VisaScore {
  overall: number;
  recommendation: string;
  dimensions: { name: string; score: number; note: string }[];
  redFlags: string[];
  drills: string[];
}

export interface SpeakingScore {
  band: number;
  exam: string;
  criteria: { name: string; score: number; feedback: string }[];
  improvedAnswer: string;
  drills: string[];
}

export type ModuleKey = "roadmap" | "test_prep" | "school_search" | "applications" | "finances" | "visa";
export interface NextAction {
  module: ModuleKey;
  title: string;
  why: string;
  autoRunnable: boolean;
}
export interface AgentPlan {
  nextAction: NextAction;
  alternatives: NextAction[];
  progressPct: number;
  encouragement: string;
}

export type Source = "gemini" | "mock" | "scorecard";

export interface InboxItem {
  id: string;
  profileId: string;
  kind: "opportunity" | "followup" | "nudge" | "celebration";
  title: string;
  body: string;
  cta?: { label: string; actionItemId?: string; url?: string };
  read: boolean;
  source: string;
  createdAt: string;
}

export interface RiskReport {
  id: string;
  profileId: string;
  overall: number;
  summary: string;
  extracted: { field: string; value: string }[];
  inconsistencies: string[];
  weakPoints: string[];
  dimensions: { name: string; score: number; note: string }[];
  recommendation: string;
  createdAt: string;
  locked?: boolean;
}

export interface JourneyState {
  id: string;
  profileId: string;
  path: string;
  personaTags: { tag: string; confidence: number; source: string }[];
  currentStage: string;
  pacing: string;
  stages: { stage: string; status: string }[];
  updatedAt: string;
}
