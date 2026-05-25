// Ensures every student has a persisted, persona-aware journey state.
import { store } from "../lib/store";
import { classify } from "../lib/classify";
import type { JourneyState } from "../lib/types";

export async function getOrCreateJourney(profileId: string): Promise<JourneyState | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;
  const existing = await store.getJourney(profileId);
  if (existing) return existing;
  const fresh = classify(profile);
  return store.upsertJourney(fresh);
}

// Recompute from the latest profile (call after the student updates their profile).
export async function recomputeJourney(profileId: string): Promise<JourneyState | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;
  return store.upsertJourney(classify(profile));
}
