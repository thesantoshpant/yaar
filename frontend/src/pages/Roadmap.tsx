import { useState } from "react";
import { api } from "../api/client";
import type { Roadmap as RoadmapType } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

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
      <PageHeading title="Your roadmap 🗺️" subtitle="An honest, realistic plan — no hype, no false promises, no sugar-coating." />

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
              <h2 className="text-lg font-semibold text-ink">Summary</h2>
              <SourceBadge source={source} />
            </div>
            <p className="text-ink/90">{roadmap.summary}</p>
            <p className="mt-3 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3 text-sm text-ink">
              <strong className="text-brand-500">Realistic outcome:</strong> {roadmap.realisticOutcome}
            </p>
            {roadmap.estimatedTotalCostUsd && (
              <p className="mt-2 text-sm text-muted">
                <strong className="text-ink">Estimated cost:</strong> {roadmap.estimatedTotalCostUsd}
              </p>
            )}
          </div>

          <ol className="relative space-y-3 before:absolute before:left-[1.15rem] before:top-2 before:bottom-2 before:w-px before:bg-line sm:before:left-[1.4rem]">
            {roadmap.steps.map((s, i) => (
              <li key={i} className="card relative">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-3 text-base font-bold text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    {s.phase}
                  </h3>
                  <span className="badge bg-surface-2 text-muted">{s.timeframe}</span>
                </div>
                <ul className="mt-3 list-inside list-disc space-y-1 pl-10 text-sm text-ink/90">
                  {s.actions.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
                <p className="mt-2 pl-10 text-sm italic text-muted">Why: {s.why}</p>
              </li>
            ))}
          </ol>

          {roadmap.redFlags.length > 0 && (
            <div className="card border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-600 dark:text-rose-400">Watch out for</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-600 dark:text-rose-300">
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
