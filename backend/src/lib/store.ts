// Storage layer. Uses MongoDB when connected, otherwise in-memory collections.
// Same async interface either way, so routes do not care which backend is active.
import { nanoid } from "nanoid";
import type {
  StudentProfile,
  JourneyState,
  MemoryFact,
  TimelineEvent,
  ActionItem,
  InboxItem,
  StudentDocument,
  RiskReport,
  AppUser,
} from "./types";
import { dbConnected } from "../db";
import { ProfileModel } from "../models/Profile";
import {
  JourneyModel,
  MemoryFactModel,
  EventModel,
  ActionItemModel,
  InboxItemModel,
  DocumentModel,
  RiskReportModel,
  UserModel,
} from "../models/intelligence";

// ---- in-memory fallback collections ----
const mem = {
  profiles: new Map<string, StudentProfile>(),
  journeys: new Map<string, JourneyState>(), // keyed by profileId
  facts: [] as MemoryFact[],
  events: [] as TimelineEvent[],
  actions: new Map<string, ActionItem>(),
  inbox: [] as InboxItem[],
  documents: [] as StudentDocument[],
  riskReports: [] as RiskReport[],
  users: new Map<string, AppUser>(), // keyed by id
};

const now = () => new Date().toISOString();
function clean<T extends object>(doc: T): T {
  // strip Mongo internals from lean docs
  const { _id, __v, ...rest } = doc as Record<string, unknown>;
  return rest as T;
}

export const store = {
  // ---------- profiles ----------
  async createProfile(input: Omit<StudentProfile, "id" | "createdAt">): Promise<StudentProfile> {
    const profile: StudentProfile = { ...input, id: nanoid(10), createdAt: now() };
    if (dbConnected()) await ProfileModel.create(profile);
    else mem.profiles.set(profile.id, profile);
    return profile;
  },

  async getProfile(id: string): Promise<StudentProfile | null> {
    if (dbConnected()) {
      const doc = await ProfileModel.findOne({ id }).lean<StudentProfile>().exec();
      return doc ? clean(doc) : null;
    }
    return mem.profiles.get(id) ?? null;
  },

  async updateProfile(id: string, patch: Partial<StudentProfile>): Promise<StudentProfile | null> {
    if (dbConnected()) {
      const doc = await ProfileModel.findOneAndUpdate({ id }, { $set: patch }, { new: true })
        .lean<StudentProfile>()
        .exec();
      return doc ? clean(doc) : null;
    }
    const existing = mem.profiles.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    mem.profiles.set(id, updated);
    return updated;
  },

  // ---------- journey ----------
  async getJourney(profileId: string): Promise<JourneyState | null> {
    if (dbConnected()) {
      const doc = await JourneyModel.findOne({ profileId }).lean<JourneyState>().exec();
      return doc ? clean(doc) : null;
    }
    return mem.journeys.get(profileId) ?? null;
  },

  async upsertJourney(state: Omit<JourneyState, "id" | "updatedAt"> & { id?: string }): Promise<JourneyState> {
    const full: JourneyState = {
      ...state,
      id: state.id ?? nanoid(10),
      updatedAt: now(),
    };
    if (dbConnected()) {
      await JourneyModel.findOneAndUpdate({ profileId: full.profileId }, { $set: full }, { upsert: true }).exec();
    } else {
      mem.journeys.set(full.profileId, full);
    }
    return full;
  },

  // ---------- memory facts ----------
  async addFacts(facts: Omit<MemoryFact, "id" | "createdAt" | "status">[]): Promise<void> {
    for (const f of facts) {
      const fact: MemoryFact = { ...f, id: nanoid(10), status: "active", createdAt: now() };
      if (dbConnected()) {
        // supersede any active fact with the same key, then insert
        await MemoryFactModel.updateMany(
          { profileId: fact.profileId, key: fact.key, status: "active" },
          { $set: { status: "superseded" } }
        ).exec();
        await MemoryFactModel.create(fact);
      } else {
        mem.facts.forEach((x) => {
          if (x.profileId === fact.profileId && x.key === fact.key && x.status === "active") x.status = "superseded";
        });
        mem.facts.push(fact);
      }
    }
  },

  async getFacts(profileId: string, limit = 40): Promise<MemoryFact[]> {
    if (dbConnected()) {
      const docs = await MemoryFactModel.find({ profileId, status: "active" })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<MemoryFact[]>()
        .exec();
      return docs.map(clean);
    }
    return mem.facts.filter((f) => f.profileId === profileId && f.status === "active").slice(-limit).reverse();
  },

  // ---------- timeline events ----------
  async addEvent(ev: Omit<TimelineEvent, "id" | "ts"> & { ts?: string }): Promise<TimelineEvent> {
    const event: TimelineEvent = { ...ev, id: nanoid(10), ts: ev.ts ?? now() };
    if (dbConnected()) await EventModel.create(event);
    else mem.events.push(event);
    return event;
  },

  async getEvents(profileId: string, opts: { limit?: number; kind?: string } = {}): Promise<TimelineEvent[]> {
    const limit = opts.limit ?? 10;
    if (dbConnected()) {
      const q: Record<string, unknown> = { profileId };
      if (opts.kind) q.kind = opts.kind;
      const docs = await EventModel.find(q).sort({ ts: -1 }).limit(limit).lean<TimelineEvent[]>().exec();
      return docs.map(clean);
    }
    return mem.events
      .filter((e) => e.profileId === profileId && (!opts.kind || e.kind === opts.kind))
      .slice(-limit)
      .reverse();
  },

  // ---------- action items ----------
  async createActionItem(input: Omit<ActionItem, "id" | "createdAt" | "followUpCount" | "status"> & { status?: ActionItem["status"] }): Promise<ActionItem> {
    const item: ActionItem = {
      ...input,
      id: nanoid(10),
      status: input.status ?? "suggested",
      followUpCount: 0,
      createdAt: now(),
    };
    if (dbConnected()) await ActionItemModel.create(item);
    else mem.actions.set(item.id, item);
    return item;
  },

  async getActionItems(profileId: string, status?: ActionItem["status"]): Promise<ActionItem[]> {
    if (dbConnected()) {
      const q: Record<string, unknown> = { profileId };
      if (status) q.status = status;
      const docs = await ActionItemModel.find(q).sort({ createdAt: -1 }).lean<ActionItem[]>().exec();
      return docs.map(clean);
    }
    return [...mem.actions.values()]
      .filter((a) => a.profileId === profileId && (!status || a.status === status))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async getActionItem(id: string): Promise<ActionItem | null> {
    if (dbConnected()) {
      const doc = await ActionItemModel.findOne({ id }).lean<ActionItem>().exec();
      return doc ? clean(doc) : null;
    }
    return mem.actions.get(id) ?? null;
  },

  async updateActionItem(id: string, patch: Partial<ActionItem>): Promise<ActionItem | null> {
    if (dbConnected()) {
      const doc = await ActionItemModel.findOneAndUpdate({ id }, { $set: patch }, { new: true })
        .lean<ActionItem>()
        .exec();
      return doc ? clean(doc) : null;
    }
    const existing = mem.actions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    mem.actions.set(id, updated);
    return updated;
  },

  // action items whose follow-up time has arrived and are still open
  async getActionItemsDueForFollowup(nowIso: string): Promise<ActionItem[]> {
    if (dbConnected()) {
      const docs = await ActionItemModel.find({
        status: { $in: ["suggested", "in_progress"] },
        followUpAt: { $lte: nowIso },
      })
        .limit(200)
        .lean<ActionItem[]>()
        .exec();
      return docs.map(clean);
    }
    return [...mem.actions.values()].filter(
      (a) => ["suggested", "in_progress"].includes(a.status) && a.followUpAt != null && a.followUpAt <= nowIso
    );
  },

  // ---------- inbox ----------
  async addInboxItem(input: Omit<InboxItem, "id" | "createdAt" | "read"> & { read?: boolean }): Promise<InboxItem> {
    const item: InboxItem = { ...input, id: nanoid(10), read: input.read ?? false, createdAt: now() };
    if (dbConnected()) await InboxItemModel.create(item);
    else mem.inbox.push(item);
    return item;
  },

  async getInbox(profileId: string, limit = 50): Promise<InboxItem[]> {
    if (dbConnected()) {
      const docs = await InboxItemModel.find({ profileId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<InboxItem[]>()
        .exec();
      return docs.map(clean);
    }
    return mem.inbox.filter((i) => i.profileId === profileId).slice(-limit).reverse();
  },

  async markInboxRead(id: string): Promise<void> {
    if (dbConnected()) {
      await InboxItemModel.updateOne({ id }, { $set: { read: true } }).exec();
    } else {
      const item = mem.inbox.find((i) => i.id === id);
      if (item) item.read = true;
    }
  },

  // ---------- documents ----------
  async addDocument(input: Omit<StudentDocument, "id" | "createdAt">): Promise<StudentDocument> {
    const doc: StudentDocument = { ...input, id: nanoid(10), createdAt: now() };
    if (dbConnected()) await DocumentModel.create(doc);
    else mem.documents.push(doc);
    return doc;
  },

  async getDocuments(profileId: string): Promise<StudentDocument[]> {
    if (dbConnected()) {
      const docs = await DocumentModel.find({ profileId }).sort({ createdAt: -1 }).lean<StudentDocument[]>().exec();
      return docs.map(clean);
    }
    return mem.documents.filter((d) => d.profileId === profileId);
  },

  // ---------- risk reports ----------
  async saveRiskReport(input: Omit<RiskReport, "id" | "createdAt">): Promise<RiskReport> {
    const report: RiskReport = { ...input, id: nanoid(10), createdAt: now() };
    if (dbConnected()) await RiskReportModel.create(report);
    else mem.riskReports.push(report);
    return report;
  },

  async getLatestRiskReport(profileId: string): Promise<RiskReport | null> {
    if (dbConnected()) {
      const doc = await RiskReportModel.findOne({ profileId }).sort({ createdAt: -1 }).lean<RiskReport>().exec();
      return doc ? clean(doc) : null;
    }
    const list = mem.riskReports.filter((r) => r.profileId === profileId);
    return list.length ? list[list.length - 1] : null;
  },

  // ---------- users (auth) ----------
  async upsertUserByGoogle(input: { googleSub: string; email: string; name: string }): Promise<AppUser> {
    if (dbConnected()) {
      const existing = await UserModel.findOne({ googleSub: input.googleSub }).lean<AppUser>().exec();
      if (existing) return clean(existing);
      const user: AppUser = { ...input, id: nanoid(12), createdAt: now() };
      await UserModel.create(user);
      return user;
    }
    for (const u of mem.users.values()) if (u.googleSub === input.googleSub) return u;
    const user: AppUser = { ...input, id: nanoid(12), createdAt: now() };
    mem.users.set(user.id, user);
    return user;
  },

  async getUser(id: string): Promise<AppUser | null> {
    if (dbConnected()) {
      const doc = await UserModel.findOne({ id }).lean<AppUser>().exec();
      return doc ? clean(doc) : null;
    }
    return mem.users.get(id) ?? null;
  },

  // list all profile ids (used by scheduled jobs)
  async allProfileIds(): Promise<string[]> {
    if (dbConnected()) {
      const docs = await ProfileModel.find({}, { id: 1 }).lean<{ id: string }[]>().exec();
      return docs.map((d) => d.id);
    }
    return [...mem.profiles.keys()];
  },
};
