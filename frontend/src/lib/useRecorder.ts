// Mic recording + Gemini transcription with honest, never-stuck state.
//
// What this hook owns end-to-end:
// 1. Phase machine. The UI sees `phase` flip synchronously on every action so
//    there's never dead air between tap and feedback:
//       idle -> recording -> uploading -> thinking -> idle
//    "uploading" is set INSIDE stop() before MediaRecorder.onstop fires;
//    "thinking" is auto-set after 600ms in uploading so the long-wait copy
//    can switch over without the consumer wiring its own timer.
// 2. Cleanup on unmount. Forcibly stops the MediaRecorder, releases the mic
//    tracks (the red browser indicator), aborts any in-flight transcribe
//    request, and gates further state setters. The previous version leaked
//    mic streams on navigation and fired setState on dead components.
// 3. Abandonment warning. When phase != idle, we install a beforeunload
//    handler so closing the tab mid-record / mid-transcribe shows the
//    browser's "leave site?" confirm and prevents silent loss of audio
//    that was already billed.
// 4. Friendly error surfacing. Backend errors (size cap, mime type,
//    transcribe failure) propagate their server-side reason instead of a
//    blanket "Transcription failed."

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export type RecorderPhase = "idle" | "recording" | "uploading" | "thinking";

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

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((t: string) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // 600ms uploading -> thinking switch, so the consumer's UI swaps to the
  // long-wait copy automatically.
  const thinkingTimerRef = useRef<number | null>(null);

  const safeSet = useCallback(<T>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  const releaseStream = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // Browser may already have released the stream; ignore.
    }
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!supported) {
      setError("Recording isn't supported in this browser. Please type your answer.");
      return;
    }
    if (permissionDenied) {
      setError("Microphone permission is blocked. Open browser site settings and allow the mic, or type your answer.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      mr.onerror = () => {
        safeSet(setError, "The recorder hit an error. Please try again, or type your answer.");
        releaseStream();
        safeSet(setPhase, "idle");
        resolveRef.current?.("");
        resolveRef.current = null;
      };
      // If the OS / browser ends the track (e.g. user revoked mic mid-stream),
      // surface it rather than freezing in "recording".
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (recRef.current?.state === "recording") {
          try { recRef.current.stop(); } catch {}
        }
      });
      mr.onstop = async () => {
        releaseStream();
        const type = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        try {
          const b64 = await blobToBase64(blob);
          // After 600ms in "uploading" the UI should switch to a "thinking"
          // long-wait copy. Set up the timer before issuing the fetch so the
          // swap fires even on fast networks where the API responds quickly.
          thinkingTimerRef.current = window.setTimeout(() => {
            if (mountedRef.current) setPhase("thinking");
          }, 600);
          abortRef.current = new AbortController();
          const res = await api.transcribe(type, b64, abortRef.current.signal);
          if (thinkingTimerRef.current) {
            window.clearTimeout(thinkingTimerRef.current);
            thinkingTimerRef.current = null;
          }
          if (!res.text) safeSet(setError, "I couldn't make out any words. Try again, or type your answer.");
          resolveRef.current?.(res.text || "");
        } catch (e) {
          // AbortError = user navigated away; stay silent in that case.
          const name = (e as { name?: string })?.name;
          if (name !== "AbortError") {
            const msg = (e as { message?: string })?.message;
            safeSet(setError, msg && msg.length < 200 ? msg : "Transcription failed. You can type your answer instead.");
          }
          resolveRef.current?.("");
        } finally {
          if (thinkingTimerRef.current) {
            window.clearTimeout(thinkingTimerRef.current);
            thinkingTimerRef.current = null;
          }
          abortRef.current = null;
          safeSet(setPhase, "idle");
          resolveRef.current = null;
        }
      };
      recRef.current = mr;
      mr.start();
      safeSet(setPhase, "recording");
    } catch (e) {
      const name = (e as { name?: string })?.name;
      releaseStream();
      if (name === "NotAllowedError") {
        setPermissionDenied(true);
        setError("Microphone permission was blocked. Allow it in browser settings, or type your answer.");
      } else {
        setError("Couldn't start recording. You can type your answer instead.");
      }
    }
  }, [supported, permissionDenied, safeSet, releaseStream]);

  // Stops recording and resolves with the transcribed text (or "" on failure).
  // Importantly, sets phase synchronously to "uploading" so the UI shows
  // immediate progress, instead of dead air until onstop fires.
  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const mr = recRef.current;
      if (!mr || mr.state !== "recording") {
        resolve("");
        return;
      }
      resolveRef.current = resolve;
      // Flip the phase BEFORE the async work so the UI never sees a dead frame.
      setPhase("uploading");
      try {
        mr.stop();
      } catch {
        // If stop throws, release the stream and resolve empty so the caller
        // never hangs waiting on a phantom promise.
        releaseStream();
        setPhase("idle");
        resolve("");
        resolveRef.current = null;
      }
    });
  }, [releaseStream]);

  // Cleanup on unmount: kill the recorder, release the mic stream, abort the
  // in-flight transcribe call, and gate any late setters via mountedRef.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
      } catch {}
      try {
        abortRef.current?.abort();
      } catch {}
      if (thinkingTimerRef.current) {
        window.clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
      }
      releaseStream();
      resolveRef.current = null;
    };
  }, [releaseStream]);

  // While audio work is in flight, warn before unload. Closing the tab mid-
  // record loses the answer; mid-transcribe wastes a Gemini call. The browser
  // confirm gives the student a chance to come back.
  useEffect(() => {
    if (phase === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Most browsers ignore the custom string today, but returnValue is still
      // the trigger that flips the dialog.
      e.returnValue = "Your recording is still being processed. Leave the page?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Convenience: a one-call dismiss for stale errors when the user moves on.
  const clearError = useCallback(() => setError(""), []);

  // Back-compat aliases so existing consumers (SpeakingPractice, VisaSimulator,
  // MockTest) don't have to refactor right away. `recording` and `transcribing`
  // map onto the new phase enum.
  const recording = phase === "recording";
  const transcribing = phase === "uploading" || phase === "thinking";

  return {
    supported,
    permissionDenied,
    phase,
    recording,
    transcribing,
    error,
    start,
    stop,
    clearError,
  };
}
