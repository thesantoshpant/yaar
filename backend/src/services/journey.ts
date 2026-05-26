// Ensures every student has a persisted, persona-aware journey, and tracks module
// completion SERVER-SIDE (source of truth, consistent across devices).
import { store } from "../lib/store";
import { classify } from "../lib/classify";
import type { JourneyState, JourneyStage } from "../lib/types";

const MODULE_ORDER = ["roadmap", "test_prep", "school_search", "applications", "finances", "visa"];
const MODULE_TO_STAGE: Record<string, JourneyStage> = {
  roadmap: "foundation",
  test_prep: "testing",
  school_search: "school_list",
  applications: "applications",
  finances: "finances_aid",
  visa: "visa_prep",
};

// Recompute stage statuses + currentStage from the set of completed modules.
function applyProgress<T extends { stages: JourneyState["stages"] }>(
  base: T,
  completed: string[]
): T & { currentStage: JourneyStage; stages: JourneyState["stages"]; completedModules: string[] } {
  const doneStages = new Set(completed.map((m) => MODULE_TO_STAGE[m]).filter(Boolean));
  const nextModule = MODULE_ORDER.find((m) => !completed.includes(m));
  const currentStage: JourneyStage = nextModule ? MODULE_TO_STAGE[nextModule] : "pre_departure";
  const stages = base.stages.map((s) => ({
    stage: s.stage,
    status: doneStages.has(s.stage) ? "done" : s.stage === currentStage ? "active" : "available",
  })) as JourneyState["stages"];
  return { ...base, currentStage, stages, completedModules: completed };
}

export async function getOrCreateJourney(profileId: string): Promise<JourneyState | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;
  const existing = await store.getJourney(profileId);
  if (existing) return existing;
  return store.upsertJourney(applyProgress(classify(profile), []));
}

// Recompute from the latest profile, PRESERVING completed-module progress.
export async function recomputeJourney(profileId: string): Promise<JourneyState | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;
  const existing = await store.getJourney(profileId);
  const completed = existing?.completedModules ?? [];
  return store.upsertJourney(applyProgress(classify(profile), completed));
}

export async function markModuleComplete(profileId: string, module: string): Promise<JourneyState | null> {
  const journey = await getOrCreateJourney(profileId);
  if (!journey) return null;
  const completed = Array.from(new Set([...(journey.completedModules ?? []), module]));
  return store.upsertJourney(applyProgress(journey, completed));
}
