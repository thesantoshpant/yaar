import { useCallback, useRef, useState } from "react";
import { api } from "../api/client";

// Records mic audio with MediaRecorder and transcribes it via our Gemini-backed endpoint.
// This replaces the browser Web Speech API (which fails with network/service errors on
// many setups). Works in any modern browser; degrades cleanly with a clear error.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function useRecorder() {
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((t: string) => void) | null>(null);

  const start = useCallback(async () => {
    setError("");
    if (!supported) {
      setError("Recording isn't supported in this browser. Please type your answer.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setTranscribing(true);
        try {
          const b64 = await blobToBase64(blob);
          const res = await api.transcribe(type, b64);
          if (!res.text) setError("I couldn't make out any words. Try again, or type your answer.");
          resolveRef.current?.(res.text || "");
        } catch {
          setError("Transcription failed. You can type your answer instead.");
          resolveRef.current?.("");
        } finally {
          setTranscribing(false);
          resolveRef.current = null;
        }
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(name === "NotAllowedError" ? "Microphone permission was blocked. Allow it, or type your answer." : "Couldn't start recording. You can type your answer instead.");
    }
  }, [supported]);

  // Stops recording and resolves with the transcribed text (or "" on failure).
  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (recRef.current && recording) {
        resolveRef.current = resolve;
        setRecording(false);
        recRef.current.stop();
      } else {
        resolve("");
      }
    });
  }, [recording]);

  return { supported, recording, transcribing, error, start, stop };
}
