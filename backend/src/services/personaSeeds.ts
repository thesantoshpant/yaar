// One-click sample students. Each persona spins up a fully fleshed profile: structured
// fields, seeded memory facts (including chat-style nuances), a logged activity, and a
// consolidated "mind". This makes the whole product instantly demo-able and proves Yaar
// adapts to very different students and journeys (rural first-gen, urban grad, aid-dependent).
import { store } from "../lib/store";
import { classify } from "../lib/classify";
import { seedProfileFacts, rememberFacts, rememberEvidence } from "./memoryUpdate";
import { consolidateMind } from "./memoryAgent";
import type { MemoryFact, StudentProfile } from "../lib/types";

interface Persona {
  key: string;
  label: string;
  blurb: string;
  profile: Partial<StudentProfile> & { name: string; country: string };
  facts: { key: string; type: MemoryFact["type"]; value: string; confidence: number }[];
  evidence: { title: string; whatYouDid: string; skills: string[]; whoBenefited?: string };
}

export const PERSONAS: Persona[] = [
  {
    key: "rural_firstgen",
    label: "🌾 Ramesh — rural, first-gen",
    blurb: "Grade 11 in rural Nepal, no counselor, $5k budget, dreams of CS but unsure it's even possible.",
    profile: {
      name: "Ramesh", country: "Nepal", intendedLevel: "undergraduate", intendedMajor: "Computer Science",
      gradeLevel: "11", budgetUsdPerYear: 5000, targetIntake: "Fall 2027", testStatus: "Haven't started",
      careerGoal: "build technology that helps my village", isRural: true, firstGen: true,
      schoolHasCounselor: false, schoolHasClubs: false, wontGoWithoutAid: true,
    },
    facts: [
      { key: "concern.affordability", type: "constraint", value: "Worried $5k is far too little and the US is out of reach", confidence: 0.9 },
      { key: "context.no_internet", type: "context", value: "Shares one phone with the family and has weak internet", confidence: 0.8 },
      { key: "spike.self_taught", type: "skill", value: "Teaching himself to code from free YouTube tutorials", confidence: 0.85 },
    ],
    evidence: { title: "Weekend coding lessons", whatYouDid: "Taught 6 neighbourhood kids basic Scratch every Saturday for 8 weeks", skills: ["teaching", "leadership", "initiative"], whoBenefited: "6 kids in my village" },
  },
  {
    key: "urban_grad",
    label: "🏙️ Aditya — urban grad applicant",
    blurb: "India, gap year after a strong CS bachelor's, $30k, aiming for a funded master's and an assistantship.",
    profile: {
      name: "Aditya", country: "India", intendedLevel: "graduate", intendedMajor: "Computer Science",
      gradeLevel: "bachelors", budgetUsdPerYear: 30000, targetIntake: "Fall 2026", testStatus: "Studying now",
      careerGoal: "AI research and a teaching/research assistantship", isRural: false, firstGen: false,
      schoolHasCounselor: true, schoolHasClubs: true,
    },
    facts: [
      { key: "strength.projects", type: "skill", value: "Strong portfolio: published an ML side project with real users", confidence: 0.9 },
      { key: "concern.speaking", type: "constraint", value: "Nervous about the TOEFL speaking section despite strong writing", confidence: 0.85 },
      { key: "goal.funding", type: "goal", value: "Wants assistantship/RA funding, not just admission", confidence: 0.9 },
    ],
    evidence: { title: "Open-source ML tool", whatYouDid: "Built and shipped an ML tool that 200+ developers now use", skills: ["machine learning", "software engineering", "communication"], whoBenefited: "200+ developers" },
  },
  {
    key: "aid_dependent",
    label: "💸 Sita — needs full aid",
    blurb: "Grade 12 in Nepal, first-gen, $8k, won't go without major scholarship; wants public health.",
    profile: {
      name: "Sita", country: "Nepal", intendedLevel: "undergraduate", intendedMajor: "Public Health",
      gradeLevel: "12", budgetUsdPerYear: 8000, targetIntake: "Fall 2026", testStatus: "Already took it",
      careerGoal: "become a doctor and improve rural healthcare", isRural: false, firstGen: true,
      schoolHasCounselor: false, schoolHasClubs: true, wontGoWithoutAid: true,
    },
    facts: [
      { key: "constraint.aid_required", type: "constraint", value: "Cannot attend without a near-full scholarship", confidence: 0.95 },
      { key: "test.ielts", type: "profile", value: "Already took IELTS, scored 7.0", confidence: 0.9 },
      { key: "spike.health", type: "skill", value: "Volunteers at a local clinic and ran a hygiene awareness drive", confidence: 0.85 },
    ],
    evidence: { title: "Hygiene awareness drive", whatYouDid: "Organized a hygiene and handwashing campaign reaching 3 schools", skills: ["organizing", "public health", "leadership"], whoBenefited: "students at 3 local schools" },
  },
];

export function listPersonas() {
  return PERSONAS.map((p) => ({ key: p.key, label: p.label, blurb: p.blurb }));
}

export async function seedPersona(key: string): Promise<StudentProfile | null> {
  const persona = PERSONAS.find((p) => p.key === key);
  if (!persona) return null;

  const profile = await store.createProfile(persona.profile as Omit<StudentProfile, "id" | "createdAt">);
  await store.upsertJourney(classify(profile));
  await store.addEvent({ profileId: profile.id, kind: "signup", summary: `Joined Yaar from ${profile.country} (sample student)` });
  await seedProfileFacts(profile);
  await rememberFacts(persona.facts.map((f) => ({ profileId: profile.id, key: f.key, type: f.type, value: f.value, confidence: f.confidence, source: "student_stated" as const })));
  const ev = await store.addEvidence({ profileId: profile.id, ...persona.evidence });
  await rememberEvidence(ev);
  await consolidateMind(profile.id); // build the synthesized brief so the demo feels alive
  return profile;
}
