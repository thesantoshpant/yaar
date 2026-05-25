// Gemini Live voice relay (scaffold).
//
// Pattern: the browser captures mic audio and streams 16kHz PCM to this backend
// over a WebSocket. The backend holds the API key and relays to the Gemini Live
// API, streaming model audio (24kHz PCM) back to the browser. This keeps the key
// server-side.
//
// NOTE: this needs a real GEMINI_API_KEY and an audio-capable Live model, and it
// must be tested against a live browser audio pipeline. Until then the frontend
// uses the text-turn fallback endpoints in routes/visa.ts and routes/speaking.ts,
// which are fully functional today.
import type { WebSocket } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";
import { config, hasGemini } from "../config";

export interface LiveParams {
  mode: "visa" | "speaking" | "counselor";
  systemInstruction: string;
  voice?: string;
}

export async function handleLiveConnection(clientWs: WebSocket, params: LiveParams): Promise<void> {
  if (!hasGemini) {
    clientWs.send(
      JSON.stringify({
        type: "error",
        message: "Live voice needs GEMINI_API_KEY. Use the text-based practice for now.",
      })
    );
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  try {
    const session = await ai.live.connect({
      model: config.geminiLiveModel,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: params.systemInstruction,
      },
      callbacks: {
        onopen: () => {
          clientWs.send(JSON.stringify({ type: "ready" }));
        },
        onmessage: (message: unknown) => {
          // Forward raw model messages (audio chunks, transcripts) to the client.
          clientWs.send(JSON.stringify({ type: "server", payload: message }));
        },
        onerror: (e: unknown) => {
          clientWs.send(JSON.stringify({ type: "error", message: String(e) }));
        },
        onclose: () => {
          clientWs.send(JSON.stringify({ type: "closed" }));
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "audio" && typeof msg.data === "string") {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "text" && typeof msg.text === "string") {
          session.sendClientContent({ turns: msg.text });
        } else if (msg.type === "end") {
          session.close();
        }
      } catch (err) {
        console.error("[live] bad client message:", err);
      }
    });

    clientWs.on("close", () => {
      try {
        session.close();
      } catch {
        /* noop */
      }
    });
  } catch (err) {
    console.error("[live] connect failed:", err);
    clientWs.send(JSON.stringify({ type: "error", message: "Failed to start live session." }));
    clientWs.close();
  }
}
