// Visa — the flagship, as one guided flow: upload documents → honest readiness
// score → mock interview drilling the weak points → a shareable Visa Pass.
// Every handler (analyzeDocs / start / answer / finish, the gate, the voice
// dictation + read-aloud) is preserved from the old simulator; the step
// structure is derived from the existing flags (report / started / score).
import { useState, useEffect } from "react";
import { api, errText } from "../api/client";
import type { RiskReport, VisaScore, VisaTurn } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { useAuthGate } from "../lib/authGate";
import { useSpeech } from "../lib/useSpeech";
import { useRecorder } from "../lib/useRecorder";
import { Spinner, ScoreBar, ScoreRing, PageHeading, ErrorNote } from "../components/ui";
import DocumentUpload from "../components/DocumentUpload";
import Markdown from "../components/Markdown";
import VisaPassCard, { type PassData } from "../components/VisaPassCard";

const COUNTRY_OPTIONS = ["Nepal", "India", "Bangladesh", "Other"];
const STEPS = ["Documents", "Readiness", "Interview", "Pass"];

function Steps({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              i < current ? "bg-brand-600 text-white" : i === current ? "bg-gold-500 text-gold-ink" : "bg-surface-2 text-faint"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`hidden text-xs font-medium sm:inline ${i === current ? "text-ink" : "text-faint"}`}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-4 bg-line sm:w-6" />}
        </div>
      ))}
    </div>
  );
}

export default function VisaSimulator() {
  const { profile, setField } = useProfile();
  const { gate } = useAuthGate();
  const country = profile.country;
  const [documents, setDocuments] = useState("");
  const [history, setHistory] = useState<VisaTurn[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<VisaScore | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");
  const [interviewError, setInterviewError] = useState("");

  // Voice: dictate your answer (recorded + transcribed) and have the officer read aloud.
  const speech = useSpeech();
  const rec = useRecorder();
  const [readAloud, setReadAloud] = useState(false);
  const [lastSpoke, setLastSpoke] = useState(-1);
  useEffect(() => {
    if (!readAloud) return;
    const i = history.length - 1;
    if (i >= 0 && history[i].role === "officer" && i !== lastSpoke) {
      setLastSpoke(i);
      speech.speak(history[i].text);
    }
  }, [history, readAloud, speech, lastSpoke]);

  async function toggleDictation() {
    if (rec.recording) {
      const t = await rec.stop();
      if (t) setInput((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
    } else {
      await rec.start();
    }
  }

  async function analyzeDocs() {
    if (!documents.trim()) return;
    setRiskLoading(true);
    setRiskError("");
    try {
      const res = await api.riskReport([{ kind: "i20", text: documents.slice(0, 12000) }], getProfileId() || undefined);
      setReport(res.report);
    } catch (e) {
      setRiskError(errText(e, "Yaar couldn't build your report just now. Give it a moment and try again."));
    } finally {
      setRiskLoading(false);
    }
  }

  async function start() {
    setLoading(true);
    setScore(null);
    setDone(false);
    setInterviewError("");
    try {
      const res = await api.visaNext(country, [], documents.slice(0, 12000) || undefined, getProfileId() || undefined);
      setHistory([{ role: "officer", text: res.question }]);
      setStarted(true);
    } catch (e) {
      setInterviewError(errText(e, "Couldn't start the interview. Check your internet and try again."));
    } finally {
      setLoading(false);
    }
  }

  async function answer() {
    const text = input.trim();
    if (!text || loading) return;
    const withAnswer: VisaTurn[] = [...history, { role: "student", text }];
    setHistory(withAnswer);
    setInput("");
    setLoading(true);
    setInterviewError("");
    try {
      const res = await api.visaNext(country, withAnswer, documents.slice(0, 12000) || undefined, getProfileId() || undefined);
      setHistory([...withAnswer, { role: "officer", text: res.question }]);
      if (res.done) setDone(true);
    } catch (e) {
      setInterviewError(errText(e, "That answer didn't go through. Try sending it again."));
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    setInterviewError("");
    try {
      const res = await api.visaScore(country, history, documents.slice(0, 12000) || undefined, getProfileId() || undefined);
      setScore(res.score);
      markCompleted("visa");
    } catch (e) {
      setInterviewError(errText(e, "Couldn't score the interview just now. Your answers are safe — try again."));
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStarted(false);
    setHistory([]);
    setScore(null);
    setDone(false);
    setInput("");
  }

  const officerQuestions = history.filter((t) => t.role === "officer").length;
  const canFinish = !loading && (done || officerQuestions >= 4);
  const stepIndex = score ? 3 : started ? 2 : report ? 1 : 0;

  // Build the shareable pass from the final score.
  let pass: PassData | null = null;
  if (score) {
    const sorted = [...score.dimensions].sort((a, b) => b.score - a.score);
    pass = {
      name: (profile.name || "A student").trim(),
      consulate: country || "your consulate",
      overall: score.overall,
      verdict: score.overall >= 75 ? "passed" : score.overall >= 55 ? "needs work" : "not yet ready",
      top: sorted.slice(0, 2).map((d) => ({ name: d.name, score: d.score })),
      weak: sorted.length ? { name: sorted[sorted.length - 1].name, score: sorted[sorted.length - 1].score } : undefined,
      date: new Date().toISOString(),
    };
  }

  return (
    <div className="space-y-5">
      <PageHeading title="Visa" subtitle="Practice your US student-visa interview until you walk in calm. Coaching, not legal advice." />
      <Steps current={stepIndex} />

      {/* STEP 1 — documents */}
      {stepIndex === 0 && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Check your visa readiness</h2>
            <p className="mt-1 text-sm text-muted">
              Paste or upload your I-20 and funding details. Yaar reads them the way a consular officer would and flags
              the gaps before you walk in. <span className="font-medium text-ink">Your documents are never saved.</span>
            </p>
          </div>

          <div>
            <label className="label" htmlFor="visa-country">Where will you interview?</label>
            <select id="visa-country" className="input max-w-xs" value={country} onChange={(e) => setField({ country: e.target.value })}>
              {!COUNTRY_OPTIONS.includes(country) && <option value={country}>{country}</option>}
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <DocumentUpload value={documents} onChange={setDocuments} />

          {riskError && <ErrorNote onRetry={analyzeDocs}>{riskError}</ErrorNote>}

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={analyzeDocs} disabled={riskLoading || !documents.trim()}>
              {riskLoading ? <Spinner label="Reading your documents..." /> : "Check my readiness"}
            </button>
            <button className="btn-ghost" onClick={() => gate("visaInterview", () => start())} disabled={loading}>
              {loading ? <Spinner label="Getting ready..." /> : "Skip — just practice the interview"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — readiness result */}
      {stepIndex === 1 && report && (
        <div className="space-y-4">
          <div className="card flex flex-col items-center gap-3 text-center">
            <ScoreRing value={report.overall} suffix="/ 100 ready" />
            {report.summary && <Markdown className="max-w-prose text-sm text-muted">{report.summary}</Markdown>}
          </div>

          {report.inconsistencies.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Things that don't add up</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-600 dark:text-rose-300">
                {report.inconsistencies.map((x, i) => <li key={i}><Markdown inline>{x}</Markdown></li>)}
              </ul>
            </div>
          )}

          {report.weakPoints.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-ink">What an officer will push on</h3>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-ink/90">
                {report.weakPoints.map((x, i) => <li key={i}><Markdown inline>{x}</Markdown></li>)}
              </ul>
            </div>
          )}

          {report.recommendation && (
            <p className="rounded-xl border border-brand-500/15 bg-brand-500/5 p-4 text-sm text-ink"><Markdown inline>{report.recommendation}</Markdown></p>
          )}

          {interviewError && <ErrorNote onRetry={() => gate("visaInterview", () => start())}>{interviewError}</ErrorNote>}

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => gate("visaInterview", () => start())} disabled={loading}>
              {loading ? <Spinner label="Getting the officer ready..." /> : "Practice these in a mock interview"}
            </button>
            <button className="btn-ghost" onClick={() => setReport(null)}>Start over</button>
          </div>
        </div>
      )}

      {/* STEP 3 — mock interview */}
      {stepIndex === 2 && (
        <div className="card flex flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /></svg>
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-ink">Consular Officer</div>
                <div className="text-xs text-muted">mock interview · {country}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {speech.ttsSupported && (
                <button
                  type="button"
                  onClick={() => { const next = !readAloud; setReadAloud(next); if (!next) speech.cancelSpeech(); }}
                  className={`badge gap-1 ${readAloud ? "bg-brand-500/15 text-brand-500" : "bg-surface-2 text-muted hover:text-ink"}`}
                  aria-pressed={readAloud}
                  title="Read the officer's questions aloud"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" />{readAloud && <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>}</svg>
                  {readAloud ? "Voice on" : "Voice off"}
                </button>
              )}
              <span className="badge bg-surface-2 text-muted">{officerQuestions} asked</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 bg-surface-2/40 px-5 py-4">
            {history.map((t, i) => (
              <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${t.role === "officer" ? "rounded-bl-md bg-slate-700 text-white shadow-sm" : "rounded-br-md bg-surface text-ink shadow-sm ring-1 ring-black/5 dark:ring-white/10"}`}>
                  {t.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-slate-700 px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-line bg-surface px-5 py-4">
            {interviewError && <div className="mb-3"><ErrorNote onRetry={() => (history[history.length - 1]?.role === "student" ? answer() : start())}>{interviewError}</ErrorNote></div>}
            <div className="flex gap-2">
              <textarea
                className="input min-h-[44px] resize-none"
                rows={1}
                placeholder="Answer the officer…"
                aria-label="Your answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); answer(); } }}
              />
              {rec.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  disabled={loading || rec.transcribing}
                  aria-label={rec.recording ? "Stop and transcribe" : "Speak your answer"}
                  className={`btn-ghost shrink-0 self-end disabled:opacity-60 ${rec.recording ? "border-rose-500/50 text-rose-500" : ""}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={rec.recording ? "animate-pulse" : ""}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </button>
              )}
              <button className="btn-primary shrink-0 self-end" onClick={answer} disabled={loading || !input.trim() || rec.recording || rec.transcribing} aria-label="Send answer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
            {rec.supported && (
              <p className="mt-1.5 text-xs text-faint">
                {rec.phase === "uploading" ? "Uploading your answer..." : rec.phase === "thinking" ? "Yaar is listening — almost there..." : rec.recording ? "Recording... tap the mic to stop." : rec.error ? rec.error : "Tip: tap the mic to answer out loud, like the real interview."}
              </p>
            )}
            <button className={`mt-3 w-full sm:w-auto ${canFinish ? "btn-gold" : "btn-ghost"}`} onClick={finish} disabled={loading || history.length < 2}>
              {canFinish ? "You've done enough — score me" : "Finish and score me"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — Visa Pass + full feedback */}
      {stepIndex === 3 && score && pass && (
        <div className="space-y-5">
          <VisaPassCard pass={pass} />

          <details className="card">
            <summary className="cursor-pointer font-semibold text-ink">See the full breakdown</summary>
            <p className="mt-3 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink"><Markdown inline>{score.recommendation}</Markdown></p>
            <div className="mt-3 space-y-3">
              {score.dimensions.map((d, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{d.name}</span>
                    <span className="text-muted">{d.score} / 100</span>
                  </div>
                  <ScoreBar value={d.score} />
                  <p className="mt-1 text-sm text-muted"><Markdown inline>{d.note}</Markdown></p>
                </div>
              ))}
            </div>
            {score.drills.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-ink">Drills</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/90">
                  {score.drills.map((d, i) => <li key={i}><Markdown inline>{d}</Markdown></li>)}
                </ul>
              </div>
            )}
          </details>

          <button className="btn-ghost" onClick={restart}>Practice again</button>
        </div>
      )}
    </div>
  );
}
