import { useState } from "react";
import { api } from "../api/client";
import { getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { Spinner, SourceBadge, ErrorNote } from "./ui";

type Result = { scenario: string; impact: string; opensUp: string[]; watchOut: string[]; verdict: string; source: string };

const QUICK = [
  "What if I raise my budget to $40k a year?",
  "What if I switch to a Master's instead?",
  "What if I get a full scholarship?",
  "What if I change my major?",
];

// Let students explore how a change reshapes their plan, without touching their real profile.
export default function WhatIf() {
  const { summary } = useProfile();
  const [scenario, setScenario] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function run(s: string) {
    const text = s.trim();
    if (!text) return;
    setScenario(text);
    setLoading(true);
    setError(false);
    try {
      setRes(await api.whatIf(text, getProfileId() || undefined, summary()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ink">Play out a "what if" 🔮</h2>
      <p className="mt-1 text-sm text-muted">Curious how a change would shift your plan? Try one. It won't change anything saved, it just shows you the road.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} onClick={() => run(q)} disabled={loading} className="chip text-xs hover:border-brand-500 hover:text-brand-500 disabled:opacity-60">
            {q}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder="Or type your own: what if I take a gap year?"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(scenario); }}
        />
        <button className="btn-primary shrink-0" onClick={() => run(scenario)} disabled={loading || !scenario.trim()}>
          {loading ? <Spinner label="Thinking..." /> : "Show me"}
        </button>
      </div>

      {error && <div className="mt-3"><ErrorNote onRetry={() => run(scenario)}>Couldn't run that just now. Try again.</ErrorNote></div>}

      {res && !loading && (
        <div className="mt-4 space-y-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">If: {res.scenario}</h3>
            <SourceBadge source={res.source} />
          </div>
          <p className="text-sm leading-relaxed text-ink/90">{res.impact}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.opensUp.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Opens up</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.opensUp.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {res.watchOut.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Watch out</h4>
                <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.watchOut.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
          </div>
          {res.verdict && <p className="rounded-lg border border-line bg-surface/60 p-2.5 text-sm font-medium text-ink">{res.verdict}</p>}
        </div>
      )}
    </div>
  );
}
