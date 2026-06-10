// Builds a short system-prompt prefix that adapts Yaar's voice to the student's
// situation. This is the cheapest, highest-leverage personalization lever.
import type { JourneyState, PersonaTag } from "./types";

const REGISTER: Partial<Record<PersonaTag, string>> = {
  rural_first_gen:
    "This student is rural and first-generation: assume no school counselor, no clubs, possibly no nearby test center, and a family unfamiliar with US admissions. Never recommend resources that require an existing school program. Prefer free, online, low-bandwidth, self-startable options. Define any jargon. Be encouraging and patient.",
  aid_dependent:
    "This student needs major financial aid. Only suggest schools that are generous to international students; always lead with realistic net price after aid, and surface fee waivers. Treat full-aid reaches as legitimate, not fantasy.",
  late_senior:
    "Time is short. Be triage-minded and brutally honest about what is achievable this cycle versus deferring one year. Prefer rolling and spring-admit options and the fastest test routes.",
  strong_stem_weak_english:
    "English is the gating step. Prioritize speaking/writing practice and flag English readiness for both admission and the visa interview.",
  grad_masters:
    "This is a graduate applicant: focus on research fit, recommendation letters from professors, assistantships and funding, and program fit over school brand.",
  urban_resourced:
    "This student has school support; skip the basics and focus on optimization, rigor, and differentiation.",
  high_achieve_low_income:
    "Strong student, low income: aim high at need-blind / meets-full-need schools and make the financial path explicit.",
};

export function personaPreamble(journey: JourneyState | null): string {
  if (!journey) return "";
  const lines = [...journey.personaTags]
    .sort((a, b) => b.confidence - a.confidence)
    .map((t) => REGISTER[t.tag])
    .filter(Boolean);
  if (lines.length === 0) return "";
  return `Student context for personalization:\n- ${lines.join("\n- ")}\nPacing: ${journey.pacing}. Current focus stage: ${journey.currentStage}.`;
}
