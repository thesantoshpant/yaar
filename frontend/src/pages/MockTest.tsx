import { useCallback, useEffect, useRef, useState } from "react";
import { api, type MockReadingTest, type MockReadingResult, type MockAttemptSummary } from "../api/client";
import { getProfileId } from "../lib/progress";
import { PageHeading, Spinner, ErrorNote } from "../components/ui";

type Phase = "intro" | "taking" | "results";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function pretty(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MockTest() {
  const profileId = getProfileId() || undefined;
  const [exam, setExam] = useState("IELTS");
  const [phase, setPhase] = useState<Phase>("intro");
  const [test, setTest] = useState<MockReadingTest | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MockReadingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [history, setHistory] = useState<MockAttemptSummary[]>([]);
  const submittingRef = useRef(false);

  const loadHistory = useCallback(() => {
    if (!profileId) return;
    api.mockHistory(profileId).then((r) => setHistory(r.attempts)).catch(() => {});
  }, [profileId]);

  useEffect(() => loadHistory(), [loadHistory]);

  async function start() {
    setLoading(true);
    setError(false);
    setResult(null);
    setResponses({});
    try {
      const t = await api.mockGenerateReading(exam, profileId);
      setTest(t);
      setTimeLeft(t.timeSec);
      setPhase("taking");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const submit = useCallback(async () => {
    if (!test || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const r = await api.mockScoreReading(test.testId, responses, profileId);
      setResult(r);
      setPhase("results");
      loadHistory();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [test, responses, profileId, loadHistory]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (phase !== "taking") return;
    if (timeLeft <= 0) {
      void submit();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft, submit]);

  const answered = test ? Object.keys(responses).filter((k) => responses[k]?.trim()).length : 0;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Mock test 🎯"
        subtitle="A real IELTS or TOEFL section, generated fresh, scored honestly, and saved. Yaar learns where you slip and makes your next test target exactly that."
      />

      {/* INTRO */}
      {phase === "intro" && (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-ink">Start a reading mock</h2>
            <p className="mt-1 text-sm text-muted">Other sections (listening, writing, speaking) are coming. Reading is fully scored and adaptive today.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="mock-exam">Exam</label>
                <select id="mock-exam" className="input max-w-xs" value={exam} onChange={(e) => setExam(e.target.value)}>
                  <option value="IELTS">IELTS Academic</option>
                  <option value="TOEFL">TOEFL iBT</option>
                </select>
              </div>
              <button className="btn-primary" onClick={start} disabled={loading}>
                {loading ? <Spinner label="Building your test..." /> : "Start reading mock"}
              </button>
            </div>
            {error && <div className="mt-3"><ErrorNote onRetry={start}>Couldn't build the test just now. Try again.</ErrorNote></div>}
            {!profileId && <p className="mt-3 text-xs text-faint">Tip: set up your profile on the Dashboard so Yaar saves your history and adapts to you.</p>}
          </div>

          {history.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-ink">Your history</h2>
              <p className="mt-1 text-sm text-muted">{history.length} attempt{history.length === 1 ? "" : "s"} saved. Latest first.</p>
              <div className="mt-3 space-y-2">
                {history.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-brand-500/15 text-brand-500">{a.exam}</span>
                      <span className="capitalize text-muted">{a.skill}</span>
                      <span className="font-semibold text-ink">{a.scaledLabel}</span>
                      {a.rawTotal ? <span className="text-faint">({a.rawCorrect}/{a.rawTotal})</span> : null}
                    </div>
                    <div className="flex items-center gap-2 text-faint">
                      {a.weakTypes.slice(0, 2).map((w) => <span key={w} className="badge bg-amber-500/12 text-amber-600 dark:text-amber-400">{pretty(w)}</span>)}
                      <span className="text-xs">{a.createdAt.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAKING */}
      {phase === "taking" && test && (
        <>
          <div className="card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="badge bg-brand-500/15 text-brand-500">{test.exam} reading</span>
              <span className="ml-2 text-sm text-muted">{answered}/{test.questions.length} answered</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-sm font-semibold ${timeLeft < 60 ? "text-rose-500" : "text-ink"}`}>⏱ {fmtTime(timeLeft)}</span>
              <button className="btn-primary" onClick={submit} disabled={loading}>
                {loading ? <Spinner label="Scoring..." /> : "Submit & score"}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card lg:sticky lg:top-24 lg:max-h-[70vh] lg:overflow-y-auto">
              <h2 className="font-display text-lg font-bold text-ink">{test.title}</h2>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{test.passage}</div>
            </div>

            <div className="space-y-4">
              {test.questions.map((q, i) => (
                <div key={q.id} className="card">
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-500">{i + 1}</span>
                    <div className="flex-1">
                      <span className="badge bg-surface-2 text-muted">{pretty(q.type)}</span>
                      <p className="mt-1.5 text-sm text-ink">{q.prompt}</p>
                      {q.options ? (
                        <div className="mt-2 space-y-1.5">
                          {q.options.map((opt) => (
                            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2">
                              <input
                                type="radio"
                                name={q.id}
                                checked={responses[q.id] === opt}
                                onChange={() => setResponses((r) => ({ ...r, [q.id]: opt }))}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          className="input mt-2"
                          placeholder="Type your answer (exact words from the passage)"
                          value={responses[q.id] ?? ""}
                          onChange={(e) => setResponses((r) => ({ ...r, [q.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* RESULTS */}
      {phase === "results" && result && (
        <>
          <div className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.12)_0,transparent_60%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">{result.exam} reading result</h2>
                <span className="font-display text-3xl font-extrabold text-brand-500">{result.scaledLabel}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink/90">{result.feedback}</p>
              {result.weakTypes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted">Focus next on:</span>
                  {result.weakTypes.map((w) => <span key={w} className="badge bg-amber-500/12 text-amber-600 dark:text-amber-400">{pretty(w)}</span>)}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button className="btn-primary" onClick={start} disabled={loading}>{loading ? <Spinner label="Building..." /> : "Practice again"}</button>
                <button className="btn-ghost" onClick={() => { setPhase("intro"); loadHistory(); }}>Back</button>
              </div>
              <p className="mt-3 text-xs text-faint">This is an AI practice estimate to guide your prep, not an official score.</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-ink">Review every question</h3>
            <div className="mt-3 space-y-3">
              {result.questions.map((q, i) => (
                <div key={q.id} className={`rounded-xl border p-3 ${q.correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${q.correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{q.correct ? "✓" : "✕"} Q{i + 1}</span>
                    <span className="badge bg-surface-2 text-muted">{pretty(q.type)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{q.prompt}</p>
                  <p className="mt-1 text-sm text-muted">Your answer: <span className={q.correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{q.your || "(blank)"}</span>{!q.correct && <> · Correct: <span className="font-medium text-ink">{q.correctAnswer}</span></>}</p>
                  {q.explanation && <p className="mt-1 text-xs text-faint">{q.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
