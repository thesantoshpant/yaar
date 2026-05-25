// Scoring rubrics. These drive both the Gemini prompts and the mock fallbacks,
// so the product behaves consistently with or without a key.

// F-1 visa interview is judged largely under INA section 214(b): the applicant
// must overcome the presumption of immigrant intent and show they are a genuine,
// funded, prepared student with ties to home.
export const VISA_DIMENSIONS = [
  {
    name: "Nonimmigrant intent and ties to home",
    description: "Credible reasons to return home after studies: family, career plans, assets, commitments.",
  },
  {
    name: "Financial capability",
    description: "Clear, consistent funding that matches the I-20. Knows who pays and how.",
  },
  {
    name: "Academic preparedness and study plan",
    description: "Knows the program, why this school, how it fits the career goal.",
  },
  {
    name: "Credibility and consistency",
    description: "Answers are consistent, specific, not memorized, and match the documents.",
  },
  {
    name: "Communication",
    description: "Clear, concise, confident spoken English. Direct answers.",
  },
] as const;

export const IELTS_SPEAKING_CRITERIA = [
  { name: "Fluency and coherence", description: "Speaks at length, logically, without unnatural hesitation." },
  { name: "Lexical resource", description: "Range and precision of vocabulary, idiomatic usage." },
  { name: "Grammatical range and accuracy", description: "Variety and correctness of structures." },
  { name: "Pronunciation", description: "Clarity, stress, intonation, intelligibility." },
] as const;

export const TOEFL_SPEAKING_CRITERIA = [
  { name: "Delivery", description: "Clear, fluid speech with good pacing and pronunciation." },
  { name: "Language use", description: "Effective, accurate grammar and vocabulary." },
  { name: "Topic development", description: "Well-developed, coherent, fully answers the prompt." },
] as const;

export function examCriteria(exam: string) {
  const e = exam.toLowerCase();
  if (e.includes("toefl")) return { exam: "TOEFL", scale: 30, criteria: TOEFL_SPEAKING_CRITERIA };
  return { exam: "IELTS", scale: 9, criteria: IELTS_SPEAKING_CRITERIA };
}
