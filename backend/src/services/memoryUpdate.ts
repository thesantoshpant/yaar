// After a meaningful interaction, extract durable facts about the student and
// append them to memory. Fire-and-forget so it never adds latency to the reply.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import type { MemoryFact } from "../lib/types";

interface Extraction {
  facts: {
    key: string;
    type: MemoryFact["type"];
    value: string;
    confidence: number;
    sensitive?: boolean;
  }[];
  noteForTimeline?: string;
}

const SYSTEM = `You are the memory engine for Yaar, an AI counselor for international students.
From the conversation, extract durable, useful facts about THIS student. Be conservative: only record what was
actually stated or strongly implied. Do not invent. Use stable snake_case keys so the same fact updates over time
(e.g. goal.major, budget.per_year, test.toefl.status, context.rural, family.situation, skill.english).
Return ONLY JSON: { "facts": [ { "key": string, "type": "profile|context|goal|constraint|skill|preference|sensitive", "value": string, "confidence": 0..1, "sensitive": boolean } ], "noteForTimeline": string }`;

export function extractMemory(profileId: string, transcript: string): void {
  // intentionally not awaited by callers
  void (async () => {
    try {
      const { data } = await generateJson<Extraction>({
        system: SYSTEM,
        prompt: `Conversation just completed:\n${transcript}\n\nExtract durable facts now.`,
        mock: () => ({ facts: [], noteForTimeline: "" }),
      });

      if (Array.isArray(data?.facts) && data.facts.length) {
        await store.addFacts(
          data.facts
            .filter((f) => f && f.key && f.value)
            .map((f) => ({
              profileId,
              key: f.key,
              type: f.sensitive ? "sensitive" : f.type ?? "context",
              value: f.value,
              confidence: f.confidence ?? 0.6,
              source: "student_stated" as const,
            }))
        );
      }
      if (data.noteForTimeline) {
        await store.addEvent({ profileId, kind: "note", summary: data.noteForTimeline });
      }
    } catch (err) {
      console.error("[memory] extraction failed:", err);
    }
  })();
}
