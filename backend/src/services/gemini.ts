// Gemini text + JSON generation with graceful mock fallback.
// When GEMINI_API_KEY is absent or a call fails, we return a deterministic mock
// so the whole app stays runnable and demoable before keys are wired in.
import { GoogleGenAI } from "@google/genai";
import { config, hasGemini } from "../config";

let ai: GoogleGenAI | null = null;
if (hasGemini) {
  ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
}

export type Source = "gemini" | "mock";

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function extractJson(text: string): string {
  const cleaned = stripFences(text);
  // Find the outermost JSON object/array if there is surrounding prose.
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  const start =
    firstArr === -1
      ? firstObj
      : firstObj === -1
      ? firstArr
      : Math.min(firstObj, firstArr);
  if (start === -1) return cleaned;
  const lastObj = cleaned.lastIndexOf("}");
  const lastArr = cleaned.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

export async function generateText(opts: {
  prompt: string;
  system?: string;
  temperature?: number;
}): Promise<{ text: string; source: Source }> {
  if (!ai) {
    return { text: "[mock] Gemini is not configured. Add GEMINI_API_KEY to enable live AI.", source: "mock" };
  }
  try {
    const res = await ai.models.generateContent({
      model: config.geminiTextModel,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.7,
      },
    });
    return { text: res.text ?? "", source: "gemini" };
  } catch (err) {
    console.error("[gemini] generateText failed, using fallback:", err);
    return { text: "I had trouble reaching the AI service just now. Please try again.", source: "mock" };
  }
}

export async function generateJson<T>(opts: {
  prompt: string;
  system?: string;
  temperature?: number;
  mock: () => T;
}): Promise<{ data: T; source: Source }> {
  if (!ai) {
    return { data: opts.mock(), source: "mock" };
  }
  try {
    const res = await ai.models.generateContent({
      model: config.geminiTextModel,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.6,
        responseMimeType: "application/json",
      },
    });
    const raw = res.text ?? "";
    const data = JSON.parse(extractJson(raw)) as T;
    return { data, source: "gemini" };
  } catch (err) {
    console.error("[gemini] generateJson failed, using fallback:", err);
    return { data: opts.mock(), source: "mock" };
  }
}
