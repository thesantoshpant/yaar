import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { RiskReport, VisaScore, VisaTurn } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, ScoreBar } from "../components/ui";

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

  // Return from Stripe checkout: confirm the session, then unlock.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      api
        .billingConfirm(sessionId)
        .then((r) => {
          if (r.paid) {
            setReportPaid(true);
            setNeedsPayment(false);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visa interview simulator</h1>
        <p className="mt-1 text-slate-600">
          Practice your F-1 interview with an AI consular officer. It probes ties to home, finances, and your
          study plan, then scores you honestly. This is coaching, not legal advice.
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Document-grounded visa risk report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste your I-20, admission, and funding details. Yaar reviews them the way a consular officer would and
          flags inconsistencies and weak points before your interview.
        </p>
        <textarea
          className="input mt-3 min-h-[120px]"
          placeholder="Paste: I-20 total cost, who is sponsoring you and their job, the bank balance shown, your program and school..."
          value={documents}
          onChange={(e) => setDocuments(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          Sent securely to analyze your interview risk and not saved after your session. Do not paste passwords.
        </p>
        <button className="btn-primary mt-3" onClick={analyzeDocs} disabled={riskLoading || !documents.trim()}>
          {riskLoading ? <Spinner label="Analyzing..." /> : "Analyze my documents"}
        </button>

        {report && (
          <div className="mt-5 rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Readiness: <span className="text-brand-700">{report.overall}</span>/100
              </h3>
              {report.locked && <span className="badge bg-amber-100 text-amber-700">preview</span>}
            </div>
            {report.summary && <p className="mt-1 text-sm text-slate-600">{report.summary}</p>}

            {report.inconsistencies.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-rose-700">Inconsistencies</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-rose-700">
                  {report.inconsistencies.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.weakPoints.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-slate-800">Weak points an officer will push on</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
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
                      <span className="font-medium text-slate-700">{d.name}</span>
                      <span className="text-slate-500">{d.score}/100</span>
                    </div>
                    <ScoreBar value={d.score} />
                  </div>
                ))}
              </div>
            )}

            {report.recommendation && (
              <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{report.recommendation}</p>
            )}

            {needsPayment && !reportPaid && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
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
            Your documents <span className="font-normal text-slate-400">(optional, but this is the magic)</span>
          </label>
          <textarea
            className="input min-h-[110px]"
            placeholder="Paste your I-20 and funding details: school, program, total cost on the I-20, who is sponsoring you, their job, and the bank balance shown. The AI officer will probe any inconsistency, exactly like a real interview."
            value={documents}
            onChange={(e) => setDocuments(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            These details are sent securely to power your mock interview and are not saved after your session.
            Do not paste passwords or anything you would not share with a counselor.
          </p>

          <button className="btn-primary mt-5" onClick={start} disabled={loading}>
            {loading ? <Spinner label="Starting..." /> : "Start the interview"}
          </button>
        </div>
      )}

      {started && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Interview</h2>
            <span className="text-sm text-slate-500">{history.filter((t) => t.role === "officer").length} questions</span>
          </div>
          <div className="space-y-3">
            {history.map((t, i) => (
              <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "officer" ? "bg-slate-800 text-white" : "bg-brand-600 text-white"
                  }`}
                >
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
                    {t.role === "officer" ? "Officer" : "You"}
                  </div>
                  {t.text}
                </div>
              </div>
            ))}
            {loading && <Spinner label="..." />}
          </div>

          {!score && (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  className="input"
                  placeholder="Answer the officer..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && answer()}
                />
                <button className="btn-primary" onClick={answer} disabled={loading || !input.trim()}>
                  Answer
                </button>
              </div>
              <button className="btn-gold mt-3" onClick={finish} disabled={loading || history.length < 2}>
                Finish and score me
              </button>
              {done && <p className="mt-2 text-sm text-slate-500">The officer is wrapping up. Finish and get your score.</p>}
            </>
          )}
        </div>
      )}

      {score && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Readiness: <span className="text-brand-700">{score.overall}</span> / 100
            </h2>
            <SourceBadge source={source} />
          </div>
          <p className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{score.recommendation}</p>

          <div className="space-y-3">
            {score.dimensions.map((d, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{d.name}</span>
                  <span className="text-slate-500">{d.score} / 100</span>
                </div>
                <ScoreBar value={d.score} />
                <p className="mt-1 text-sm text-slate-500">{d.note}</p>
              </div>
            ))}
          </div>

          {score.redFlags.length > 0 && (
            <div className="mt-5 rounded-lg border border-rose-100 bg-rose-50 p-4">
              <h3 className="font-semibold text-rose-800">Red flags</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-700">
                {score.redFlags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <h3 className="font-semibold text-slate-800">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
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
