import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { RiskReport, VisaScore, VisaTurn } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, ScoreBar, PageHeading } from "../components/ui";

export default function VisaSimulator() {
  const [country, setCountry] = useState("Nepal");
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
  const [reportPaid, setReportPaid] = useState(true);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);

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
    try {
      const res = await api.riskReport([{ kind: "i20", text: documents }], getProfileId() || undefined);
      setReport(res.report);
      setReportPaid(res.paid);
      setNeedsPayment(!!res.needsPayment);
      setNeedsAccount(!!res.needsAccount);
      markCompleted("visa");
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
    try {
      const res = await api.visaNext(country, [], documents || undefined);
      setHistory([{ role: "officer", text: res.question }]);
      setStarted(true);
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
    try {
      const res = await api.visaNext(country, withAnswer, documents || undefined);
      setHistory([...withAnswer, { role: "officer", text: res.question }]);
      if (res.done) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    try {
      const res = await api.visaScore(country, history, documents || undefined);
      setScore(res.score);
      setSource(res.source);
      markCompleted("visa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Visa interview simulator 🎫"
        subtitle="Practice your F-1 interview with an AI officer until you walk in fearless. It probes your ties to home, finances, and study plan, then scores you honestly. Coaching, not legal advice."
      />

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">Document-grounded visa risk report</h2>
        <p className="mt-1 text-sm text-muted">
          Paste your I-20, admission, and funding details. Yaar reviews them the way a consular officer would and
          flags inconsistencies and weak points before your interview.
        </p>
        <textarea
          className="input mt-3 min-h-[120px]"
          placeholder="Paste: I-20 total cost, who is sponsoring you and their job, the bank balance shown, your program and school..."
          value={documents}
          onChange={(e) => setDocuments(e.target.value)}
        />
        <p className="mt-1 text-xs text-faint">
          We do not store your raw documents. Your report is saved to your account so you can track progress. Do
          not paste passwords.
        </p>
        <button className="btn-primary mt-3" onClick={analyzeDocs} disabled={riskLoading || !documents.trim()}>
          {riskLoading ? <Spinner label="Analyzing..." /> : "Analyze my documents"}
        </button>

        {report && (
          <div className="mt-5 rounded-xl border border-line p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">
                Readiness: <span className="text-brand-500">{report.overall}</span>/100
              </h3>
              {report.locked && <span className="badge bg-amber-500/12 text-amber-600 dark:text-amber-400">preview</span>}
            </div>
            {report.summary && <p className="mt-1 text-sm text-muted">{report.summary}</p>}

            {report.inconsistencies.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Inconsistencies</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-rose-600 dark:text-rose-300">
                  {report.inconsistencies.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.weakPoints.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-ink">Weak points an officer will push on</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-ink/90">
                  {report.weakPoints.map((x, i) => (
                    <li key={i}>{x}</li>
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
              <p className="mt-3 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink">{report.recommendation}</p>
            )}

            {needsAccount && (
              <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-ink">
                This is a free preview. Set up your profile on the Dashboard to generate and save your full report.
              </div>
            )}

            {needsPayment && !reportPaid && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  This is a free preview. Unlock the full report: every inconsistency, all weak points, and
                  per-dimension scoring.
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
          <label className="label">Your country</label>
          <select className="input max-w-xs" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option>Nepal</option>
            <option>India</option>
            <option>Bangladesh</option>
            <option>Other</option>
          </select>

          <label className="label mt-4">
            Your documents <span className="font-normal text-faint">(optional, but this is the magic)</span>
          </label>
          <textarea
            className="input min-h-[110px]"
            placeholder="Paste your I-20 and funding details: school, program, total cost on the I-20, who is sponsoring you, their job, and the bank balance shown. The AI officer will probe any inconsistency, exactly like a real interview."
            value={documents}
            onChange={(e) => setDocuments(e.target.value)}
          />
          <p className="mt-1 text-xs text-faint">
            These details are sent securely to power your mock interview and are not saved after your session.
            Do not paste passwords or anything you would not share with a counselor.
          </p>

          <button className="btn-primary mt-5" onClick={start} disabled={loading}>
            {loading ? <Spinner label="Starting..." /> : "Start the interview"}
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
            <span className="badge bg-surface-2 text-muted">
              {history.filter((t) => t.role === "officer").length} questions
            </span>
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
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Answer the officer..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && answer()}
                />
                <button className="btn-primary shrink-0" onClick={answer} disabled={loading || !input.trim()} aria-label="Send answer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <button className="btn-gold mt-3 w-full sm:w-auto" onClick={finish} disabled={loading || history.length < 2}>
                Finish and score me
              </button>
              {done && <p className="mt-2 text-sm text-muted">The officer is wrapping up. Finish and get your score.</p>}
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
          <p className="mb-4 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink">{score.recommendation}</p>

          <div className="space-y-3">
            {score.dimensions.map((d, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{d.name}</span>
                  <span className="text-muted">{d.score} / 100</span>
                </div>
                <ScoreBar value={d.score} />
                <p className="mt-1 text-sm text-muted">{d.note}</p>
              </div>
            ))}
          </div>

          {score.redFlags.length > 0 && (
            <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <h3 className="font-semibold text-rose-600 dark:text-rose-400">Red flags</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-600 dark:text-rose-300">
                {score.redFlags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <h3 className="font-semibold text-ink">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/90">
              {score.drills.map((d, i) => (
                <li key={i}>{d}</li>
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
