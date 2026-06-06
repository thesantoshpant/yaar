// Parent mode: turn everything Yaar knows about a student into a warm, plain-language
// update a parent can actually read, in their own language if they want. Parents are
// the ones who fund the journey and worry the most, so this is both a trust builder
// and the long-term-value (LTV) play. Honest: real costs, real next steps, no guarantees.
import { generateJson } from "./gemini";
import { buildContextPack } from "./contextPack";
import { store } from "../lib/store";
import { YAAR_PRINCIPLES } from "../lib/prompts";

export interface ParentReport {
  childName: string;
  whereTheyAre: string;
  doingWell: string;
  watchFor: string;
  theMoney: string;
  howYouCanHelp: string[];
  nextMilestones: string[];
  language: string;
  source: string;
}

export async function generateParentReport(profileId: string, language = "English"): Promise<ParentReport | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;

  const [ctx, risk] = await Promise.all([buildContextPack(profileId), store.getLatestRiskReport(profileId)]);
  const childName = profile.name && profile.name !== "Student" ? profile.name : "your child";
  const money = risk
    ? `Visa readiness so far: ${risk.overall}/100. Funding notes: ${(risk.inconsistencies ?? []).slice(0, 2).join("; ") || "no obvious funding gaps flagged yet"}.`
    : "No visa document review done yet, so the funding picture is still being built.";

  const { data, source } = await generateJson<Omit<ParentReport, "language" | "source" | "childName">>({
    profileId,
    system: `${YAAR_PRINCIPLES}
You are writing a private update for the PARENT of an international student, from Yaar (the student's AI counselor). The parent may not know the US system and may worry about cost and safety. Be warm, calm, and completely honest. Use simple words a non-expert parent understands. Explain any term in a few words. Never guarantee admission or a visa. Be specific to THIS student using the context provided; do not invent facts.
Write the ENTIRE report in this language: ${language}. (If it is not English, write naturally in that language, not a translation that sounds robotic.)
Return ONLY JSON with these fields, each warm and plain:
{ "whereTheyAre": string (2-3 sentences: what stage of the journey their child is at right now),
  "doingWell": string (1-2 sentences: genuine strengths and progress, specific),
  "watchFor": string (1-2 sentences: the honest, gentle "here is what still needs work" without alarming),
  "theMoney": string (2-3 sentences: the real cost picture and funding status in plain terms),
  "howYouCanHelp": string[] (3-4 concrete, doable things this parent can do to support their child),
  "nextMilestones": string[] (3-4 short upcoming milestones in order) }`,
    prompt: `What we know about the student:\n${ctx || `${childName}, ${profile.country}, ${profile.intendedLevel}`}\n\nMoney/visa context: ${money}\n\nWrite the parent report now, about ${childName}.`,
    mock: () => ({
      whereTheyAre: `${childName} is early in the journey of applying to study in the United States. Yaar is guiding them step by step, starting with a clear plan.`,
      doingWell: `${childName} has started planning seriously, which is the hardest first step. That focus is a real strength.`,
      watchFor: "The main things to keep building are English test scores and a clear, honest funding plan. Nothing here is a problem yet, just the next work.",
      theMoney: "Studying in the US can cost a lot, but many schools give large scholarships to international students. The goal is to choose schools where the real cost fits your family and the funding is believable for the visa.",
      howYouCanHelp: ["Talk with your child about a realistic yearly budget", "Keep bank and sponsor documents organized and honest", "Encourage steady English practice", "Trust the step-by-step plan instead of rushing"],
      nextMilestones: ["Finish a personalized roadmap", "Take or plan the English test (TOEFL/IELTS)", "Build a balanced school list that fits the budget", "Prepare funding documents for the I-20"],
    }),
  });

  return {
    childName,
    whereTheyAre: data.whereTheyAre ?? "",
    doingWell: data.doingWell ?? "",
    watchFor: data.watchFor ?? "",
    theMoney: data.theMoney ?? "",
    howYouCanHelp: Array.isArray(data.howYouCanHelp) ? data.howYouCanHelp : [],
    nextMilestones: Array.isArray(data.nextMilestones) ? data.nextMilestones : [],
    language,
    source,
  };
}
