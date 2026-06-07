// Shared domain types for Yaar.

export interface StudentProfile {
  id: string;
  userId?: string; // owner (set when created by a signed-in user); gates access
  name: string;
  country: string; // e.g. "Nepal", "India"
  gpa?: string; // free text, grading systems vary
  intendedLevel: "undergraduate" | "graduate";
  intendedMajor?: string;
  budgetUsdPerYear?: number;
  testStatus?: string; // e.g. "TOEFL not taken", "IELTS 6.5"
  careerGoal?: string;
  targetIntake?: string; // e.g. "Fall 2027"
  // Persona signals (optional, backward compatible). These let the system tell a
  // rural first-gen student apart from an urban well-resourced one and adapt.
  gradeLevel?: "9" | "10" | "11" | "12" | "gap" | "bachelors";
  isRural?: boolean;
  firstGen?: boolean; // first in family to attend college / study abroad
  schoolHasCounselor?: boolean;
  schoolHasClubs?: boolean;
  familiarWithProcess?: boolean; // does the student/family understand US admissions
  wontGoWithoutAid?: boolean;
  // Consent: the weekly email digest only goes to students who explicitly turned
  // it on. Default off; unset means "never email me".
  emailOptIn?: boolean;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RoadmapStep {
  phase: string; // e.g. "Test prep"
  timeframe: string; // e.g. "Jun - Aug 2026"
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
  admitRate?: number; // 0..1
  netPriceUsd?: number;
  inStateTuitionUsd?: number;
  outOfStateTuitionUsd?: number;
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
  overall: number; // 0..100
  recommendation: string;
  dimensions: {
    name: string;
    score: number; // 0..100
    note: string;
  }[];
  redFlags: string[];
  drills: string[];
}

export interface SpeakingScore {
  band: number; // e.g. IELTS 0..9 or TOEFL 0..30 depending on exam
  exam: string;
  criteria: {
    name: string;
    score: number;
    feedback: string;
  }[];
  improvedAnswer: string;
  drills: string[];
}

// ---- Personal intelligence: persona, journey, memory, engagement ----

export type PersonaTag =
  | "rural_first_gen"
  | "urban_resourced"
  | "high_achieve_low_income"
  | "late_senior"
  | "grad_masters"
  | "strong_stem_weak_english"
  | "aid_dependent";

export type JourneyStage =
  | "orientation"
  | "foundation"
  | "profile_building"
  | "testing"
  | "school_list"
  | "applications"
  | "finances_aid"
  | "visa_prep"
  | "pre_departure";

export interface JourneyState {
  id: string;
  profileId: string;
  path: "UG_STANDARD" | "UG_COMPRESSED" | "UG_RURAL_BOOTSTRAP" | "GRAD";
  personaTags: { tag: PersonaTag; confidence: number; source: "rule" | "ai" | "confirmed" }[];
  currentStage: JourneyStage;
  pacing: "patient" | "steady" | "aggressive";
  stages: { stage: JourneyStage; status: "locked" | "available" | "active" | "done" }[];
  completedModules: string[]; // server-side source of truth for module completion
  updatedAt: string;
}

export interface MemoryFact {
  id: string;
  profileId: string;
  key: string; // canonical slug for dedupe, e.g. "goal.major"
  type: "profile" | "context" | "goal" | "constraint" | "skill" | "preference" | "sensitive";
  value: string;
  confidence: number; // 0..1
  source: "student_stated" | "inferred" | "module_outcome";
  status: "active" | "superseded";
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  profileId: string;
  ts: string;
  kind: "signup" | "suggestion" | "action_taken" | "module_run" | "outcome" | "milestone" | "note";
  module?: string;
  summary: string;
  status?: "open" | "done" | "skipped";
}

export interface ActionItem {
  id: string;
  profileId: string;
  title: string;
  why: string;
  module: string; // ModuleKey-ish for deep-linking
  source: string; // e.g. "weekly_opportunity_drop"
  tags?: string[]; // gap tags this action closes
  status: "suggested" | "in_progress" | "done" | "skipped" | "expired";
  dueAt?: string;
  followUpAt?: string;
  followUpCount: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface InboxItem {
  id: string;
  profileId: string;
  kind: "opportunity" | "followup" | "nudge" | "celebration";
  title: string;
  body: string;
  cta?: { label: string; actionItemId?: string; url?: string };
  read: boolean;
  source: "gemini" | "mock";
  createdAt: string;
}

export interface Opportunity {
  id: string;
  title: string;
  category: string;
  provider?: string;
  url?: string;
  summary: string;
  majors: string[]; // includes "any"
  levels: ("undergraduate" | "graduate" | "highschool")[];
  regions: string[]; // includes "global"
  cost: "free" | "low" | "high" | "pays_student";
  lowBandwidth: boolean;
  requiresSchoolSupport: boolean;
  selfStartable: boolean;
  strengthens: string[]; // gap tags it closes
  firstStepHint?: string;
}

export interface StudentDocument {
  id: string;
  profileId: string;
  kind: "i20" | "admit" | "funding" | "ds160" | "other";
  filename?: string;
  text: string; // extracted text content
  createdAt: string;
}

export interface AppUser {
  id: string;
  googleSub: string;
  email: string;
  name: string;
  profileId?: string;
  createdAt: string;
}

export interface RiskReport {
  id: string;
  profileId: string;
  overall: number; // 0..100 readiness
  summary: string;
  extracted: { field: string; value: string }[]; // key facts pulled from the docs
  inconsistencies: string[]; // mismatches the AI found across docs
  weakPoints: string[]; // what a consular officer would push on
  dimensions: { name: string; score: number; note: string }[];
  recommendation: string;
  createdAt: string;
}

// A completed mock-test section (IELTS/TOEFL). Saved per attempt for history + memory.
export interface MockAttempt {
  id: string;
  profileId: string;
  exam: "IELTS" | "TOEFL";
  skill: "reading" | "listening" | "writing" | "speaking";
  scaled: number; // IELTS band (0-9) or TOEFL scaled (0-30) for this skill
  scaledLabel: string; // e.g. "Band 6.5" or "24 / 30"
  rawCorrect?: number;
  rawTotal?: number;
  byType: { type: string; correct: number; total: number }[]; // per question-type performance
  weakTypes: string[]; // question types to drill next
  feedback: string;
  // Full revisitable breakdown of the attempt: per-question review (reading/listening)
  // or per-criterion scoring + model note (writing/speaking). Stored so a student can
  // reopen any past attempt and see exactly how they did, not just the headline score.
  analysis?: unknown;
  createdAt: string;
}

// Evidence Vault: every action a student takes becomes reusable application evidence.
export interface EvidenceArtifact {
  id: string;
  profileId: string;
  title: string;
  whatYouDid: string;
  whoBenefited?: string;
  proofUrl?: string;
  skills: string[];
  reflection?: string;
  linkedActionItemId?: string;
  createdAt: string;
}

// A bug report or suggestion from anyone using Yaar. Anonymous by default; the
// email is only there if the reporter wants a reply.
export interface FeedbackItem {
  id: string;
  kind: "bug" | "idea" | "other";
  message: string;
  email?: string;
  page?: string; // where in the app they were
  createdAt: string;
}

// A task the CEO agent assigns to a department; worked by that department's agent.
export interface CompanyTask {
  id: string;
  title: string;
  detail: string;
  department: string;
  status: "open" | "in_progress" | "done";
  createdBy: string;
  createdAt: string;
  resolvedAt?: string;
}

// An action proposed or taken by a company agent ("employee"). Every real-world
// action flows through the Action Gateway and is recorded here (audit + approvals).
export interface AgentAction {
  id: string;
  agentId: string; // which employee
  department: string;
  type: string; // draft_content | social_post | email_campaign | whatsapp_message | support_reply | internal_task | report
  external: boolean; // true if it reaches a real person/platform
  channel?: string; // e.g. "x", "email", "whatsapp"
  title: string;
  payload: string; // the content / details
  riskLevel: "low" | "medium" | "high";
  status: "dry_run" | "pending_approval" | "approved" | "executed" | "rejected" | "failed";
  result?: string;
  createdAt: string;
  resolvedAt?: string;
}
