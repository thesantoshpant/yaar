// The single pipeline every student interaction flows through. Whatever a student
// does anywhere in the app, the route calls recordActivity() once: it logs a timeline
// event (the spine of "everything they've ever done") and feeds the memory engine so
// Yaar's picture of the student keeps growing and updating.
//
// Design guarantees:
//  - Failproof: each step is isolated in its own try/catch. A persistence hiccup can
//    never throw into the caller or break the student's actual response.
//  - Non-blocking: the whole thing runs detached (fire-and-forget), so recording an
//    activity adds zero latency to the API response the student is waiting on.
//  - Idempotent-ish memory: structured facts dedupe by key in the store (supersede),
//    so re-recording the same fact updates it instead of piling up duplicates.
import { store } from "../lib/store";
import { rememberFacts, extractMemoryFrom } from "./memoryUpdate";
import type { MemoryFact, TimelineEvent } from "../lib/types";

type FactInput = Omit<MemoryFact, "id" | "createdAt" | "status">;

export interface ActivityInput {
  module?: string; // ModuleKey-ish, for the timeline + deep links (e.g. "roadmap")
  kind?: TimelineEvent["kind"]; // defaults to "module_run"
  summary: string; // human one-liner for the activity feed
  status?: TimelineEvent["status"];
  facts?: FactInput[]; // deterministic facts to remember now (no model call)
  extractText?: string; // free text in the student's own words to mine with Gemini
  extractSource?: MemoryFact["source"];
}

// Record one interaction. Safe to call without awaiting; pass no profileId for guests
// (nothing is stored, but the call is still a no-op rather than an error).
export function recordActivity(profileId: string | undefined, input: ActivityInput): void {
  if (!profileId) return;
  void (async () => {
    try {
      await store.addEvent({
        profileId,
        kind: input.kind ?? "module_run",
        module: input.module,
        summary: input.summary,
        status: input.status ?? "done",
      });
    } catch (err) {
      console.error("[activity] event write failed:", err);
    }

    try {
      const clean = (input.facts ?? []).filter((f) => f && f.key && f.value && String(f.value).trim());
      if (clean.length) await rememberFacts(clean);
    } catch (err) {
      console.error("[activity] fact write failed:", err);
    }

    try {
      // Only mine text with real substance; tiny inputs aren't worth a model call.
      if (input.extractText && input.extractText.trim().length > 24) {
        extractMemoryFrom(profileId, input.extractText, input.extractSource ?? "module_outcome");
      }
    } catch (err) {
      console.error("[activity] memory extraction failed:", err);
    }
  })();
}
