// Document-grounded F-1 visa Risk Report. Parses the student's documents, detects
// inconsistencies a consular officer would catch, scores readiness, and surfaces
// the exact weak points to drill in the mock interview. This is the paid flagship.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import { VISA_DIMENSIONS } from "../data/rubrics";
import { riskReportSystem } from "../lib/prompts";
import type { RiskReport, StudentDocument } from "../lib/types";

export interface DocInput {
  kind: StudentDocument["kind"];
  text: string;
  filename?: string;
}

type ReportCore = Omit<RiskReport, "id" | "createdAt" | "profileId">;

const SYSTEM = `${riskReportSystem(VISA_DIMENSIONS.map((d) => d.name).join(", "))}
Return ONLY JSON:
{ "overall": number 0-100, "summary": string, "extracted": [ { "field": string, "value": string } ],
  "inconsistencies": string[], "weakPoints": string[],
  "dimensions": [ { "name": string, "score": number, "note": string } ], "recommendation": string }`;

function mockReport(combined: string): ReportCore {
  const text = combined.toLowerCase();
  const inconsistencies: string[] = [];
  // crude funding-vs-cost heuristic for the demo path
  const cost = combined.match(/(?:cost|tuition|i-?20)[^0-9]{0,20}\$?\s*([0-9][0-9,]{3,})/i);
  const funds = combined.match(/(?:bank|balance|funds?|sponsor)[^0-9]{0,20}\$?\s*([0-9][0-9,]{3,})/i);
  const num = (s?: string) => (s ? Number(s.replace(/[^0-9]/g, "")) : NaN);
  if (!Number.isNaN(num(cost?.[1])) && !Number.isNaN(num(funds?.[1])) && num(funds?.[1]) < num(cost?.[1])) {
    inconsistencies.push(`Funds shown (~$${num(funds?.[1]).toLocaleString()}) are below the I-20 cost (~$${num(cost?.[1]).toLocaleString()}). An officer will flag this.`);
  }
  const hasTies = /(return|family|job|business|home country)/.test(text);
  const overall = Math.max(35, Math.min(82, 70 - inconsistencies.length * 15 + (hasTies ? 8 : -5)));
  return {
    overall,
    summary:
      "Demo analysis (add a Gemini key for full extraction). Based on what you pasted, here are the likely focus areas for your interview.",
    extracted: [
      { field: "Documents provided", value: combined ? `${combined.length} characters of text` : "none" },
    ],
    inconsistencies: inconsistencies.length ? inconsistencies : ["No obvious numeric mismatch detected, but verify every figure matches your I-20 exactly."],
    weakPoints: [
      hasTies ? "Make your ties to home concrete and specific." : "You have not stated clear ties to your home country. This is the top refusal reason.",
      "Be ready to name your sponsor, their occupation, and the exact funding amount without hesitation.",
    ],
    dimensions: VISA_DIMENSIONS.map((d, i) => ({
      name: d.name,
      score: Math.max(30, Math.min(90, overall + ((i % 3) - 1) * 7)),
      note: d.description,
    })),
    recommendation:
      overall >= 70
        ? "Reasonable footing. Fix the flagged weak points, then run a mock interview targeting them."
        : "Not ready yet. Resolve the inconsistencies and tighten ties + finances before you interview.",
  };
}

// Pure analysis (no persistence). Used for anonymous/transient reports too.
export async function analyzeDocuments(docs: DocInput[]): Promise<ReportCore> {
  const combined = docs.map((d) => `[${d.kind}] ${d.text}`).join("\n\n");
  const { data } = await generateJson<ReportCore>({
    system: SYSTEM,
    prompt: `Student documents:\n${combined || "(none provided)"}\n\nProduce the risk report now.`,
    mock: () => mockReport(combined),
  });
  // defensive normalization in case the model returns partial JSON
  return {
    overall: typeof data.overall === "number" ? data.overall : 50,
    summary: data.summary ?? "",
    extracted: Array.isArray(data.extracted) ? data.extracted : [],
    inconsistencies: Array.isArray(data.inconsistencies) ? data.inconsistencies : [],
    weakPoints: Array.isArray(data.weakPoints) ? data.weakPoints : [],
    dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
    recommendation: data.recommendation ?? "",
  };
}

export async function generateRiskReport(profileId: string, docs: DocInput[]): Promise<RiskReport> {
  // Privacy: we do NOT persist the raw document text. We only analyze it in-memory
  // and save the derived report (the student's owned artifact). This keeps the
  // "we don't store your raw documents" promise honest.
  const core = await analyzeDocuments(docs);
  await store.addEvent({ profileId, kind: "module_run", module: "visa", summary: `Generated visa risk report (score ${core.overall})`, status: "done" });
  return store.saveRiskReport({ profileId, ...core });
}
