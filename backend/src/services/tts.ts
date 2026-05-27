// Natural speech for listening sections (and anywhere we want a real voice instead of
// the robotic browser engine). Uses Gemini TTS, detects 1-2 speakers from "Label:" lines
// for conversations, and returns a ready-to-play WAV (base64). Degrades to "" so the
// client can fall back to the browser voice.
import { generateSpeech } from "./gemini";

// A few pleasant prebuilt Gemini voices to alternate between speakers.
const VOICES = ["Kore", "Puck", "Charon", "Aoede"];

function detectSpeakers(text: string): { speaker: string; voice: string }[] {
  const labels = [...new Set((text.match(/^\s*([A-Za-z][A-Za-z .'-]{0,24}):/gm) || []).map((s) => s.replace(/:\s*$/, "").trim()))];
  if (labels.length < 2) return [];
  return labels.slice(0, 2).map((l, i) => ({ speaker: l, voice: VOICES[i] }));
}

// 16-bit PCM -> WAV by prepending a 44-byte header.
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16): Buffer {
  const blockAlign = (channels * bits) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesize(text: string, voice?: string): Promise<{ audioBase64: string; mimeType: string; source: string }> {
  const speakers = detectSpeakers(text);
  const { audioBase64, mimeType, source } = await generateSpeech(text, { voice, speakers: speakers.length ? speakers : undefined });
  if (!audioBase64) return { audioBase64: "", mimeType: "", source };
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const wav = pcmToWav(Buffer.from(audioBase64, "base64"), rate);
  return { audioBase64: wav.toString("base64"), mimeType: "audio/wav", source };
}
