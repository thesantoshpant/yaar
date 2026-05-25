import { useState } from "react";
import { api } from "../api/client";
import type { Roadmap as RoadmapType } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge } from "../components/ui";

export default function Roadmap() {
  const [form, setForm] = useState({
    country: "Nepal",
    intendedLevel: "undergraduate",
    intendedMajor: "",
    budgetUsdPerYear: "",
    targetIntake: "Fall 2027",
    testStatus: "",
  });
  const [roadmap, setRoadmap] = useState<RoadmapType | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function build() {
    setLoading(true);
    try {
      const res = await api.roadmap({
        country: form.country,
        intendedLevel: form.intendedLevel,
        intendedMajor: form.intendedMajor || undefined,
        budgetUsdPerYear: form.budgetUsdPerYear ? Number(form.budgetUsdPerYear) : undefined,
        targetIntake: form.targetIntake || undefined,
        testStatus: form.testStatus || undefined,
      });
      setRoadmap(res.roadmap);
      setSource(res.source);
      markCompleted("roadmap");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your roadmap</h1>
        <p className="mt-1 text-slate-600">An honest, realistic plan. No hype, no false promises.</p>
      </div>

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Country</label>
            <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <label className="label">Level</label>
            <select className="input" value={form.intendedLevel} onChange={(e) => setForm({ ...form, intendedLevel: e.target.value })}>
              <option value="undergraduate">Undergraduate</option>
              <option value="graduate">Graduate</option>
            </select>
          </div>
          <div>
            <label className="label">Intended major</label>
            <input className="input" value={form.intendedMajor} onChange={(e) => setForm({ ...form, intendedMajor: e.target.value })} />
          </div>
          <div>
            <label className="label">Budget per year (USD)</label>
            <input className="input" value={form.budgetUsdPerYear} onChange={(e) => setForm({ ...form, budgetUsdPerYear: e.target.value })} />
          </div>
        </div>
        <button className="btn-primary mt-5" onClick={build} disabled={loading}>
          {loading ? <Spinner label="Building..." /> : "Build my roadmap"}
        </button>
      </div>

      {roadmap && (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Summary</h2>
              <SourceBadge source={source} />
            </div>
            <p className="text-slate-700">{roadmap.summary}</p>
            <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              <strong>Realistic outcome:</strong> {roadmap.realisticOutcome}
            </p>
            {roadmap.estimatedTotalCostUsd && (
              <p className="mt-2 text-sm text-slate-600">
                <strong>Estimated cost:</strong> {roadmap.estimatedTotalCostUsd}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {roadmap.steps.map((s, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    {i + 1}. {s.phase}
                  </h3>
                  <span className="badge bg-slate-100 text-slate-600">{s.timeframe}</span>
                </div>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
                  {s.actions.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm italic text-slate-500">Why: {s.why}</p>
              </div>
            ))}
          </div>

          {roadmap.redFlags.length > 0 && (
            <div className="card border-rose-100 bg-rose-50">
              <h3 className="font-semibold text-rose-800">Watch out for</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-700">
                {roadmap.redFlags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
