// Mongoose models for the personal-intelligence + engagement system.
// Schemas are defined untyped and cast to Model<T> at the boundary, so flexible
// Mixed fields (persona tags, stages, cta) don't fight the TS domain types.
import mongoose, { Schema } from "mongoose";
import type {
  JourneyState,
  MemoryFact,
  TimelineEvent,
  ActionItem,
  InboxItem,
  StudentDocument,
  RiskReport,
  AppUser,
  EvidenceArtifact,
  Entitlement,
  AgentAction,
  CompanyTask,
  MockAttempt,
} from "../lib/types";

const journeySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    path: { type: String, default: "UG_STANDARD" },
    personaTags: { type: [Schema.Types.Mixed], default: [] },
    currentStage: { type: String, default: "orientation" },
    pacing: { type: String, default: "steady" },
    stages: { type: [Schema.Types.Mixed], default: [] },
    completedModules: { type: [String], default: [] },
    updatedAt: { type: String, required: true },
  },
  { collection: "journeys" }
);

const memoryFactSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    type: { type: String, default: "context" },
    value: { type: String, required: true },
    confidence: { type: Number, default: 0.6 },
    source: { type: String, default: "student_stated" },
    status: { type: String, default: "active", index: true },
    createdAt: { type: String, required: true },
  },
  { collection: "memory_facts" }
);

const eventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    ts: { type: String, required: true },
    kind: { type: String, required: true },
    module: String,
    summary: { type: String, required: true },
    status: String,
  },
  { collection: "events" }
);

const actionItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    why: { type: String, default: "" },
    module: { type: String, default: "self" },
    source: { type: String, default: "agent" },
    tags: { type: [String], default: [] },
    status: { type: String, default: "suggested", index: true },
    dueAt: String,
    followUpAt: { type: String, index: true },
    followUpCount: { type: Number, default: 0 },
    createdAt: { type: String, required: true },
    resolvedAt: String,
  },
  { collection: "action_items" }
);

const inboxItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    kind: { type: String, default: "nudge" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    cta: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    source: { type: String, default: "mock" },
    createdAt: { type: String, required: true },
  },
  { collection: "inbox_items" }
);

const documentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    kind: { type: String, default: "other" },
    filename: String,
    text: { type: String, default: "" },
    createdAt: { type: String, required: true },
  },
  { collection: "documents" }
);

const riskReportSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    overall: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    extracted: { type: [Schema.Types.Mixed], default: [] },
    inconsistencies: { type: [String], default: [] },
    weakPoints: { type: [String], default: [] },
    dimensions: { type: [Schema.Types.Mixed], default: [] },
    recommendation: { type: String, default: "" },
    createdAt: { type: String, required: true },
  },
  { collection: "risk_reports" }
);

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    googleSub: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: { type: String, default: "" },
    profileId: String,
    createdAt: { type: String, required: true },
  },
  { collection: "users" }
);

const evidenceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    whatYouDid: { type: String, default: "" },
    whoBenefited: String,
    proofUrl: String,
    skills: { type: [String], default: [] },
    reflection: String,
    linkedActionItemId: String,
    createdAt: { type: String, required: true },
  },
  { collection: "evidence" }
);

const entitlementSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true, index: true },
    product: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { collection: "entitlements" }
);

const agentActionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    agentId: { type: String, required: true, index: true },
    department: { type: String, default: "" },
    type: { type: String, required: true },
    external: { type: Boolean, default: false },
    channel: String,
    title: { type: String, default: "" },
    payload: { type: String, default: "" },
    riskLevel: { type: String, default: "low" },
    status: { type: String, default: "dry_run", index: true },
    result: String,
    createdAt: { type: String, required: true },
    resolvedAt: String,
  },
  { collection: "agent_actions" }
);

const companyTaskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    detail: { type: String, default: "" },
    department: { type: String, default: "", index: true },
    status: { type: String, default: "open", index: true },
    createdBy: { type: String, default: "ceo" },
    createdAt: { type: String, required: true },
    resolvedAt: String,
  },
  { collection: "company_tasks" }
);

const mockAttemptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, default: "", index: true },
    exam: { type: String, required: true },
    skill: { type: String, required: true },
    scaled: { type: Number, default: 0 },
    scaledLabel: { type: String, default: "" },
    rawCorrect: { type: Number },
    rawTotal: { type: Number },
    byType: { type: [Schema.Types.Mixed], default: [] },
    weakTypes: { type: [String], default: [] },
    feedback: { type: String, default: "" },
    analysis: { type: Schema.Types.Mixed },
    createdAt: { type: String, required: true },
  },
  { collection: "mock_attempts" }
);

function model<T>(name: string, schema: Schema): mongoose.Model<T> {
  return (mongoose.models[name] as mongoose.Model<T>) ?? (mongoose.model(name, schema) as unknown as mongoose.Model<T>);
}

export const JourneyModel = model<JourneyState>("Journey", journeySchema);
export const MemoryFactModel = model<MemoryFact>("MemoryFact", memoryFactSchema);
export const EventModel = model<TimelineEvent>("Event", eventSchema);
export const ActionItemModel = model<ActionItem>("ActionItem", actionItemSchema);
export const InboxItemModel = model<InboxItem>("InboxItem", inboxItemSchema);
export const DocumentModel = model<StudentDocument>("Document", documentSchema);
export const RiskReportModel = model<RiskReport>("RiskReport", riskReportSchema);
export const UserModel = model<AppUser>("User", userSchema);
export const EvidenceModel = model<EvidenceArtifact>("Evidence", evidenceSchema);
export const EntitlementModel = model<Entitlement>("Entitlement", entitlementSchema);
export const AgentActionModel = model<AgentAction>("AgentAction", agentActionSchema);
export const CompanyTaskModel = model<CompanyTask>("CompanyTask", companyTaskSchema);
export const MockAttemptModel = model<MockAttempt>("MockAttempt", mockAttemptSchema);
