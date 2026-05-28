// Public yaar-evals dashboard. Reads /evals.json (a static asset produced by
// scripts/run-evals.mjs on every deploy) and renders the latest pass rate +
// per-case breakdown. The whole point is verifiable claims for a resume /
// portfolio: not "I built an AI app" but "this is how often it does the right
// thing on these specific inputs, measured."
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface EvalCase {
  suite: string;
  name: string;
  pass: boolean;
  ms: number;
  failures: string[];
}

interface EvalResults {
  ranAt: string;
  base: string;
  total: number;
  passed: number;
  passRate: number;
  bySuite: Record<string, { total: number; passed: number }>;
  cases: EvalCase[];
}

export default function Evals() {
  const [data, setData] = useState<EvalResults | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    fetch("/evals.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((r) => {
        setData(r);
        setStatus("ok");
      })
      .catch(() => setStatus("missing"));
  }, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-4">
          <img src="/star.svg" alt="" className="h-6 w-6 dark:[filter:brightness(0)_invert(1)]" />
          <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
          <span className="ml-auto text-xs text-faint">yaar-evals · versioned, public, run every deploy</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Eval results</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every release of Yaar runs a public, versioned eval suite against the live backend. The point is honest measurement: not <em>"it works,"</em> but <em>how often, on which inputs, and where it fails.</em> Cases live in <code>evals/cases</code>; this dashboard is generated automatically.
        </p>

        {status === "loading" && (
          <div className="card mt-8 text-muted">Loading results…</div>
        )}

        {status === "missing" && (
          <div className="card mt-8">
            <h2 className="text-lg font-semibold text-ink">No results yet</h2>
            <p className="mt-1 text-sm text-muted">
              Run <code>node scripts/run-evals.mjs</code> against a live backend; the runner writes <code>frontend/public/evals.json</code>, which this page reads. Every commit that ships should re-run it.
            </p>
          </div>
        )}

        {status === "ok" && data && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat value={`${Math.round(data.passRate * 100)}%`} label="overall pass rate" accent="text-brand-600" />
              <Stat value={`${data.passed} / ${data.total}`} label="cases passing" accent="text-ink" />
              <Stat value={Object.keys(data.bySuite).length} label="suites" />
              <Stat value={relTime(data.ranAt)} label="last run" />
            </div>

            <div className="card mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">By suite</h2>
              <div className="mt-3 space-y-2">
                {Object.entries(data.bySuite).map(([suite, s]) => {
                  const rate = s.total ? s.passed / s.total : 0;
                  return (
                    <div key={suite} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 font-medium capitalize text-ink">{suite}</span>
                      <div className="flex-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                          <div className="h-2 rounded-full bg-brand-600" style={{ width: `${rate * 100}%` }} />
                        </div>
                      </div>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink">{s.passed}/{s.total}</span>
                      <span className="w-12 shrink-0 text-right text-sm text-muted">{Math.round(rate * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Cases</h2>
              <div className="mt-3 space-y-2">
                {data.cases.map((c, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">
                          <span className="text-faint">{c.suite}/</span>
                          {c.name}
                        </div>
                        <div className="text-xs text-faint">{c.ms} ms</div>
                      </div>
                      <span className={`badge ${c.pass ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>
                        {c.pass ? "pass" : "fail"}
                      </span>
                    </div>
                    {!c.pass && c.failures.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-xs text-muted">
                        {c.failures.map((f, j) => <li key={j}>{f}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-xs text-faint">
              Ran at {new Date(data.ranAt).toLocaleString()} against <code>{data.base}</code>.
              See <Link to="/" className="font-medium text-brand-600 hover:underline">yaar.app</Link> for the product.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="card flex flex-col gap-0.5 py-4">
      <div className={`text-2xl font-bold ${accent ?? "text-ink"}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
