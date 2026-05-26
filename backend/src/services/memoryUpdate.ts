// Yaar's memory writer. After any meaningful interaction we extract durable facts
// about the student and append them to their persistent mind (MongoDB). Extraction
// from free text uses Gemini; structured sources (profile, evidence, documents) are
// remembered deterministically so they never depend on a model call.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import type { MemoryFact, StudentProfile, EvidenceArtifact } from "../lib/types";

type FactInput = Omit<MemoryFact, "id" | "createdAt" | "status">;

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

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

// Low-level: write facts straight to memory (dedupes by key via the store).
export async function rememberFacts(facts: FactInput[]): Promise<void> {
  const clean = facts.filter((f) => f && f.key && f.value && String(f.value).trim());
  if (clean.length) await store.addFacts(clean);
}

const SYSTEM = `You are the memory engine for Yaar, an AI counselor for international students.
From the interaction, extract durable, useful facts about THIS student. Be conservative: only record what was
actually stated or strongly implied. Do not invent. Use stable snake_case keys so the same fact updates over time
(e.g. goal.major, budget.per_year, test.toefl.status, context.rural, family.situation, skill.english, visa.concern).
Return ONLY JSON: { "facts": [ { "key": string, "type": "profile|context|goal|constraint|skill|preference|sensitive", "value": string, "confidence": 0..1, "sensitive": boolean } ], "noteForTimeline": string }`;

// Extract durable facts from any free-text interaction (chat, interview, coach session).
// Fire-and-forget so it never adds latency to the user's reply.
export function extractMemoryFrom(
  profileId: string,
  transcript: string,
  source: MemoryFact["source"] = "student_stated"
): void {
  void (async () => {
    try {
      const { data } = await generateJson<Extraction>({
        system: SYSTEM,
        prompt: `Interaction to mine for durable facts:\n${transcript}\n\nExtract the facts now.`,
        mock: () => ({ facts: [], noteForTimeline: "" }),
      });
      if (Array.isArray(data?.facts) && data.facts.length) {
        await rememberFacts(
          data.facts.map((f) => ({
            profileId,
            key: f.key,
            type: f.sensitive ? "sensitive" : f.type ?? "context",
            value: f.value,
            confidence: f.confidence ?? 0.6,
            source,
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

// Backwards-compatible alias used by the counselor chat route.
export function extractMemory(profileId: string, transcript: string): void {
  extractMemoryFrom(profileId, transcript, "student_stated");
}

// Seed/refresh facts from the structured profile form (deterministic, no model call).
export async function seedProfileFacts(profile: StudentProfile): Promise<void> {
  const f: FactInput[] = [];
  const add = (key: string, type: MemoryFact["type"], value?: string | null, confidence = 0.95) => {
    if (value && String(value).trim()) f.push({ profileId: profile.id, key, type, value: String(value), confidence, source: "student_stated" });
  };
  add("profile.country", "profile", profile.country);
  add("profile.level", "profile", profile.intendedLevel);
  add("goal.major", "goal", profile.intendedMajor);
  add("goal.career", "goal", profile.careerGoal);
  add("budget.per_year", "constraint", profile.budgetUsdPerYear ? `~$${profile.budgetUsdPerYear}/yr budget` : null);
  add("target.intake", "goal", profile.targetIntake);
  add("test.status", "profile", profile.testStatus);
  add("grade.level", "profile", profile.gradeLevel ? `grade ${profile.gradeLevel}` : null);
  if (profile.isRural) add("context.rural", "context", "Lives in a rural area");
  if (profile.firstGen) add("context.first_gen", "context", "First in family to study abroad");
  if (profile.schoolHasCounselor === false) add("context.no_counselor", "context", "School has no counselor");
  if (profile.schoolHasClubs === false) add("context.no_clubs", "context", "School has no clubs");
  await rememberFacts(f);
}

// Remember what a logged activity proves about the student (skills + the achievement).
export async function rememberEvidence(item: EvidenceArtifact): Promise<void> {
  const f: FactInput[] = [
    { profileId: item.profileId, key: `achievement.${slug(item.title)}`, type: "skill", value: `${item.title}: ${item.whatYouDid}`, confidence: 0.9, source: "module_outcome" },
  ];
  for (const s of item.skills ?? []) {
    f.push({ profileId: item.profileId, key: `skill.${slug(s)}`, type: "skill", value: `Demonstrated ${s} via "${item.title}"`, confidence: 0.85, source: "module_outcome" });
  }
  await rememberFacts(f);
}

// Remember the hard facts a student's visa documents revealed (school, cost, sponsor, funds).
export async function rememberExtractedDocFacts(profileId: string, extracted: { field: string; value: string }[]): Promise<void> {
  const f: FactInput[] = extracted
    .filter((e) => e.value && e.value.trim().toLowerCase() !== "not found")
    .map((e) => ({ profileId, key: `doc.${slug(e.field)}`, type: "profile" as const, value: `${e.field}: ${e.value}`, confidence: 0.9, source: "module_outcome" as const }));
  await rememberFacts(f);
}
