import { useState } from "react";
import { api } from "../api/client";
import type { SpeakingScore } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge, ScoreBar } from "../components/ui";

export default function SpeakingPractice() {
  const [exam, setExam] = useState("IELTS");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<SpeakingScore | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Speaking practice</h1>
        <p className="mt-1 text-slate-600">
          Unlimited TOEFL and IELTS speaking practice, scored against the official rubric. Voice mode (Gemini
          Live) is coming. For now, type or paste your spoken answer.
        </p>
      </div>

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
            <div className="rounded-lg bg-slate-50 p-4 text-slate-800">
              <span className="badge bg-brand-100 text-brand-700">Prompt</span>
              <p className="mt-2">{prompt}</p>
            </div>
            <label className="label mt-4">Your answer</label>
            <textarea
              className="input min-h-[140px]"
              placeholder="Speak your answer out loud, then type or paste it here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <button className="btn-primary mt-3" onClick={submit} disabled={loading || !answer.trim()}>
              {loading ? <Spinner label="Scoring..." /> : "Score my answer"}
            </button>
          </div>
        )}
      </div>

      {score && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {score.exam} band: <span className="text-brand-700">{score.band}</span> / {max}
              </h2>
            </div>
            <SourceBadge source={source} />
          </div>

          <div className="space-y-3">
            {score.criteria.map((c, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="text-slate-500">
                    {c.score} / {max}
                  </span>
                </div>
                <ScoreBar value={c.score} max={max} />
                <p className="mt-1 text-sm text-slate-500">{c.feedback}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-brand-50 p-4">
            <h3 className="font-semibold text-brand-900">Model answer</h3>
            <p className="mt-1 text-sm text-brand-900">{score.improvedAnswer}</p>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-slate-800">Drills</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
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
