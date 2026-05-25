// Question banks for the visa simulator and speaking practice.
// Country-tuned, because consular question patterns and refusal reasons differ.

export const VISA_QUESTIONS_GENERAL = [
  "Why do you want to study in the United States?",
  "Why did you choose this university over others?",
  "What is your intended major and why?",
  "Who is sponsoring your education?",
  "What is your sponsor's annual income and occupation?",
  "How much is your tuition and total cost per year?",
  "What are your plans after you complete your degree?",
  "Do you have any relatives in the United States?",
  "Why should you return to your home country after graduation?",
  "What are your scores on TOEFL or IELTS and the GRE if applicable?",
];

export const VISA_QUESTIONS_BY_COUNTRY: Record<string, string[]> = {
  Nepal: [
    "How will you fund your studies given the bank balance shown in your documents?",
    "Many Nepali students stay in the US. What will bring you back to Nepal?",
    "What does your family do in Nepal, and what ties you to home?",
  ],
  India: [
    "Do you have loans for your education? Who is the co-signer?",
    "Why not study this program in India?",
    "What is your sponsor's relationship to you and their annual income in rupees?",
  ],
  Bangladesh: [
    "How did your sponsor accumulate the funds shown in the statements?",
    "What will you do back in Bangladesh after your degree?",
  ],
};

export function visaQuestionsFor(country: string): string[] {
  const extra = VISA_QUESTIONS_BY_COUNTRY[country] ?? [];
  return [...VISA_QUESTIONS_GENERAL, ...extra];
}

export const SPEAKING_PROMPTS = {
  IELTS: [
    "Describe a place you would like to visit. Explain why you want to go there and what you would do.",
    "Talk about a skill you would like to learn. Why is it important to you?",
    "Describe a person who has influenced you. How did they affect your life?",
    "Some people think university education should be free. Do you agree? Why or why not?",
  ],
  TOEFL: [
    "Do you agree or disagree: it is better to study alone than in a group? Use reasons and examples.",
    "Describe an important decision you made and explain why it was important.",
    "Some students prefer large universities, others small colleges. Which do you prefer and why?",
    "Talk about a goal you hope to achieve in the next five years.",
  ],
};
