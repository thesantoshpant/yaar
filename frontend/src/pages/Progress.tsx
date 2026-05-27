import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, type ProgressData, type SkillTrend, type TrendPoint } from "../api/client";
import { getProfileId } from "../lib/progress";
import { PageHeading, ErrorNote } from "../components/ui";
import { Skeleton, SkeletonText } from "../components/Skeleton";

// Small inline sparkline (no chart library): a student's scores over time, left to right.
function Sparkline({ points, max, up }: { points: TrendPoint[]; max: number; up: boolean }) {
  const w = 100;
  const h = 36;
  const pad = 4;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1));
  const y = (v: number) => h - pad - (Math.max(0, Math.min(max, v)) / max) * (h - 2 * pad);
  const stroke = up ? "rgb(16 185 129)" : "rgb(124 109 242)"; // emerald when improving, brand otherwise
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.scaled).toFixed(1)}`).join(" ");
  const last = points[n - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full overflow-visible" role="img" aria-label="Score trend">
      {n >= 2 && (
        <>
          <defs>
            <linearGradient id={`g-${last.date}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`} fill={`url(#g-${last.date})`} />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.scaled)} r={i === n - 1 ? 2.8 : 1.8} fill={stroke} />
      ))}
    </svg>
  );
}

function fmtDelta(unit: "band" | "points", delta: number): string {
  const v = unit === "band" ? Math.abs(delta).toFixed(1) : String(Math.abs(Math.round(delta)));
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${v}`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const hrs = Math.floor(m / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MODULE_META: Record<string, { emoji: string; label: string; to?: string }> = {
  test_prep: { emoji: "📝", label: "Test prep", to: "/app/mock" },
  speaking: { emoji: "🎙️", label: "Speaking", to: "/app/speaking" },
  roadmap: { emoji: "🗺️", label: "Roadmap", to: "/app/roadmap" },
  school_search: { emoji: "🎓", label: "Schools", to: "/app/schools" },
  applications: { emoji: "✍️", label: "Applications", to: "/app/applications" },
  coaches: { emoji: "🧭", label: "Coaches", to: "/app/coaches" },
  whatif: { emoji: "🔮", label: "What-if", to: "/app/roadmap" },
  visa: { emoji: "🛂", label: "Visa", to: "/app/visa" },
};
function eventMeta(kind: string, module?: string): { emoji: string; label: string; to?: string } {
  if (module && MODULE_META[module]) return MODULE_META[module];
  if (kind === "signup") return { emoji: "✨", label: "Started" };
  if (kind === "milestone") return { emoji: "🏆", label: "Milestone" };
  if (kind === "note") return { emoji: "🧠", label: "Note" };
  return { emoji: "•", label: "Activity" };
}

function StatTile({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="card flex flex-col gap-0.5 py-4">
      <div className={`text-2xl font-bold ${accent ?? "text-ink"}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function DeltaBadge({ trend }: { trend: SkillTrend }) {
  if (trend.delta == null) return <span className="badge bg-surface-2 text-faint">first attempt</span>;
  if (trend.delta === 0) return <span className="badge bg-surface-2 text-muted">no change</span>;
  const better = trend.delta > 0;
  return (
    <span className={`badge ${better ? "bg-emerald-500/12 text-emerald-500" : "bg-amber-500/12 text-amber-500"}`}>
      {better ? "▲" : "▼"} {fmtDelta(trend.unit, trend.delta)} vs last
    </span>
  );
}

export default function Progress() {
  const profileId = getProfileId();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    setError(false);
    try {
      setData(await api.progress(profileId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="Your progress 📈" />
        <div className="card text-muted">
          Set up your profile on the{" "}
          <Link to="/app" className="font-medium text-brand-500 hover:underline">Dashboard</Link>, then everything you do starts building your record here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Your progress 📈"
        subtitle="Everything you do is saved and turned into a picture of how you're growing. Last time vs this time, month over month, and where to focus next."
      />

      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card py-4">
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
          <div className="card"><SkeletonText lines={3} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card"><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-4 h-10 w-full" /></div>
            ))}
          </div>
        </div>
      )}

      {error && !data && <ErrorNote onRetry={load}>Couldn't load your progress just now.</ErrorNote>}

      {data && !data.hasData && (
        <div className="card text-center text-muted">
          <div className="mb-2 text-3xl">🌱</div>
          Nothing logged yet. Take a mock test, build a roadmap, or log some evidence, and your progress will start showing up here, automatically.
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/app/mock" className="btn-primary">Take a mock test</Link>
            <Link to="/app/roadmap" className="btn-ghost">Build a roadmap</Link>
          </div>
        </div>
      )}

      {data && data.hasData && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value={data.totals.streak > 0 ? `${data.totals.streak}🔥` : "0"} label="day streak" accent="text-ink" />
            <StatTile value={data.totals.mocks} label="mocks taken" accent="text-brand-500" />
            <StatTile value={data.totals.activities} label="things you've done" accent="text-violet-500" />
            <Link to="/app/memory" className="contents">
              <div className="card flex flex-col gap-0.5 py-4 transition-shadow hover:shadow-lift">
                <div className="text-2xl font-bold text-gold-500">{data.totals.factsKnown}</div>
                <div className="text-xs text-muted">things Yaar knows about you →</div>
              </div>
            </Link>
          </div>

          {/* AI growth recap */}
          <div className="card rounded-xl border-brand-500/20 bg-brand-500/5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <h2 className="text-sm font-semibold text-ink">How you're doing</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{data.recap}</p>
          </div>

          {/* Per-skill trends */}
          {data.skills.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink">Score trends</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.skills.map((s) => (
                  <div key={s.key} className="card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold capitalize text-ink">{s.skill}</div>
                        <div className="text-xs text-muted">{s.exam} · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-ink">{s.latestLabel}</div>
                        <div className="text-[11px] text-faint">best {s.unit === "band" ? s.best.toFixed(1) : Math.round(s.best)}{s.unit === "points" ? "/30" : ""}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Sparkline points={s.points} max={s.max} up={(s.delta ?? 0) >= 0} />
                    </div>
                    <div className="mt-2">
                      <DeltaBadge trend={s} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This month vs last month */}
          <div className="card">
            <h2 className="text-sm font-semibold text-ink">This month vs last</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <MonthCol title="This month" activities={data.monthly.thisMonth.activities} mocks={data.monthly.thisMonth.mocks} highlight />
              <MonthCol title="Last month" activities={data.monthly.lastMonth.activities} mocks={data.monthly.lastMonth.mocks} />
            </div>
            {(() => {
              const d = data.monthly.thisMonth.activities - data.monthly.lastMonth.activities;
              if (data.monthly.lastMonth.activities === 0 && data.monthly.thisMonth.activities === 0) return null;
              return (
                <p className="mt-3 text-xs text-muted">
                  {d > 0 ? `You're more active than last month (+${d}). Keep the momentum.` : d < 0 ? `A bit quieter than last month (${d}). A small step today keeps your streak alive.` : "About the same pace as last month."}
                </p>
              );
            })()}
          </div>

          {/* Recurring weak areas */}
          {data.weakAreas.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-ink">What to focus on</h2>
              <p className="mt-1 text-xs text-muted">Question types and skills that keep tripping you up. Yaar steers your next practice toward these.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.weakAreas.map((w) => (
                  <span key={w.type} className="badge bg-amber-500/12 capitalize text-amber-500">
                    {w.type.replace(/_/g, " ")}{w.count > 1 ? ` ×${w.count}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity timeline */}
          {data.timeline.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-ink">Everything you've done</h2>
              <ol className="mt-3 space-y-3">
                {data.timeline.map((e, i) => {
                  const m = eventMeta(e.kind, e.module);
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm" aria-hidden="true">{m.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-ink">{e.summary}</div>
                        <div className="text-[11px] text-faint">{m.label} · {relTime(e.ts)}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MonthCol({ title, activities, mocks, highlight }: { title: string; activities: number; mocks: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-brand-500/30 bg-brand-500/5" : "border-line bg-surface-2/40"}`}>
      <div className="text-xs font-medium text-muted">{title}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{activities}</div>
      <div className="text-xs text-muted">activities · {mocks} mock{mocks === 1 ? "" : "s"}</div>
    </div>
  );
}
