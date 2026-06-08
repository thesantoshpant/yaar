// Gemini text + JSON generation with graceful mock fallback.
// When GEMINI_API_KEY is absent or a call fails, we return a deterministic mock
// so the whole app stays runnable and demoable before keys are wired in.
//
// Every export here is wrapped by the safety gate (services/safety.ts): a
// pre-call `checkSpendOk` short-circuits to the mock when the kill switch is
// engaged or the daily Vertex spend cap is reached, and a post-call
// `recordSpend` charges the real token-based cost back to the day's bucket
// (and to the per-user bucket if a profileId is passed). This is the single
// chokepoint that protects the $300 Vertex credit — every counselor chat,
// every mock score, every coach call ultimately funnels through here.
import { GoogleGenAI } from "@google/genai";
import { config, hasGemini } from "../config";
import { reserveSpend, settleSpend, releaseSpend, estimateCostUsd } from "./safety";

// Real-cost helper. The Gemini SDK exposes usage at res.usageMetadata when the
// call succeeds; we fall back to a rough char/4 estimate when usage is not
// returned (e.g. TTS) so the cap still moves on every call. Pricing is per
// model tier (Pro/TTS cost far more than Flash). For 2.5 "thinking" models
// (the shipped defaults) the billed output tokens are candidates + thoughts;
// candidatesTokenCount alone omits the (billed) thinking tokens, which would
// undercount real Vertex spend and let billing slip past the daily cap.
function costForCall(res: unknown, fallbackChars: number, model: string): number {
  let inputTokens = 0;
  let outputTokens = 0;
  const u = (
    res as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } } | undefined
  )?.usageMetadata;
  if (u?.promptTokenCount) {
    inputTokens = u.promptTokenCount;
    outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  } else {
    // Conservative fallback: assume ~4 chars per token, half input half output.
    const estTokens = Math.ceil(fallbackChars / 4);
    inputTokens = Math.ceil(estTokens * 0.5);
    outputTokens = Math.ceil(estTokens * 0.5);
  }
  return estimateCostUsd(inputTokens, outputTokens, model);
}

// Pre-call cost estimate from the REAL prompt size, not a flat number. With a
// flat estimate, one giant prompt could sail through the gate for "$0.005" and
// then bill dollars; sizing the estimate makes the caps bound the first call too.
function preEstimate(promptChars: number, expectedOutputTokens: number, model: string, floorUsd: number): number {
  return Math.max(floorUsd, estimateCostUsd(Math.ceil(promptChars / 4), expectedOutputTokens, model));
}

let ai: GoogleGenAI | null = null;
if (hasGemini) {
  if (config.useVertex) {
    // Vertex AI path: auth via Application Default Credentials, billed to the GCP project.
    ai = new GoogleGenAI({
      vertexai: true,
      project: config.googleCloudProject,
      location: config.googleCloudLocation,
    });
    console.log(`[gemini] using Vertex AI (project=${config.googleCloudProject}, location=${config.googleCloudLocation})`);
  } else {
    // AI Studio path: simple API key.
    ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    console.log("[gemini] using AI Studio API key");
  }
}

export type Source = "gemini" | "mock";

// A file the model can read directly (PDF or image), as base64 inline data.
export interface MediaPart {
  mimeType: string;
  data: string; // base64, no data: prefix
}

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
  profileId?: string; // optional, drives the per-user spend cap
}): Promise<{ text: string; source: Source }> {
  if (!ai) {
    return { text: "[mock] Gemini is not configured. Add GEMINI_API_KEY to enable live AI.", source: "mock" };
  }
  // Pre-call safety gate. When the kill switch is engaged or the day's cap is
  // reached, fall back to the same graceful mock the no-key path returns —
  // the user sees a friendly message and we spend nothing.
  const model = config.geminiTextModel;
  const promptChars = (opts.prompt?.length ?? 0) + (opts.system?.length ?? 0);
  const reservation = reserveSpend(opts.profileId, preEstimate(promptChars, 1000, model, 0.005));
  if (!reservation.ok) {
    // Never echo the internal cap amount or the operator's kill-switch reason to
    // the user; the detail is kept for the ops console via recentRejections.
    console.warn("[gemini] spend gate blocked:", reservation.reason);
    return { text: "I'm temporarily unavailable right now. Please try again in a few minutes.", source: "mock" };
  }
  let settled = false;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            temperature: opts.temperature ?? 0.7,
          },
        });
        settleSpend(opts.profileId, reservation.reservedUsd, costForCall(res, promptChars + (res.text?.length ?? 0), model));
        settled = true;
        return { text: res.text ?? "", source: "gemini" };
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 429 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
          continue;
        }
        console.error("[gemini] generateText failed, using fallback:", err);
        return { text: "I had trouble reaching the AI service just now. Please try again.", source: "mock" };
      }
    }
    return { text: "I had trouble reaching the AI service just now. Please try again.", source: "mock" };
  } finally {
    if (!settled) releaseSpend(opts.profileId, reservation.reservedUsd);
  }
}

export async function generateJson<T>(opts: {
  prompt: string;
  system?: string;
  temperature?: number;
  model?: string;
  profileId?: string;
  mock: () => T;
}): Promise<{ data: T; source: Source }> {
  if (!ai) {
    return { data: opts.mock(), source: "mock" };
  }
  const model = opts.model ?? config.geminiTextModel;
  const promptChars = (opts.prompt?.length ?? 0) + (opts.system?.length ?? 0);
  const reservation = reserveSpend(opts.profileId, preEstimate(promptChars, 1500, model, 0.006));
  if (!reservation.ok) {
    return { data: opts.mock(), source: "mock" };
  }
  let settled = false;
  try {
    // Vertex/Gemini RPM caps can produce 429 bursts when the eval suite, a
    // boardroom, or the grader study runs many calls in seconds. Retry up to
    // 3 times with exponential backoff so a transient quota hiccup doesn't
    // silently fall back to the mock (which would silently approve in Diya's
    // case until we fixed that to fail-closed).
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            temperature: opts.temperature ?? 0.6,
            responseMimeType: "application/json",
          },
        });
        const raw = res.text ?? "";
        // Settle BEFORE parsing: the API call happened and billed regardless of
        // whether the body parses, so charge it and don't release on a parse fail.
        settleSpend(opts.profileId, reservation.reservedUsd, costForCall(res, promptChars + raw.length, model));
        settled = true;
        const data = JSON.parse(extractJson(raw)) as T;
        // A live model can emit valid JSON that is NOT a usable object — bare
        // `null` (JSON.parse("null") succeeds) or a primitive. Callers index
        // fields off `data`, so a null/primitive would throw at the call site
        // (-> 500). Treat it as degraded and return the caller's mock, the same
        // graceful fallback we give for an unparseable body. This is the single
        // chokepoint that protects every generateJson caller, present and future.
        if (data === null || typeof data !== "object") return { data: opts.mock(), source: "mock" };
        return { data, source: "gemini" };
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 429 && attempt < 3) {
          // Exponential backoff: 1.5s, 3s, 6s before final retry.
          await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
          continue;
        }
        console.error("[gemini] generateJson failed, using fallback:", err);
        return { data: opts.mock(), source: "mock" };
      }
    }
    // Unreachable, but TypeScript needs a return.
    return { data: opts.mock(), source: "mock" };
  } finally {
    if (!settled) releaseSpend(opts.profileId, reservation.reservedUsd);
  }
}

// Natural text-to-speech via Gemini (neural voices, far better than the browser engine).
// Returns base64 PCM (audio/L16). Supports up to 2 named speakers for conversations.
export async function generateSpeech(
  text: string,
  opts?: { voice?: string; speakers?: { speaker: string; voice: string }[]; profileId?: string }
): Promise<{ audioBase64: string; mimeType: string; source: Source }> {
  if (!ai || !text.trim()) return { audioBase64: "", mimeType: "", source: "mock" };
  // TTS is the expensive surface (long audio = many tokens). Gate hardest:
  // estimate output audio tokens generously at TTS pricing.
  const reservation = reserveSpend(opts?.profileId, preEstimate(text.length, text.length * 2, config.geminiTtsModel, 0.02));
  if (!reservation.ok) {
    return { audioBase64: "", mimeType: "", source: "mock" };
  }
  let settled = false;
  try {
    const speechConfig =
      opts?.speakers && opts.speakers.length >= 2
        ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: opts.speakers.slice(0, 2).map((s) => ({ speaker: s.speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } })) } }
        : { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts?.voice || "Kore" } } };
    const res = await ai.models.generateContent({
      model: config.geminiTtsModel,
      contents: text,
      config: { responseModalities: ["AUDIO"], speechConfig },
    });
    const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    const data = part?.inlineData?.data;
    // Fallback chars for the charge are based on the INPUT text only. Never use
    // the base64 audio length: a minute of audio is millions of base64 chars,
    // and chars/4 of that would falsely record several dollars for one call and
    // trip the daily cap for everyone.
    settleSpend(opts?.profileId, reservation.reservedUsd, costForCall(res, text.length * 3, config.geminiTtsModel));
    settled = true;
    if (!data) return { audioBase64: "", mimeType: "", source: "mock" };
    return { audioBase64: data, mimeType: part?.inlineData?.mimeType || "audio/L16;rate=24000", source: "gemini" };
  } catch (err) {
    console.error("[gemini] generateSpeech failed:", err);
    return { audioBase64: "", mimeType: "", source: "mock" };
  } finally {
    if (!settled) releaseSpend(opts?.profileId, reservation.reservedUsd);
  }
}

// Reads uploaded files (PDF/images of an I-20, bank letter, etc.) and returns structured JSON.
// Gemini handles PDFs and photos natively, so a student can just snap their documents.
export async function generateJsonFromMedia<T>(opts: {
  prompt: string;
  files: MediaPart[];
  system?: string;
  temperature?: number;
  model?: string;
  profileId?: string;
  mock: () => T;
}): Promise<{ data: T; source: Source }> {
  if (!ai || opts.files.length === 0) {
    return { data: opts.mock(), source: "mock" };
  }
  // Multimodal/Pro is the most expensive path; gate hardest. Estimate from the
  // real payload: prompt chars plus a conservative per-byte charge for files.
  const model = opts.model ?? config.geminiProModel;
  const fileBytes = opts.files.reduce((s, f) => s + (f.data?.length ?? 0), 0);
  const promptChars = (opts.prompt?.length ?? 0) + (opts.system?.length ?? 0) + Math.ceil(fileBytes / 500);
  const reservation = reserveSpend(opts.profileId, preEstimate(promptChars, 2000, model, 0.02));
  if (!reservation.ok) {
    return { data: opts.mock(), source: "mock" };
  }
  let settled = false;
  try {
    const parts = [
      ...opts.files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })),
      { text: opts.prompt },
    ];
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
      },
    });
    const raw = res.text ?? "";
    // Settle before parsing for the same reason as generateJson.
    settleSpend(opts.profileId, reservation.reservedUsd, costForCall(res, (opts.prompt?.length ?? 0) + fileBytes + raw.length, model));
    settled = true;
    const data = JSON.parse(extractJson(raw)) as T;
    // See generateJson: a null/primitive parse result is degraded; use the mock.
    if (data === null || typeof data !== "object") return { data: opts.mock(), source: "mock" };
    return { data, source: "gemini" };
  } catch (err) {
    console.error("[gemini] generateJsonFromMedia failed, using fallback:", err);
    return { data: opts.mock(), source: "mock" };
  } finally {
    if (!settled) releaseSpend(opts.profileId, reservation.reservedUsd);
  }
}
