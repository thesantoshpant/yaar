import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { SpeakingScore } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge, ScoreBar, PageHeading } from "../components/ui";

export default function SpeakingPractice() {
  const [exam, setExam] = useState("IELTS");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<SpeakingScore | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [recognitionError, setRecognitionError] = useState("");
  const [supportSpeech, setSupportSpeech] = useState(true);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      
      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        setAnswer((prev) => {
          const base = prev.trim();
          return base ? base + " " + transcript.trim() : transcript.trim();
        });
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event);
        if (event.error === "not-allowed") {
          setRecognitionError("Microphone access was denied. Check permissions.");
        } else {
          setRecognitionError("An error occurred during voice transcription.");
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    } else {
      setSupportSpeech(false);
    }
  }, []);

  function toggleListening() {
    if (!recognition) return;
    setRecognitionError("");
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function getPrompt() {
    const res = await api.speakingPrompt(exam);
    setPrompt(res.prompt);
    setScore(null);
    setAnswer("");
  }

  async function submit() {
    if (!prompt || !answer.trim()) return;
    setLoading(true);
    try {
      const res = await api.speakingScore(exam, prompt, answer);
      setScore(res.score);
      setSource(res.source);
      markCompleted("test_prep");
    } finally {
      setLoading(false);
    }
  }

  const max = exam.toUpperCase().includes("TOEFL") ? 30 : 9;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Speaking practice 🎙️"
        subtitle="Unlimited TOEFL & IELTS speaking practice, scored on the real rubric. Voice mode (Gemini Live) is coming — for now, speak your answer out loud and paste it in."
      />

      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Exam</label>
            <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>
              <option value="IELTS">IELTS</option>
              <option value="TOEFL">TOEFL</option>
            </select>
          </div>
          <button className="btn-ghost" onClick={getPrompt}>
            Get a prompt
          </button>
        </div>

        {prompt && (
          <div className="mt-5">
            <div className="rounded-xl border border-line bg-surface-2 p-4 text-ink">
              <span className="badge bg-brand-500/15 text-brand-500">Prompt</span>
              <p className="mt-2">{prompt}</p>
            </div>
             <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label mb-0">Your answer</label>
                {supportSpeech ? (
                  <div className="flex items-center gap-3">
                    {isListening && (
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Listening</span>
                        <div className="flex items-end gap-0.5 h-6">
                          <span className="voice-wave-bar" style={{ animationDelay: "0.1s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.3s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.5s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.2s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.4s" }} />
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`btn text-xs px-3.5 py-2 ${
                        isListening
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20"
                          : "bg-brand-500/10 text-brand-600 border border-brand-500/20 hover:bg-brand-500/20"
                      }`}
                    >
                      {isListening ? "🛑 Stop recording" : "🎙️ Speak my answer"}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">🎙️ Speech-to-text not supported in browser</span>
                )}
              </div>

              {recognitionError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400">
                  ⚠️ {recognitionError}
                </div>
              )}

              <textarea
                className="input min-h-[140px]"
                placeholder="Click 'Speak my answer' to record or paste your response here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />

              <div className="flex gap-2.5">
                <button className="btn-primary" onClick={submit} disabled={loading || !answer.trim()}>
                  {loading ? <Spinner label="Scoring..." /> : "Score my answer"}
                </button>
                {answer.trim() && (
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setAnswer("");
                      setRecognitionError("");
                    }}
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {score && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              {score.exam} band: <span className="text-brand-500">{score.band}</span> / {max}
            </h2>
            <SourceBadge source={source} />
          </div>

          <div className="space-y-3">
            {score.criteria.map((c, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-muted">
                    {c.score} / {max}
                  </span>
                </div>
                <ScoreBar value={c.score} max={max} />
                <p className="mt-1 text-sm text-muted">{c.feedback}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-brand-500/15 bg-brand-500/5 p-4">
            <h3 className="font-semibold text-ink">Model answer</h3>
            <p className="mt-1 text-sm text-ink/90">{score.improvedAnswer}</p>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-ink">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/90">
              {score.drills.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
