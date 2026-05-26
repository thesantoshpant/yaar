import { useCallback, useEffect, useRef, useState } from "react";

// Thin wrapper over the browser Web Speech API: dictation (speech -> text) and
// text-to-speech. Both degrade gracefully: if the browser doesn't support a piece,
// `supported`/`ttsSupported` are false and callers simply keep the text experience.
// Note: the actual audio only works in a real browser with mic permission, so this
// is verified by build/typecheck here and exercised live in the browser.

// SpeechRecognition isn't in the standard TS DOM lib, so we access it loosely.
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function useSpeech() {
  const Rec: (new () => SpeechRec) | undefined =
    typeof window !== "undefined"
      ? ((window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition)
      : undefined;
  const supported = !!Rec;
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const recRef = useRef<SpeechRec | null>(null);
  const [listening, setListening] = useState(false);

  const startDictation = useCallback(
    (onText: (t: string) => void) => {
      if (!Rec) return;
      try {
        const r = new Rec();
        r.lang = "en-US";
        r.interimResults = false;
        r.maxAlternatives = 1;
        r.onresult = (e) => {
          const t = e.results?.[0]?.[0]?.transcript ?? "";
          if (t) onText(t.trim());
        };
        r.onend = () => setListening(false);
        r.onerror = () => setListening(false);
        recRef.current = r;
        r.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    },
    [Rec]
  );

  const stopDictation = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !text) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/\*\*|###|^- |\d+\.\s/gm, ""));
        const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en-"));
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    },
    [ttsSupported]
  );

  const cancelSpeech = useCallback(() => {
    if (ttsSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, [ttsSupported]);

  // Clean up any active recognition/speech on unmount.
  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    []
  );

  return { supported, ttsSupported, listening, startDictation, stopDictation, speak, cancelSpeech };
}
