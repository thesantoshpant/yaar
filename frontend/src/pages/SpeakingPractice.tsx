import { useEffect, useRef, useState } from "react";
import { api, errText } from "../api/client";
import type { SpeakingScore } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { useAuthGate } from "../lib/authGate";
import { useRecorder } from "../lib/useRecorder";
import { Spinner, SourceBadge, ScoreBar, PageHeading, ErrorNote } from "../components/ui";
import Markdown from "../components/Markdown";

// Real-exam-style prep + speak timers. Times match the IELTS Part 2 cue card
// (60s prep / 120s speak) and TOEFL Independent (15s prep / 45s speak).
const TIMER_PRESETS: Record<string, { prepSec: number; speakSec: number }> = {
  IELTS: { prepSec: 60, speakSec: 120 },
  TOEFL: { prepSec: 15, speakSec: 45 },
};

function fmtTime(s: number): string {
  const m = Math.max(0, Math.floor(s / 60));
  const sec = Math.max(0, Math.floor(s % 60));
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SpeakingPractice() {
  const { gate } = useAuthGate();
  const [exam, setExam] = useState("IELTS");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<SpeakingScore | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [scoreError, setScoreError] = useState("");

  // Voice answers: record with the mic and transcribe with Gemini (reliable across
  // browsers, unlike the old Web Speech API). The typed box always works as a fallback.
  const rec = useRecorder();

  // Real-exam timed mode. State machine:
  //   off -> prep (countdown N seconds, no mic) -> speaking (mic on, M seconds) -> off
  // Timer uses a wall-clock end timestamp so a backgrounded tab doesn't drift.
  const [timedPhase, setTimedPhase] = useState<"off" | "prep" | "speaking">("off");
  const [timeLeft, setTimeLeft] = useState(0);
  const endTimeRef = useRef(0);

  useEffect(() => {
    if (timedPhase === "off") return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining > 0) return;
      if (timedPhase === "prep") {
        // Prep ended -> start the mic + the speak countdown.
        const ms = (TIMER_PRESETS[exam] ?? TIMER_PRESETS.IELTS).speakSec * 1000;
        endTimeRef.current = Date.now() + ms;
        setTimedPhase("speaking");
        void rec.start();
      } else if (timedPhase === "speaking") {
        // Speak ended -> auto-stop the mic, drop transcript into the answer box.
        void rec.stop().then((text) => {
          if (text) setAnswer((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        });
        setTimedPhase("off");
      }
    };
    // 250ms tick is plenty for second-resolution; faster than 1s keeps the
    // visible number from feeling stuck after a tab refocus.
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedPhase, exam]);

  function startTimedRun() {
    const preset = TIMER_PRESETS[exam] ?? TIMER_PRESETS.IELTS;
    setAnswer("");
    endTimeRef.current = Date.now() + preset.prepSec * 1000;
    setTimeLeft(preset.prepSec);
    setTimedPhase("prep");
  }

  function cancelTimedRun() {
    if (rec.recording) void rec.stop();
    setTimedPhase("off");
  }

  async function dictate() {
    if (rec.recording) {
      const text = await rec.stop();
      if (text) setAnswer((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } else {
      await rec.start();
    }
  }

  async function getPrompt() {
    setPromptLoading(true);
    setPromptError("");
    try {
      const res = await api.speakingPrompt(exam);
      setPrompt(res.prompt);
      setScore(null);
      setAnswer("");
    } catch (e) {
      setPromptError(errText(e, "Couldn't load a prompt just now. Check your connection and try again."));
    } finally {
      setPromptLoading(false);
    }
  }

  async function submit() {
    if (!prompt || !answer.trim()) return;
    setLoading(true);
    setScoreError("");
    try {
      const res = await api.speakingScore(exam, prompt, answer, getProfileId() || undefined);
      setScore(res.score);
      setSource(res.source);
      markCompleted("test_prep");
    } catch (e) {
      setScoreError(errText(e, "Couldn't score that just now. Your answer is still here — try again."));
    } finally {
      setLoading(false);
    }
  }

  const max = exam.toUpperCase().includes("TOEFL") ? 30 : 9;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Speaking practice 🎙️"
        subtitle="Unlimited TOEFL and IELTS speaking practice, scored on the real rubric. Tap the mic to speak your answer (works best in Chrome), or just type it."
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
          <button className="btn-ghost" onClick={getPrompt} disabled={promptLoading}>
            {promptLoading ? <Spinner label="Finding a prompt..." /> : "Get a prompt"}
          </button>
        </div>
        {promptError && <div className="mt-3"><ErrorNote onRetry={getPrompt}>{promptError}</ErrorNote></div>}

        {prompt && (
          <div className="mt-5">
            <div className="rounded-xl border border-line bg-surface-2 p-4 text-ink">
              <span className="badge bg-brand-500/15 text-brand-500">Prompt</span>
              <p className="mt-2">{prompt}</p>
            </div>

            {/* Real-exam timed mode. The student gets the same prep + speak windows
               the actual test gives them, with a wall-clock countdown that doesn't
               drift on backgrounded tabs. */}
            {timedPhase === "off" && rec.supported && (
              <button className="btn-ghost mt-3" onClick={startTimedRun} disabled={rec.recording || rec.transcribing}>
                ⏱ Run timed practice ({TIMER_PRESETS[exam]?.prepSec ?? 60}s prep · {TIMER_PRESETS[exam]?.speakSec ?? 120}s speak)
              </button>
            )}
            {timedPhase !== "off" && (
              <div className={`mt-3 rounded-xl border p-4 ${timedPhase === "prep" ? "border-brand-500/30 bg-brand-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                      {timedPhase === "prep" ? "Prep · think before you speak" : "Speak now"}
                    </div>
                    <div className={`mt-0.5 font-display text-3xl font-extrabold ${timedPhase === "prep" ? "text-brand-600" : "text-rose-600"}`}>
                      {fmtTime(timeLeft)}
                    </div>
                  </div>
                  <button className="btn-ghost text-xs" onClick={cancelTimedRun}>Cancel</button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {timedPhase === "prep"
                    ? "Plan your answer. The mic starts automatically when the prep timer hits 0."
                    : "Your answer is being recorded. It auto-stops when this hits 0."}
                </p>
              </div>
            )}
             <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label mb-0">Your answer</label>
                {rec.supported ? (
                  <div className="flex items-center gap-3">
                    {rec.recording && (
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Recording</span>
                        <div className="flex items-end gap-0.5 h-6">
                          <span className="voice-wave-bar" style={{ animationDelay: "0.1s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.3s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.5s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.2s" }} />
                          <span className="voice-wave-bar" style={{ animationDelay: "0.4s" }} />
                        </div>
                      </div>
                    )}
                    {rec.phase === "uploading" && <Spinner label="Uploading your answer..." />}
                    {rec.phase === "thinking" && <Spinner label="Yaar is listening — almost there..." />}
                    <button
                      type="button"
                      onClick={dictate}
                      disabled={rec.transcribing}
                      className={`btn text-xs px-3.5 py-2 disabled:opacity-60 ${
                        rec.recording
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20"
                          : "bg-brand-500/10 text-brand-600 border border-brand-500/20 hover:bg-brand-500/20"
                      }`}
                    >
                      {rec.recording ? "🛑 Stop & transcribe" : "🎙️ Speak my answer"}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">🎙️ Recording not supported here, just type your answer</span>
                )}
              </div>

              {rec.error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400">
                  ⚠️ {rec.error}
                </div>
              )}

              <textarea
                className="input min-h-[140px]"
                placeholder="Tap 'Speak my answer' to record, or type your response here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />

              <div className="flex gap-2.5">
                <button className="btn-primary" onClick={() => gate("speaking", () => submit())} disabled={loading || !answer.trim() || rec.recording || rec.transcribing}>
                  {loading ? <Spinner label="Scoring..." /> : "Score my answer"}
                </button>
                {answer.trim() && (
                  <button className="btn-ghost" onClick={() => setAnswer("")}>
                    Clear text
                  </button>
                )}
              </div>
              {scoreError && <ErrorNote onRetry={() => submit()}>{scoreError}</ErrorNote>}
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
                <p className="mt-1 text-sm text-muted"><Markdown inline>{c.feedback}</Markdown></p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-brand-500/15 bg-brand-500/5 p-4">
            <h3 className="font-semibold text-ink">Model answer</h3>
            <Markdown className="mt-1 text-sm text-ink/90">{score.improvedAnswer}</Markdown>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-ink">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/90">
              {score.drills.map((d, i) => (
                <li key={i}><Markdown inline>{d}</Markdown></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
