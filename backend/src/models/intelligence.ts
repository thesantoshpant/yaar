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
