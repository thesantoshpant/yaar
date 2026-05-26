// Transcribe spoken audio with Gemini (multimodal), instead of the browser's flaky
// Web Speech API. Works for any audio the browser can record; degrades to "" on failure.
import { generateJsonFromMedia, type MediaPart } from "./gemini";
import { config } from "../config";

export async function transcribeAudio(file: MediaPart): Promise<{ text: string; source: string }> {
  const { data, source } = await generateJsonFromMedia<{ transcript: string }>({
    system:
      "You transcribe spoken audio to text. Output exactly the words spoken, in English, with normal punctuation and capitalization. Do not add commentary, labels, or quotes. If there is no clear speech, return an empty string.",
    prompt: 'Transcribe the speech in this audio. Return ONLY JSON: { "transcript": string }',
    files: [file],
    model: config.geminiTextModel, // flash is plenty for transcription and fast
    temperature: 0,
    mock: () => ({ transcript: "" }),
  });
  return { text: (data?.transcript ?? "").trim(), source };
}
