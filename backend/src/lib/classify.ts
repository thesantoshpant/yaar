// Deterministic persona + journey classifier. No LLM, fully testable.
// Turns a thin profile into an adaptive journey: which path, which persona tags,
// what pacing, and which stage to focus on.
import type { StudentProfile, JourneyState, JourneyStage, PersonaTag } from "./types";

const STAGES_STANDARD: JourneyStage[] = [
  "orientation",
  "foundation",
  "profile_building",
  "testing",
  "school_list",
  "applications",
  "finances_aid",
  "visa_prep",
  "pre_departure",
];
const STAGES_COMPRESSED: JourneyStage[] = [
  "testing",
  "school_list",
  "applications",
  "finances_aid",
  "visa_prep",
  "pre_departure",
];
const STAGES_GRAD: JourneyStage[] = [
  "orientation",
  "testing",
  "profile_building",
  "school_list",
  "applications",
  "finances_aid",
  "visa_prep",
  "pre_departure",
];

const SEASON_MONTH: Record<string, number> = { spring: 0, summer: 5, fall: 8, winter: 11 };

export function parseIntakeDate(targetIntake?: string): Date | null {
  if (!targetIntake) return null;
  const m = targetIntake.toLowerCase().match(/(spring|summer|fall|winter)?\s*(\d{4})/);
  if (!m) return null;
  const year = Number(m[2]);
  const month = m[1] ? SEASON_MONTH[m[1]] : 8; // default to Fall
  return new Date(year, month, 1);
}

export function monthsToIntake(targetIntake?: string, from = new Date()): number | null {
  const d = parseIntakeDate(targetIntake);
  if (!d) return null;
  return (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
}

function looksLowEnglish(testStatus?: string): boolean {
  if (!testStatus) return true; // not started
  const s = testStatus.toLowerCase();
  if (/not\s*(taken|started|yet)/.test(s)) return true;
  const ielts = s.match(/ielts\s*([0-9.]+)/);
  if (ielts && Number(ielts[1]) < 6.5) return true;
  const toefl = s.match(/toefl\s*([0-9]+)/);
  if (toefl && Number(toefl[1]) < 90) return true;
  return false;
}

const STEM = ["computer", "cs", "data", "engineer", "math", "physics", "science", "tech"];

export function classify(profile: StudentProfile, from = new Date()): Omit<JourneyState, "id" | "updatedAt"> {
  const tags: { tag: PersonaTag; confidence: number; source: "rule" }[] = [];
  const months = monthsToIntake(profile.targetIntake, from);
  const noSupport = profile.schoolHasCounselor === false && profile.schoolHasClubs === false;
  const lowBudget = (profile.budgetUsdPerYear ?? 0) > 0 && (profile.budgetUsdPerYear ?? 0) < 15000;
  const isStem = STEM.some((k) => (profile.intendedMajor ?? "").toLowerCase().includes(k));

  let path: JourneyState["path"] = "UG_STANDARD";
  let pacing: JourneyState["pacing"] = "steady";

  if (profile.intendedLevel === "graduate") {
    path = "GRAD";
    tags.push({ tag: "grad_masters", confidence: 0.95, source: "rule" });
  } else if (noSupport && profile.familiarWithProcess === false) {
    path = "UG_RURAL_BOOTSTRAP";
    tags.push({ tag: "rural_first_gen", confidence: 0.9, source: "rule" });
    pacing = "patient";
  } else if (months != null && months < 10) {
    path = "UG_COMPRESSED";
    tags.push({ tag: "late_senior", confidence: 0.9, source: "rule" });
    pacing = "aggressive";
  } else if (profile.schoolHasCounselor && profile.schoolHasClubs) {
    tags.push({ tag: "urban_resourced", confidence: 0.7, source: "rule" });
  }

  if (profile.isRural && !tags.some((t) => t.tag === "rural_first_gen")) {
    tags.push({ tag: "rural_first_gen", confidence: 0.6, source: "rule" });
    if (pacing === "steady") pacing = "patient";
  }
  if (profile.wontGoWithoutAid || lowBudget) {
    tags.push({ tag: "aid_dependent", confidence: 0.8, source: "rule" });
  }
  if (isStem && looksLowEnglish(profile.testStatus)) {
    tags.push({ tag: "strong_stem_weak_english", confidence: 0.6, source: "rule" });
  }

  const stageList = path === "GRAD" ? STAGES_GRAD : path === "UG_COMPRESSED" ? STAGES_COMPRESSED : STAGES_STANDARD;
  const currentStage = stageList[0];
  const stages = stageList.map((stage, i) => ({
    stage,
    status: (i === 0 ? "active" : "available") as "active" | "available",
  }));

  return { profileId: profile.id, path, personaTags: tags, currentStage, pacing, stages };
}
