// Document-grounded F-1 visa Risk Report. Parses the student's documents, detects
// inconsistencies a consular officer would catch, scores readiness, and surfaces
// the exact weak points to drill in the mock interview. This is the flagship feature.
import { generateJson, generateJsonFromMedia, type MediaPart } from "./gemini";
import { config } from "../config";
import { store } from "../lib/store";
import { rememberFacts } from "./memoryUpdate";
import { VISA_DIMENSIONS } from "../data/rubrics";
import { riskReportSystem } from "../lib/prompts";
import type { RiskReport, StudentDocument } from "../lib/types";

export interface DocInput {
  kind: StudentDocument["kind"];
  text: string;
  filename?: string;
}

// One uploaded file plus a hint about what it is.
export interface DocFileInput {
  kind: StudentDocument["kind"];
  mimeType: string;
  data: string; // base64
  filename?: string;
}

export interface ExtractedField {
  field: string;
  value: string;
  confidence?: "high" | "medium" | "low";
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

// Reads uploaded files (photo or PDF of an I-20, bank letter, admission letter)
// and pulls out the key fields so the student confirms instead of typing it all.
// Nothing is persisted: the file bytes live only for this call.
export async function extractFieldsFromFiles(files: DocFileInput[], actor?: string): Promise<{ extracted: ExtractedField[]; warnings: string[] }> {
  const parts: MediaPart[] = files.map((f) => ({ mimeType: f.mimeType, data: f.data }));
  const hints = files.map((f) => `${f.filename ?? "file"} (${f.kind})`).join(", ");
  const { data } = await generateJsonFromMedia<{ extracted: ExtractedField[]; warnings: string[] }>({
    profileId: actor,
    system: `${riskReportSystem(VISA_DIMENSIONS.map((d) => d.name).join(", "))}
You are reading the student's uploaded documents (${hints}). Pull out only what is actually written. Do not guess numbers.
Return ONLY JSON:
{ "extracted": [ { "field": string, "value": string, "confidence": "high"|"medium"|"low" } ],
  "warnings": string[] }
Fields to look for when present: School, Program, Degree level, I-20 total cost (one year), Program length, Sponsor name, Sponsor occupation, Funds shown, Bank or sponsor, Start date. If a field is not found, set value to "Not found" and confidence "low", and add a short warning telling the student to add it.`,
    prompt: "Read these documents and extract the fields now.",
    files: parts,
    mock: () => ({
      extracted: [{ field: "Documents uploaded", value: `${files.length} file(s)`, confidence: "low" as const }],
      warnings: ["Add a Gemini key or Vertex AI to read documents automatically. For now, type the details in yourself."],
    }),
  });
  return {
    extracted: Array.isArray(data.extracted) ? data.extracted : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

// Pure analysis (no persistence). Used for anonymous/transient reports too.
export async function analyzeDocuments(docs: DocInput[], actor?: string): Promise<ReportCore> {
  const combined = docs.map((d) => `[${d.kind}] ${d.text}`).join("\n\n");
  const { data } = await generateJson<ReportCore>({
    system: SYSTEM,
    model: config.geminiProModel, // flagship: use the stronger model for this report
    prompt: `Student documents:\n${combined || "(none provided)"}\n\nProduce the risk report now.`,
    profileId: actor,
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
  const core = await analyzeDocuments(docs, profileId);
  await store.addEvent({ profileId, kind: "module_run", module: "visa", summary: `Generated visa risk report (score ${core.overall})`, status: "done" });
  // Feed the durable, derived facts into the student's mind (not the raw documents).
  const facts = [
    { profileId, key: "visa.readiness", type: "profile" as const, value: `Visa readiness ${core.overall}/100`, confidence: 0.9, source: "module_outcome" as const },
    ...core.extracted
      .filter((e) => e.value && e.value.trim().toLowerCase() !== "not found")
      .map((e) => ({ profileId, key: `doc.${e.field.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}`, type: "profile" as const, value: `${e.field}: ${e.value}`, confidence: 0.9, source: "module_outcome" as const })),
    ...core.weakPoints.slice(0, 3).map((w, i) => ({ profileId, key: `visa.weak_${i + 1}`, type: "constraint" as const, value: w, confidence: 0.8, source: "module_outcome" as const })),
  ];
  // Route through rememberFacts (not store.addFacts) so the student's context
  // pack is invalidated — otherwise the counselor could miss the just-derived
  // visa readiness/weak points for up to the pack's TTL.
  await rememberFacts(facts).catch(() => {});
  return store.saveRiskReport({ profileId, ...core });
}
