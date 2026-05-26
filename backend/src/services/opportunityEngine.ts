// The "make your application stronger" engine: figure out the student's profile
// gaps, score the seeded opportunities for fit, pick a diverse personalized set,
// and turn them into tracked action items + inbox messages with a "why" and a
// concrete first step.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import { OPPORTUNITIES, GAP_TAGS } from "../data/opportunities";
import { monthsToIntake } from "../lib/classify";
import type { Opportunity, StudentProfile, InboxItem } from "../lib/types";

const GAP_WEIGHT: Record<string, number> = {
  english_score: 0.9,
  standardized_test: 0.7,
  cs_skill_evidence: 1.0,
  leadership: 0.9,
  competition_results: 0.6,
  credential: 0.7,
  community_impact: 0.8,
  research: 0.4,
  self_motivation: 0.5,
  process_knowledge: 0.6,
};

type Gaps = Record<string, { have: boolean; weight: number }>;

function lowEnglish(testStatus?: string): boolean {
  if (!testStatus) return true;
  const s = testStatus.toLowerCase();
  if (/not\s*(taken|started|yet)/.test(s)) return true;
  const ielts = s.match(/ielts\s*([0-9.]+)/);
  if (ielts && Number(ielts[1]) < 6.5) return true;
  const toefl = s.match(/toefl\s*([0-9]+)/);
  if (toefl && Number(toefl[1]) < 90) return true;
  return false;
}

async function computeGaps(profile: StudentProfile): Promise<Gaps> {
  const gaps: Gaps = {};
  for (const tag of GAP_TAGS) gaps[tag] = { have: false, weight: GAP_WEIGHT[tag] ?? 0.5 };
  if (!lowEnglish(profile.testStatus)) {
    gaps.english_score.have = true;
    gaps.standardized_test.have = true;
  }
  // anything the student already acted on closes that gap
  const done = await store.getActionItems(profile.id, "done");
  for (const a of done) for (const t of a.tags ?? []) if (gaps[t]) gaps[t].have = true;
  return gaps;
}

function regionOk(opp: Opportunity, country: string): boolean {
  return (
    opp.regions.includes("global") ||
    opp.regions.includes(country) ||
    opp.regions.includes("South Asia")
  );
}

function scoreOpportunity(opp: Opportunity, profile: StudentProfile, gaps: Gaps, monthsLeft: number | null): number {
  // Graduate applicants should not be matched to high-school-only opportunities.
  const levelOk =
    profile.intendedLevel === "graduate"
      ? opp.levels.includes("graduate")
      : opp.levels.includes("undergraduate") || opp.levels.includes("highschool");
  if (!levelOk) return 0;
  if (!regionOk(opp, profile.country)) return 0;

  let score = 0;
  for (const tag of opp.strengthens) {
    const g = gaps[tag];
    if (g && !g.have) score += g.weight * 30;
  }
  const major = (profile.intendedMajor ?? "").toLowerCase();
  if (opp.majors.some((m) => m !== "any" && major.includes(m))) score += 15;
  else if (opp.majors.includes("any")) score += 6;

  if (opp.cost === "free") score += 12;
  if (opp.cost === "pays_student") score += 18;
  if (opp.cost === "high") score -= 25;
  if (opp.lowBandwidth) score += 6;
  if (!opp.requiresSchoolSupport) score += 8;
  if (opp.selfStartable) score += 8;

  if (monthsLeft != null && monthsLeft < 6 && opp.category === "test") score += 8; // urgency
  return Math.max(0, Math.min(100, Math.round(score)));
}

function diversify(scored: { opp: Opportunity; fit: number }[], take: number, leadershipOpen: boolean) {
  const picks: { opp: Opportunity; fit: number }[] = [];
  const usedCategory = new Set<string>();
  for (const s of scored) {
    if (picks.length >= take) break;
    if (usedCategory.has(s.opp.category)) continue;
    picks.push(s);
    usedCategory.add(s.opp.category);
  }
  // guarantee at least one self-startable initiative if leadership is missing
  if (leadershipOpen && !picks.some((p) => p.opp.selfStartable)) {
    const init = scored.find((s) => s.opp.selfStartable);
    if (init) picks.splice(Math.max(0, picks.length - 1), 1, init);
  }
  return picks;
}

interface DropResult {
  inbox: InboxItem[];
  source: string;
}

export async function runWeeklyDrop(profileId: string, take = 4): Promise<DropResult | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;

  const gaps = await computeGaps(profile);
  const monthsLeft = monthsToIntake(profile.targetIntake);

  // Don't re-suggest anything we've ever suggested (open, done, skipped, or expired).
  const existing = await store.getActionItems(profileId);
  const alreadySuggested = new Set(existing.map((a) => a.title));

  const scored = OPPORTUNITIES.map((opp) => ({ opp, fit: scoreOpportunity(opp, profile, gaps, monthsLeft) }))
    .filter((s) => s.fit > 0 && !alreadySuggested.has(s.opp.title))
    .sort((a, b) => b.fit - a.fit);

  const picks = diversify(scored, take, gaps.leadership?.have === false);

  // one Gemini call to write a personal "why this fits you" + "first step" for all picks
  const { data, source } = await generateJson<{ items: { id: string; why: string; firstStep: string }[] }>({
    system: `You are Yaar, the student's unbiased AI counselor. For each opportunity, write a warm, specific 1-2 sentence "why this fits YOU" using the student's situation, and one concrete "first step" they can do today. Be honest, encouraging, and concrete. Return ONLY JSON: { "items": [ { "id": string, "why": string, "firstStep": string } ] }`,
    prompt: `Student: ${profile.name}, ${profile.country}, ${profile.intendedLevel} ${profile.intendedMajor ?? ""}, target ${profile.targetIntake ?? "?"}, ${profile.isRural ? "rural, " : ""}${profile.firstGen ? "first-generation, " : ""}tests: ${profile.testStatus ?? "not started"}.
Opportunities:\n${picks.map((p) => `- id=${p.opp.id}: ${p.opp.title} — ${p.opp.summary}`).join("\n")}\nWrite the items now.`,
    mock: () => ({
      items: picks.map((p) => ({
        id: p.opp.id,
        why: `${p.opp.summary} A strong, accessible step for a ${profile.intendedMajor ?? "your-field"} applicant from ${profile.country}.`,
        firstStep: p.opp.firstStepHint ?? "Open the link and take the first small step today.",
      })),
    }),
  });

  const genItems = Array.isArray(data?.items) ? data.items : [];
  const byId = new Map(genItems.map((i) => [i.id, i]));
  const inbox: InboxItem[] = [];
  const followUpAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

  for (const { opp, fit } of picks) {
    const gen = byId.get(opp.id);
    const why = gen?.why ?? opp.summary;
    const firstStep = gen?.firstStep ?? opp.firstStepHint ?? "Take the first small step today.";

    const action = await store.createActionItem({
      profileId,
      title: opp.title,
      why,
      module: opp.selfStartable ? "self" : "applications",
      source: "weekly_opportunity_drop",
      tags: opp.strengthens,
      dueAt: undefined,
      followUpAt,
    });

    const item = await store.addInboxItem({
      profileId,
      kind: "opportunity",
      title: opp.selfStartable ? `Build your profile: ${opp.title}` : `This week for you: ${opp.title}`,
      body: `${why}\n\nFirst step: ${firstStep}${opp.url ? `\n\nLink: ${opp.url}` : ""}  (fit ${fit}/100)`,
      cta: { label: "Add to my plan", actionItemId: action.id, url: opp.url },
      source: source === "gemini" ? "gemini" : "mock",
    });
    inbox.push(item);
    await store.addEvent({ profileId, kind: "suggestion", module: "opportunity", summary: `Suggested: ${opp.title}`, status: "open" });
  }

  return { inbox, source };
}
