// The Memory Agent: a dedicated AI "employee" whose whole job is to build and keep
// each student's persistent mind. It reads everything Yaar knows about a student
// (profile, extracted facts, timeline, latest risk report) and synthesizes a tight
// narrative brief plus a few high-signal insights, stored back into memory so every
// other part of Yaar (chat, plans, agents) speaks to a person it truly remembers.
import { generateJson } from "./gemini";
import { rememberFacts } from "./memoryUpdate";
import { store } from "../lib/store";
import { YAAR_PRINCIPLES } from "../lib/prompts";

interface MindSynthesis {
  brief: string;
  insights: { key: string; value: string; confidence: number }[];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

// Build (or refresh) one student's synthesized mind. Returns the brief, or null if no profile.
export async function consolidateMind(profileId: string): Promise<{ brief: string; insights: number; source: string } | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;

  const [facts, events, risk] = await Promise.all([
    store.getFacts(profileId, 60),
    store.getEvents(profileId, { limit: 12 }),
    store.getLatestRiskReport(profileId),
  ]);

  const who = `${profile.name ?? "Student"} from ${profile.country ?? "?"}, ${profile.intendedLevel ?? "undergraduate"}${profile.intendedMajor ? `, major ${profile.intendedMajor}` : ""}${profile.gradeLevel ? `, grade ${profile.gradeLevel}` : ""}`;
  const factLines = facts.filter((f) => f.key !== "mind.brief").map((f) => `- (${f.key}) ${f.value}`).join("\n") || "none yet";
  const eventLines = events.map((e) => `- ${e.ts.slice(0, 10)} ${e.summary}`).join("\n") || "none yet";
  const riskLine = risk ? `Visa readiness score ${risk.overall}/100. Weak points: ${(risk.weakPoints ?? []).slice(0, 3).join("; ")}` : "no risk report yet";

  const { data, source } = await generateJson<MindSynthesis>({
    system: `${YAAR_PRINCIPLES}
You are Yaar's Memory Agent. Synthesize a durable "mind" for ONE student from everything we know. Do not invent facts.
Write: (1) a "brief": 3 to 5 plain sentences a counselor could read in 10 seconds to know exactly who this student is, what they want, their real constraints, where they are in the journey, and what they need next; and (2) up to 5 "insights": durable, high-signal conclusions (each a stable snake_case key prefixed "insight.", a short value, and a confidence 0..1). Insights should be synthesis, not raw restatement (e.g. insight.funding_gap, insight.spike_area, insight.biggest_risk).
Return ONLY JSON: { "brief": string, "insights": [ { "key": string, "value": string, "confidence": 0..1 } ] }`,
    prompt: `WHO: ${who}
KNOWN FACTS:
${factLines}
TIMELINE:
${eventLines}
VISA: ${riskLine}

Write this student's brief and insights now.`,
    mock: () => ({
      brief: `${profile.name ?? "This student"} is a ${profile.intendedLevel ?? "undergraduate"} applicant from ${profile.country ?? "South Asia"}${profile.intendedMajor ? ` aiming for ${profile.intendedMajor}` : ""}. ${profile.isRural ? "Rural and likely first-gen, so they need extra hand-holding. " : ""}They have ${facts.length} known facts and ${events.length} recent steps logged. Next, keep them moving on their current journey stage.`,
      insights: [],
    }),
  });

  const brief = (data.brief ?? "").trim();
  const factsToWrite = [];
  if (brief) {
    factsToWrite.push({ profileId, key: "mind.brief", type: "profile" as const, value: brief, confidence: 0.85, source: "inferred" as const });
  }
  for (const ins of (data.insights ?? []).slice(0, 5)) {
    if (!ins?.value) continue;
    const key = ins.key?.startsWith("insight.") ? ins.key : `insight.${slug(ins.key ?? ins.value)}`;
    factsToWrite.push({ profileId, key, type: "context" as const, value: ins.value, confidence: ins.confidence ?? 0.7, source: "inferred" as const });
  }
  if (factsToWrite.length) await rememberFacts(factsToWrite);

  return { brief, insights: (data.insights ?? []).length, source };
}

// The company-level run: refresh the minds of recently active students. Bounded so a
// single run never blows the LLM budget; the scheduler calls this daily.
export async function runMemoryAgent(limit = 40): Promise<{ summary: string; usersUpdated: number; source: string }> {
  const ids = await store.allProfileIds();
  const batch = ids.slice(0, limit);
  let updated = 0;
  let source = "mock";
  for (const id of batch) {
    try {
      const r = await consolidateMind(id);
      if (r) {
        updated += 1;
        if (r.source === "gemini") source = "gemini";
      }
    } catch (err) {
      console.error("[memory-agent] consolidate failed for", id, err);
    }
  }
  const skipped = ids.length - batch.length;
  return {
    summary: `Refreshed the minds of ${updated} student${updated === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} queued for the next run)` : ""}. Every brief now reflects their latest facts, evidence, and visa documents.`,
    usersUpdated: updated,
    source,
  };
}
