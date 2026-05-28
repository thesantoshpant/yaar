// The safety layer: kill switch + per-day Vertex spend cap. Every autonomous
// agent action and every Gemini call consults this gate before touching the
// world. Non-negotiable; without it a runaway loop can vaporize the founder's
// $300 Vertex credit between dinner and breakfast.
//
// State lives in memory at runtime (sync API for hot-path calls) but is
// hydrated from a Mongo singleton doc on boot and written through on every
// mutation. This means: a tsx-watch reload, a crash, or a redeploy preserves
// the kill switch and today's spend counter — the cap holds even mid-day.

import { config } from "../config";
import { dbConnected } from "../db";
import { OpsStateModel } from "../models/intelligence";

// Hard caps. Override via env in prod once we know real usage patterns.
const DAILY_HARD_CAP_USD = Number(process.env.DAILY_HARD_CAP_USD ?? 8);
const PER_USER_DAILY_CAP_USD = Number(process.env.PER_USER_DAILY_CAP_USD ?? 0.5);

// Conservative per-token price estimates (USD). We err high so the gate
// triggers before real billing does. Calibrated to Gemini 2.5 Flash pricing;
// override via env if model mix changes.
const PRICE_PER_M_INPUT_USD = Number(process.env.GEMINI_PRICE_INPUT_PER_M ?? 0.3);
const PRICE_PER_M_OUTPUT_USD = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M ?? 2.5);

interface SafetyState {
  killSwitchEngaged: boolean;
  reason: string; // last reason set, for the ops dashboard
  day: string; // YYYY-MM-DD UTC
  totalSpendUsd: number;
  callCount: number;
  perUserSpendUsd: Record<string, number>;
  perUserCallCount: Record<string, number>;
  // Recent (cap-hit) rejections, so the ops console can show what was blocked.
  recentRejections: { ts: string; reason: string; profileId?: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

const state: SafetyState = {
  killSwitchEngaged: false,
  reason: "",
  day: today(),
  totalSpendUsd: 0,
  callCount: 0,
  perUserSpendUsd: {},
  perUserCallCount: {},
  recentRejections: [],
};

// Hydration: on boot, pull the singleton ops_state doc from Mongo (if connected)
// so the kill switch + today's counters survive a process restart. Fire-and-forget
// so we never block the boot path on a slow Mongo.
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
function hydrate(): Promise<void> {
  if (hydrated || !dbConnected()) return Promise.resolve();
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const doc = await OpsStateModel.findOne({ id: "singleton" }).lean().exec();
      if (doc && doc.day === today()) {
        // Same UTC day -> resume the counters; if it's a new day we'll roll over below.
        state.killSwitchEngaged = Boolean(doc.killSwitchEngaged);
        state.reason = doc.reason ?? "";
        state.day = doc.day;
        state.totalSpendUsd = Number(doc.totalSpendUsd) || 0;
        state.callCount = Number(doc.callCount) || 0;
        state.perUserSpendUsd = (doc.perUserSpendUsd as Record<string, number>) ?? {};
        state.perUserCallCount = (doc.perUserCallCount as Record<string, number>) ?? {};
      } else if (doc) {
        // Different day -> keep kill switch but reset counters.
        state.killSwitchEngaged = Boolean(doc.killSwitchEngaged);
        state.reason = doc.reason ?? "";
      }
      hydrated = true;
    } catch (err) {
      console.error("[safety] hydrate failed:", err);
    }
  })();
  return hydratePromise;
}
void hydrate();

// Write-through. Fire-and-forget; the in-memory state remains source of truth
// for the hot path, Mongo is the durability layer for restarts.
function persist(): void {
  if (!dbConnected()) return;
  const doc = {
    killSwitchEngaged: state.killSwitchEngaged,
    reason: state.reason,
    day: state.day,
    totalSpendUsd: state.totalSpendUsd,
    callCount: state.callCount,
    perUserSpendUsd: state.perUserSpendUsd,
    perUserCallCount: state.perUserCallCount,
    updatedAt: new Date().toISOString(),
  };
  OpsStateModel.updateOne({ id: "singleton" }, { $set: doc }, { upsert: true }).catch((err) => {
    console.error("[safety] persist failed:", err);
  });
}

function rolloverIfNewDay(): void {
  const t = today();
  if (state.day === t) return;
  state.day = t;
  state.totalSpendUsd = 0;
  state.callCount = 0;
  state.perUserSpendUsd = {};
  state.perUserCallCount = {};
  // Keep recentRejections rolling across days, capped to the most recent.
  persist();
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_PER_M_INPUT_USD + outputTokens * PRICE_PER_M_OUTPUT_USD) / 1_000_000;
}

// Cheap default estimate when we don't know the call size yet. Sized so a
// 1k-call burst against this default still fits within the daily cap.
const DEFAULT_ESTIMATE_USD = 0.005;

// Consult before any Gemini call or external agent action. Returns ok=false
// if the kill switch is on, the day's hard cap is reached, or a per-user cap
// is reached. NEVER throws; callers check `ok` and short-circuit cleanly.
export function checkSpendOk(profileId?: string, estimateUsd: number = DEFAULT_ESTIMATE_USD): { ok: boolean; reason?: string } {
  rolloverIfNewDay();
  if (state.killSwitchEngaged) return rejectAndReport({ ok: false, reason: `kill switch engaged: ${state.reason || "no reason"}` }, profileId);
  if (state.totalSpendUsd + estimateUsd > DAILY_HARD_CAP_USD) {
    return rejectAndReport({ ok: false, reason: `daily spend cap reached ($${DAILY_HARD_CAP_USD})` }, profileId);
  }
  if (profileId) {
    const userUsed = state.perUserSpendUsd[profileId] ?? 0;
    if (userUsed + estimateUsd > PER_USER_DAILY_CAP_USD) {
      return rejectAndReport({ ok: false, reason: `per-user daily cap reached ($${PER_USER_DAILY_CAP_USD})` }, profileId);
    }
  }
  return { ok: true };
}

function rejectAndReport(result: { ok: boolean; reason: string }, profileId?: string): { ok: boolean; reason: string } {
  state.recentRejections.unshift({ ts: new Date().toISOString(), reason: result.reason, profileId });
  state.recentRejections = state.recentRejections.slice(0, 50);
  return result;
}

// Call after a Gemini interaction completes with the (estimated) cost. The
// `costUsd` can be 0 for failed/mocked calls so we don't double-count.
export function recordSpend(profileId: string | undefined, costUsd: number): void {
  rolloverIfNewDay();
  state.totalSpendUsd += Math.max(0, costUsd);
  state.callCount += 1;
  if (profileId) {
    state.perUserSpendUsd[profileId] = (state.perUserSpendUsd[profileId] ?? 0) + costUsd;
    state.perUserCallCount[profileId] = (state.perUserCallCount[profileId] ?? 0) + 1;
  }
  persist();
}

// Hard stop. Toggled from the ops console. When engaged, every external
// action and Gemini call is rejected until a human flips it back. Persisted
// so a restart doesn't silently re-open the door.
export function setKillSwitch(engaged: boolean, reason = ""): void {
  state.killSwitchEngaged = engaged;
  state.reason = engaged ? (reason || "manually engaged") : "";
  persist();
}

export function getSafetyStatus() {
  rolloverIfNewDay();
  return {
    killSwitchEngaged: state.killSwitchEngaged,
    reason: state.reason,
    day: state.day,
    totalSpendUsd: Number(state.totalSpendUsd.toFixed(4)),
    callCount: state.callCount,
    dailyHardCapUsd: DAILY_HARD_CAP_USD,
    perUserDailyCapUsd: PER_USER_DAILY_CAP_USD,
    autonomyMode: config.autonomyMode,
    topSpenders: Object.entries(state.perUserSpendUsd)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([profileId, usd]) => ({ profileId, usd: Number(usd.toFixed(4)), calls: state.perUserCallCount[profileId] ?? 0 })),
    recentRejections: state.recentRejections.slice(0, 20),
  };
}
