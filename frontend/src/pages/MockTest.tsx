import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type MockReadingTest,
  type MockReadingResult,
  type MockSkillResult,
  type MockWritingTask,
  type MockListeningTest,
  type MockSpeakingTask,
  type MockAttemptSummary,
  type MockQuestion,
} from "../api/client";
import { getProfileId } from "../lib/progress";
import { PageHeading, Spinner, ErrorNote, ScoreBar } from "../components/ui";
import { useRecorder } from "../lib/useRecorder";

type Section = "reading" | "listening" | "writing" | "speaking";
type Phase = "intro" | "taking" | "results";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function pretty(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

const SECTIONS: { key: Section; label: string; icon: string; blurb: string }[] = [
  { key: "reading", label: "Reading", icon: "📖", blurb: "Passage + questions, objectively scored." },
  { key: "listening", label: "Listening", icon: "🎧", blurb: "Play the audio, then answer." },
  { key: "writing", label: "Writing", icon: "✍️", blurb: "Timed essay, scored on criteria." },
  { key: "speaking", label: "Speaking", icon: "🎙️", blurb: "Prep, then record your answer." },
];

const ESTIMATE_LINE = "This is an AI practice estimate, not an official score.";

export default function MockTest() {
  const profileId = getProfileId() || undefined;
  const [exam, setExam] = useState("IELTS");
  const [section, setSection] = useState<Section>("reading");
  const [phase, setPhase] = useState<Phase>("intro");

  // Generated tasks (only one active at a time, by section).
  const [reading, setReading] = useState<MockReadingTest | null>(null);
  const [listening, setListening] = useState<MockListeningTest | null>(null);
  const [writing, setWriting] = useState<MockWritingTask | null>(null);
  const [speaking, setSpeaking] = useState<MockSpeakingTask | null>(null);

  // Answers.
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [essay, setEssay] = useState("");
  const [transcript, setTranscript] = useState("");

  // Results (one of two shapes).
  const [objResult, setObjResult] = useState<MockReadingResult | null>(null);
  const [skillResult, setSkillResult] = useState<MockSkillResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [history, setHistory] = useState<MockAttemptSummary[]>([]);
  const submittingRef = useRef(false);

  const loadHistory = useCallback(() => {
    if (!profileId) return;
    api.mockHistory(profileId).then((r) => setHistory(r.attempts)).catch(() => {});
  }, [profileId]);

  useEffect(() => loadHistory(), [loadHistory]);

  function resetState() {
    setError(false);
    setObjResult(null);
    setSkillResult(null);
    setResponses({});
    setEssay("");
    setTranscript("");
    setReading(null);
    setListening(null);
    setWriting(null);
    setSpeaking(null);
    setTimerOn(false);
    submittingRef.current = false;
  }

  // Generate the selected section. `keepSection` lets "Practice again" reuse it.
  const start = useCallback(
    async (sec: Section = section) => {
      setLoading(true);
      resetState();
      setSection(sec);
      try {
        if (sec === "reading") {
          const t = await api.mockGenerateReading(exam, profileId);
          setReading(t);
          setTimeLeft(t.timeSec);
          setTimerOn(true);
        } else if (sec === "listening") {
          const t = await api.mockGenerateListening(exam, profileId);
          setListening(t);
          setTimeLeft(t.timeSec);
          setTimerOn(false); // starts after first play
        } else if (sec === "writing") {
          const t = await api.mockGenerateWriting(exam, profileId);
          setWriting(t);
          setTimeLeft(t.timeSec);
          setTimerOn(true);
        } else {
          const t = await api.mockGenerateSpeaking(exam, profileId);
          setSpeaking(t);
          setTimeLeft(0);
          setTimerOn(false);
        }
        setPhase("taking");
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [exam, section, profileId]
  );

  const backToIntro = useCallback(() => {
    setPhase("intro");
    setTimerOn(false);
    loadHistory();
  }, [loadHistory]);

  // ---- Submitters --------------------------------------------------------
  const submitReading = useCallback(async () => {
    if (!reading || submittingRef.current) return;
    submittingRef.current = true;
    setTimerOn(false);
    setLoading(true);
    try {
      const r = await api.mockScoreReading(reading.testId, responses, profileId);
      setObjResult(r);
      setPhase("results");
      loadHistory();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [reading, responses, profileId, loadHistory]);

  const submitListening = useCallback(async () => {
    if (!listening || submittingRef.current) return;
    submittingRef.current = true;
    setTimerOn(false);
    setLoading(true);
    try {
      const r = await api.mockScoreListening(listening.testId, responses, profileId);
      setObjResult(r);
      setPhase("results");
      loadHistory();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [listening, responses, profileId, loadHistory]);

  const submitWriting = useCallback(async () => {
    if (!writing || submittingRef.current) return;
    submittingRef.current = true;
    setTimerOn(false);
    setLoading(true);
    try {
      const r = await api.mockScoreWriting(exam, writing.taskType, writing.prompt, writing.context, essay, profileId);
      setSkillResult(r);
      setPhase("results");
      loadHistory();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [writing, exam, essay, profileId, loadHistory]);

  const submitSpeaking = useCallback(async () => {
    if (!speaking || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const r = await api.mockScoreSpeaking(exam, speaking.taskType, speaking.prompt, transcript, profileId);
      setSkillResult(r);
      setPhase("results");
      loadHistory();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [speaking, exam, transcript, profileId, loadHistory]);

  // ---- Timer (reading / listening / writing) -----------------------------
  // Auto-submit objective sections at 0; writing auto-submits too. Speaking uses
  // its own internal phase timer (below).
  useEffect(() => {
    if (phase !== "taking" || !timerOn) return;
    if (timeLeft <= 0) {
      if (section === "reading") void submitReading();
      else if (section === "listening") void submitListening();
      else if (section === "writing") void submitWriting();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timerOn, timeLeft, section, submitReading, submitListening, submitWriting]);

  const answered = (qs: MockQuestion[]) => qs.filter((q) => responses[q.id]?.trim()).length;

  function onPracticeAgain() {
    void start(section);
  }

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
            <h2 className="text-lg font-semibold text-ink">Start a mock</h2>
            <p className="mt-1 text-sm text-muted">Pick an exam and a section. Each one is generated fresh and scored honestly.</p>

            <div className="mt-4">
              <label className="label" htmlFor="mock-exam">Exam</label>
              <select id="mock-exam" className="input max-w-xs" value={exam} onChange={(e) => setExam(e.target.value)}>
                <option value="IELTS">IELTS Academic</option>
                <option value="TOEFL">TOEFL iBT</option>
              </select>
            </div>

            <div className="mt-4">
              <span className="label">Section</span>
              <div className="mt-1.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SECTIONS.map((s) => {
                  const active = section === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSection(s.key)}
                      className={`card text-left transition ${active ? "border-brand-500/60 bg-brand-500/5 ring-1 ring-brand-500/40" : "hover:border-line hover:bg-surface-2"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{s.icon}</span>
                        <span className="font-semibold text-ink">{s.label}</span>
                        {active && <span className="badge ml-auto bg-brand-500/15 text-brand-500">Selected</span>}
                      </div>
                      <p className="mt-1.5 text-xs text-muted">{s.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={() => void start(section)} disabled={loading}>
                {loading ? <Spinner label="Building your test..." /> : `Start ${SECTIONS.find((s) => s.key === section)?.label.toLowerCase()} mock`}
              </button>
            </div>

            {error && <div className="mt-3"><ErrorNote onRetry={() => void start(section)}>Couldn't build the test just now. Try again.</ErrorNote></div>}
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

      {/* TAKING — READING */}
      {phase === "taking" && section === "reading" && reading && (
        <>
          <TakingBar
            badge={`${reading.exam} reading`}
            meta={`${answered(reading.questions)}/${reading.questions.length} answered`}
            timeLeft={timeLeft}
            loading={loading}
            onSubmit={() => void submitReading()}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card lg:sticky lg:top-24 lg:max-h-[70vh] lg:overflow-y-auto">
              <h2 className="font-display text-lg font-bold text-ink">{reading.title}</h2>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{reading.passage}</div>
            </div>
            <QuestionList questions={reading.questions} responses={responses} setResponses={setResponses} />
          </div>
        </>
      )}

      {/* TAKING — LISTENING */}
      {phase === "taking" && section === "listening" && listening && (
        <ListeningTaking
          test={listening}
          responses={responses}
          setResponses={setResponses}
          timeLeft={timeLeft}
          timerOn={timerOn}
          startTimer={() => setTimerOn(true)}
          loading={loading}
          onSubmit={() => void submitListening()}
          answered={answered(listening.questions)}
        />
      )}

      {/* TAKING — WRITING */}
      {phase === "taking" && section === "writing" && writing && (
        <>
          <TakingBar
            badge={`${writing.exam} writing`}
            meta={`${countWords(essay)} / ${writing.minWords} words`}
            timeLeft={timeLeft}
            loading={loading}
            onSubmit={() => void submitWriting()}
            submitLabel="Submit essay"
          />
          {writing.context && (
            <div className="card border-violet-500/30 bg-violet-500/5">
              <span className="badge bg-violet-500/15 text-violet-600 dark:text-violet-400">Reading / context</span>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{writing.context}</div>
            </div>
          )}
          <div className="card">
            <span className="badge bg-surface-2 text-muted">{pretty(writing.taskType)}</span>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{writing.prompt}</p>
            <textarea
              className="input mt-3 min-h-[18rem] resize-y leading-relaxed"
              placeholder="Write your response here..."
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-faint">{countWords(essay)} words (minimum {writing.minWords})</span>
              {countWords(essay) < writing.minWords && (
                <span className="text-amber-600 dark:text-amber-400">A bit short — aim for at least {writing.minWords} words for a fair score.</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAKING — SPEAKING */}
      {phase === "taking" && section === "speaking" && speaking && (
        <SpeakingTaking
          task={speaking}
          transcript={transcript}
          setTranscript={setTranscript}
          loading={loading}
          onSubmit={() => void submitSpeaking()}
        />
      )}

      {/* RESULTS — OBJECTIVE (reading / listening) */}
      {phase === "results" && objResult && (
        <>
          <ResultHeader scaledLabel={objResult.scaledLabel} feedback={objResult.feedback} weakTypes={objResult.weakTypes}
            title={`${objResult.exam} ${objResult.skill} result`} loading={loading} onAgain={onPracticeAgain} onBack={backToIntro}>
            <span className="ml-2 text-sm text-muted">{objResult.rawCorrect}/{objResult.rawTotal} correct</span>
          </ResultHeader>

          {section === "listening" && listening && (
            <div className="card">
              <h3 className="font-semibold text-ink">Transcript</h3>
              <p className="mt-1 text-xs text-muted">Now you can read what was said.</p>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{listening.transcript}</div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-ink">Review every question</h3>
            <div className="mt-3 space-y-3">
              {objResult.questions.map((q, i) => (
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

      {/* RESULTS — SKILL (writing / speaking) */}
      {phase === "results" && skillResult && (
        <>
          <ResultHeader scaledLabel={skillResult.scaledLabel} feedback={skillResult.feedback} weakTypes={skillResult.weakTypes}
            title={`${skillResult.exam} ${skillResult.skill} result`} loading={loading} onAgain={onPracticeAgain} onBack={backToIntro} />

          <div className="card">
            <h3 className="font-semibold text-ink">Criteria</h3>
            <div className="mt-3 space-y-4">
              {skillResult.criteria.map((c) => (
                <div key={c.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{c.name}</span>
                    <span className="text-sm font-semibold text-ink">{c.score}/{c.max}</span>
                  </div>
                  <div className="mt-1.5"><ScoreBar value={(c.score / c.max) * 100} /></div>
                  {c.feedback && <p className="mt-1.5 text-xs text-muted">{c.feedback}</p>}
                </div>
              ))}
            </div>
          </div>

          {skillResult.modelNote && (
            <div className="card border-violet-500/30 bg-violet-500/5">
              <h3 className="font-semibold text-ink">Model answer note</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{skillResult.modelNote}</p>
            </div>
          )}

          {skillResult.note && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">{skillResult.note}</div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function TakingBar({
  badge,
  meta,
  timeLeft,
  loading,
  onSubmit,
  submitLabel = "Submit & score",
}: {
  badge: string;
  meta: string;
  timeLeft: number;
  loading: boolean;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3">
      <div>
        <span className="badge bg-brand-500/15 text-brand-500">{badge}</span>
        <span className="ml-2 text-sm text-muted">{meta}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm font-semibold ${timeLeft < 60 ? "text-rose-500" : "text-ink"}`}>⏱ {fmtTime(timeLeft)}</span>
        <button className="btn-primary" onClick={onSubmit} disabled={loading}>
          {loading ? <Spinner label="Scoring..." /> : submitLabel}
        </button>
      </div>
    </div>
  );
}

function QuestionList({
  questions,
  responses,
  setResponses,
}: {
  questions: MockQuestion[];
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
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
                  placeholder="Type your answer"
                  value={responses[q.id] ?? ""}
                  onChange={(e) => setResponses((r) => ({ ...r, [q.id]: e.target.value }))}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultHeader({
  title,
  scaledLabel,
  feedback,
  weakTypes,
  loading,
  onAgain,
  onBack,
  children,
}: {
  title: string;
  scaledLabel: string;
  feedback: string;
  weakTypes: string[];
  loading: boolean;
  onAgain: () => void;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.12)_0,transparent_60%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold capitalize text-ink">{title}{children}</h2>
          <span className="font-display text-3xl font-extrabold text-brand-500">{scaledLabel}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/90">{feedback}</p>
        {weakTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-muted">Focus next on:</span>
            {weakTypes.map((w) => <span key={w} className="badge bg-amber-500/12 text-amber-600 dark:text-amber-400">{pretty(w)}</span>)}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={onAgain} disabled={loading}>{loading ? <Spinner label="Building..." /> : "Practice again"}</button>
          <button className="btn-ghost" onClick={onBack}>Back</button>
        </div>
        <p className="mt-3 text-xs text-faint">{ESTIMATE_LINE}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listening — audio via speechSynthesis, transcript hidden until results
// ---------------------------------------------------------------------------

function ListeningTaking({
  test,
  responses,
  setResponses,
  timeLeft,
  timerOn,
  startTimer,
  loading,
  onSubmit,
  answered,
}: {
  test: MockListeningTest;
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  timeLeft: number;
  timerOn: boolean;
  startTimer: () => void;
  loading: boolean;
  onSubmit: () => void;
  answered: number;
}) {
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);

  // Stop any speech if we unmount mid-playback.
  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  function play() {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(test.transcript);
    u.rate = 0.95;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    setPlaying(true);
    setPlayed(true);
    if (!timerOn) startTimer();
    window.speechSynthesis.speak(u);
  }

  return (
    <>
      <TakingBar
        badge={`${test.exam} listening`}
        meta={`${answered}/${test.questions.length} answered`}
        timeLeft={timeLeft}
        loading={loading}
        onSubmit={onSubmit}
      />

      <div className="card">
        <h2 className="font-display text-lg font-bold text-ink">{test.title}</h2>
        {ttsSupported ? (
          <>
            <p className="mt-1 text-sm text-muted">Play the audio and answer from memory — the transcript stays hidden until you finish.</p>
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" onClick={play} disabled={playing}>
                {playing ? "▶ Playing..." : played ? "▶ Play again" : "▶ Play audio"}
              </button>
              {!played && <span className="text-xs text-faint">The timer starts when you first play.</span>}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
              Audio playback isn't available in this browser, so we're showing the transcript instead. Read it once, then answer.
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{test.transcript}</div>
          </>
        )}
      </div>

      <QuestionList questions={test.questions} responses={responses} setResponses={setResponses} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Speaking — prep countdown -> speak countdown (record) -> edit -> submit
// ---------------------------------------------------------------------------

type SpeakPhase = "ready" | "prep" | "speaking" | "review";

function SpeakingTaking({
  task,
  transcript,
  setTranscript,
  loading,
  onSubmit,
}: {
  task: MockSpeakingTask;
  transcript: string;
  setTranscript: (t: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  const rec = useRecorder();
  const [sp, setSp] = useState<SpeakPhase>("ready");
  const [count, setCount] = useState(0);
  const advancedRef = useRef(false);

  const stopSpeaking = useCallback(async () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (rec.supported) {
      const t = await rec.stop();
      if (t) setTranscript(t);
    }
    setSp("review");
  }, [rec, setTranscript]);

  // Countdown driver for prep and speaking phases.
  useEffect(() => {
    if (sp !== "prep" && sp !== "speaking") return;
    if (count <= 0) {
      if (sp === "prep") {
        // Move to speaking.
        advancedRef.current = false;
        setSp("speaking");
        setCount(task.speakSec);
        if (rec.supported) void rec.start();
      } else {
        void stopSpeaking();
      }
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, count, task.speakSec]);

  function startPrep() {
    advancedRef.current = false;
    setCount(task.prepSec);
    setSp("prep");
  }

  return (
    <>
      <div className="card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3">
        <span className="badge bg-brand-500/15 text-brand-500">{task.exam} speaking</span>
        {(sp === "prep" || sp === "speaking") && (
          <span className={`font-mono text-sm font-semibold ${sp === "speaking" ? "text-rose-500" : "text-ink"}`}>
            {sp === "prep" ? "Prep" : "Speak"} ⏱ {fmtTime(count)}
          </span>
        )}
      </div>

      <div className="card">
        <span className="badge bg-surface-2 text-muted">{pretty(task.taskType)}</span>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{task.prompt}</p>
        {task.bullets && task.bullets.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/90">
            {task.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">Prep: {task.prepSec}s · Speak: {task.speakSec}s</p>
      </div>

      <div className="card">
        {sp === "ready" && (
          <>
            <p className="text-sm text-muted">
              {rec.supported
                ? "When you're ready, take prep time, then speak your answer aloud while we record. You can edit the transcript before submitting."
                : "Recording isn't available in this browser. Take prep time, then type your answer in the box."}
            </p>
            <button className="btn-primary mt-3" onClick={startPrep}>Start prep</button>
          </>
        )}

        {sp === "prep" && (
          <div className="text-center">
            <p className="text-sm text-muted">Prep time — gather your thoughts.</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-brand-500">{fmtTime(count)}</p>
            <button className="btn-ghost mt-3" onClick={() => setCount(0)}>Skip to speaking</button>
          </div>
        )}

        {sp === "speaking" && (
          <div className="text-center">
            <p className="text-sm text-muted">
              {rec.supported ? (rec.recording ? "🔴 Recording — speak now." : "Get ready...") : "Speak now, then type your answer below."}
            </p>
            <p className="mt-2 font-display text-4xl font-extrabold text-rose-500">{fmtTime(count)}</p>
            {!rec.supported && (
              <textarea
                className="input mt-3 min-h-[10rem] resize-y text-left leading-relaxed"
                placeholder="Type what you'd say..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            )}
            <button className="btn-primary mt-3" onClick={() => void stopSpeaking()}>Stop & finish</button>
          </div>
        )}

        {sp === "review" && (
          <>
            {rec.transcribing ? (
              <Spinner label="Transcribing your answer..." />
            ) : (
              <>
                <span className="label">Your answer transcript</span>
                <p className="mt-1 text-xs text-muted">Edit any words the transcription got wrong, then submit.</p>
                <textarea
                  className="input mt-2 min-h-[12rem] resize-y leading-relaxed"
                  placeholder="Your spoken answer..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                {rec.error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{rec.error}</p>}
                <button className="btn-primary mt-3" onClick={onSubmit} disabled={loading || !transcript.trim()}>
                  {loading ? <Spinner label="Scoring..." /> : "Submit & score"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
