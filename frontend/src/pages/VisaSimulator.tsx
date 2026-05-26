import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { RiskReport, VisaScore, VisaTurn } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { useAuthGate } from "../lib/authGate";
import { useSpeech } from "../lib/useSpeech";
import { useRecorder } from "../lib/useRecorder";
import { Spinner, SourceBadge, ScoreBar, PageHeading, ErrorNote } from "../components/ui";
import DocumentUpload from "../components/DocumentUpload";
import Markdown from "../components/Markdown";

const COUNTRY_OPTIONS = ["Nepal", "India", "Bangladesh", "Other"];

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
  const [source, setSource] = useState<string>();
  const [report, setReport] = useState<RiskReport | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState(false);
  const [interviewError, setInterviewError] = useState(false);
  const [reportPaid, setReportPaid] = useState(true);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Voice: speak your answer (recorded + transcribed by Gemini, reliable across browsers)
  // and have the officer read aloud (TTS). Both degrade to the plain text box.
  const speech = useSpeech(); // used only for the read-aloud (TTS) toggle
  const rec = useRecorder(); // used for dictating the student's answer
  const [readAloud, setReadAloud] = useState(false);
  const lastSpoke = useRef(-1);
  useEffect(() => {
    if (!readAloud) return;
    const i = history.length - 1;
    if (i >= 0 && history[i].role === "officer" && i !== lastSpoke.current) {
      lastSpoke.current = i;
      speech.speak(history[i].text);
    }
  }, [history, readAloud, speech]);

  async function toggleDictation() {
    if (rec.recording) {
      const t = await rec.stop();
      if (t) setInput((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
    } else {
      await rec.start();
    }
  }

  // Return from Stripe checkout: confirm the session, then unlock.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      api
        .billingConfirm(sessionId)
        .then(async (r) => {
          if (!r.paid) return;
          setReportPaid(true);
          setNeedsPayment(false);
          const pid = getProfileId();
          if (pid) {
            const latest = await api.riskLatest(pid); // fetch the now-unlocked full report
            if (latest.report) setReport(latest.report);
          }
        })
        .catch(() => {});
      window.history.replaceState({}, "", "/app/visa");
    }
  }, []);

  async function analyzeDocs() {
    if (!documents.trim()) return;
    setRiskLoading(true);
    setRiskError(false);
    try {
      const res = await api.riskReport([{ kind: "i20", text: documents }], getProfileId() || undefined);
      setReport(res.report);
      setReportPaid(res.paid);
      setNeedsPayment(!!res.needsPayment);
      setNeedsAccount(!!res.needsAccount);
      // Note: the visa milestone is marked complete only after the mock interview is
      // scored (see finish()), not just for generating a document report.
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setRiskError(true);
    } finally {
      setRiskLoading(false);
    }
  }

  async function unlock() {
    const pid = getProfileId();
    if (!pid) return;
    const res = await api.billingCheckout(pid);
    if (res.url) window.location.href = res.url;
    else {
      setReportPaid(true);
      setNeedsPayment(false);
    }
  }

  async function start() {
    setLoading(true);
    setScore(null);
    setDone(false);
    setInterviewError(false);
    try {
      const res = await api.visaNext(country, [], documents || undefined, getProfileId() || undefined);
      setHistory([{ role: "officer", text: res.question }]);
      setStarted(true);
    } catch {
      setInterviewError(true);
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
    setInterviewError(false);
    try {
      const res = await api.visaNext(country, withAnswer, documents || undefined, getProfileId() || undefined);
      setHistory([...withAnswer, { role: "officer", text: res.question }]);
      if (res.done) setDone(true);
    } catch {
      setInterviewError(true);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    setInterviewError(false);
    try {
      const res = await api.visaScore(country, history, documents || undefined, getProfileId() || undefined);
      setScore(res.score);
      setSource(res.source);
      markCompleted("visa");
    } catch {
      setInterviewError(true);
    } finally {
      setLoading(false);
    }
  }

  const officerQuestions = history.filter((t) => t.role === "officer").length;
  const canFinish = !loading && (done || officerQuestions >= 4);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Visa interview simulator 🎫"
        subtitle="Practice your F-1 interview with an AI officer until you walk in calm. It probes your ties to home, your finances, and your study plan, then scores you honestly. Coaching, not legal advice."
      />

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">Document-grounded visa risk report</h2>
        <p className="mt-1 text-sm text-muted">
          Upload your I-20, admission letter, and funding proof. Yaar reads them the way a consular officer would and
          flags the gaps before you walk in, so nothing catches you off guard.
        </p>

        <div className="mt-3">
          <DocumentUpload value={documents} onChange={setDocuments} />
        </div>

        {riskError && <div className="mt-3"><ErrorNote onRetry={analyzeDocs}>Yaar couldn't build your report just now. Give it a moment and try again.</ErrorNote></div>}

        <button className="btn-primary mt-4" onClick={analyzeDocs} disabled={riskLoading || !documents.trim()}>
          {riskLoading ? <Spinner label="Checking your documents..." /> : "Build my risk report"}
        </button>

        {report && (
          <div ref={reportRef} className="mt-5 rounded-xl border border-line p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">
                Readiness: <span className="text-brand-500">{report.overall}</span>/100
              </h3>
              {report.locked && <span className="badge bg-amber-500/12 text-amber-600 dark:text-amber-400">preview</span>}
            </div>
            <p className="mt-1 text-sm text-muted">Here's an honest look. Every point below is fixable before your interview.</p>
            {report.summary && <Markdown className="mt-1 text-sm text-muted">{report.summary}</Markdown>}

            {report.inconsistencies.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Inconsistencies</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-rose-600 dark:text-rose-300">
                  {report.inconsistencies.map((x, i) => (
                    <li key={i}><Markdown inline>{x}</Markdown></li>
                  ))}
                </ul>
              </div>
            )}

            {report.weakPoints.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-ink">Weak points an officer will push on</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-ink/90">
                  {report.weakPoints.map((x, i) => (
                    <li key={i}><Markdown inline>{x}</Markdown></li>
                  ))}
                </ul>
              </div>
            )}

            {report.dimensions.length > 0 && (
              <div className="mt-3 space-y-2">
                {report.dimensions.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{d.name}</span>
                      <span className="text-muted">{d.score}/100</span>
                    </div>
                    <ScoreBar value={d.score} />
                  </div>
                ))}
              </div>
            )}

            {report.recommendation && (
              <p className="mt-3 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink"><Markdown inline>{report.recommendation}</Markdown></p>
            )}

            {needsAccount && (
              <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-ink">
                You're seeing a free preview. Make a quick profile on the Dashboard and Yaar saves your full report so you can come back to it anytime.
              </div>
            )}

            {needsPayment && !reportPaid && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  You've seen the highlights. The full report shows every gap an officer might catch and exactly how to
                  fix each one before you walk in.
                </p>
                <button className="btn-gold mt-2" onClick={unlock}>
                  Unlock full report
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!started && (
        <div className="card">
          <label className="label" htmlFor="visa-country">Your country</label>
          <select id="visa-country" className="input max-w-xs" value={country} onChange={(e) => setField({ country: e.target.value })}>
            {!COUNTRY_OPTIONS.includes(country) && <option value={country}>{country}</option>}
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm text-muted">
            Ready to practice? The officer uses the documents you shared above, so it probes the same gaps a real
            interview would. {!documents.trim() && "You can also start without documents."}
          </p>

          {interviewError && <div className="mt-3"><ErrorNote onRetry={start}>Couldn't start the interview. Check your internet and try again.</ErrorNote></div>}

          <button className="btn-primary mt-4" onClick={() => gate("visaInterview", () => start())} disabled={loading}>
            {loading ? <Spinner label="Getting the officer ready..." /> : "Start the interview"}
          </button>
        </div>
      )}

      {started && (
        <div className="card flex flex-col overflow-hidden p-0">
          {/* Officer header */}
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-ink">Consular Officer</div>
                <div className="text-xs text-muted">F-1 visa interview · mock</div>
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
              <span className="badge bg-surface-2 text-muted">{officerQuestions} questions</span>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 space-y-3 bg-surface-2/50 px-5 py-4">
            {history.map((t, i) => (
              <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    t.role === "officer"
                      ? "rounded-bl-md bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm"
                      : "rounded-br-md bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                  }`}
                >
                  {t.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-gradient-to-br from-slate-700 to-slate-900 px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          {!score && (
            <div className="border-t border-line bg-surface px-5 py-4">
              {interviewError && <div className="mb-3"><ErrorNote onRetry={() => (history[history.length - 1]?.role === "student" ? answer() : start())}>That answer didn't go through. Try sending it again.</ErrorNote></div>}
              <div className="flex gap-2">
                <textarea
                  className="input min-h-[44px] resize-none"
                  rows={1}
                  placeholder="Answer the officer. Enter to send, Shift+Enter for a new line."
                  aria-label="Your answer to the officer"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      answer();
                    }
                  }}
                />
                {rec.supported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    disabled={loading || rec.transcribing}
                    aria-label={rec.recording ? "Stop and transcribe" : "Speak your answer"}
                    title={rec.recording ? "Recording... tap to stop" : "Speak your answer"}
                    className={`btn-ghost shrink-0 self-end disabled:opacity-60 ${rec.recording ? "border-rose-500/50 text-rose-500" : ""}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={rec.recording ? "animate-pulse" : ""}>
                      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                )}
                <button className="btn-primary shrink-0 self-end" onClick={answer} disabled={loading || !input.trim()} aria-label="Send answer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              {rec.supported && (
                <p className="mt-1.5 text-xs text-faint">
                  {rec.transcribing
                    ? "Transcribing your answer..."
                    : rec.recording
                      ? "Recording... speak your answer, then tap the mic to stop."
                      : rec.error
                        ? rec.error
                        : "Tip: tap the mic to speak your answer out loud, just like the real interview."}
                </p>
              )}
              <button
                className={`mt-3 w-full sm:w-auto ${canFinish ? "btn-gold" : "btn-ghost"}`}
                onClick={finish}
                disabled={loading || history.length < 2}
              >
                {canFinish ? "You've done enough. Score me" : "Finish and score me"}
              </button>
              {done && <p className="mt-2 text-sm text-muted">You've answered enough. Take a breath, then see how you did.</p>}
            </div>
          )}
        </div>
      )}

      {score && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              Readiness: <span className="text-brand-500">{score.overall}</span> / 100
            </h2>
            <SourceBadge source={source} />
          </div>
          <p className="mb-4 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink"><Markdown inline>{score.recommendation}</Markdown></p>

          <div className="space-y-3">
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

          {score.redFlags.length > 0 && (
            <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <h3 className="font-semibold text-rose-600 dark:text-rose-400">Red flags</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-600 dark:text-rose-300">
                {score.redFlags.map((r, i) => (
                  <li key={i}><Markdown inline>{r}</Markdown></li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <h3 className="font-semibold text-ink">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/90">
              {score.drills.map((d, i) => (
                <li key={i}><Markdown inline>{d}</Markdown></li>
              ))}
            </ul>
          </div>

          <button className="btn-ghost mt-5" onClick={() => { setStarted(false); setHistory([]); setScore(null); }}>
            Practice again
          </button>
        </div>
      )}
    </div>
  );
}
