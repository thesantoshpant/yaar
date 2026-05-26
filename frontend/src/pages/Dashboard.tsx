import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AgentPlan, ModuleKey, JourneyState } from "../lib/types";
import { clearStudent, getCompleted } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { Spinner, SourceBadge, ScoreBar, PageHeading, ErrorNote } from "../components/ui";
import PersonaPicker from "../components/PersonaPicker";
import WhatIf from "../components/WhatIf";

const MODULE_ROUTE: Record<ModuleKey, string> = {
  roadmap: "/app/roadmap",
  test_prep: "/app/speaking",
  school_search: "/app/schools",
  applications: "/app/applications",
  finances: "/app/counselor",
  visa: "/app/visa",
};

const MODULE_LABEL: Record<ModuleKey, string> = {
  roadmap: "Roadmap",
  test_prep: "Test prep",
  school_search: "School search",
  applications: "Applications",
  finances: "Finances and I-20",
  visa: "Visa interview",
};

const STEPPER_MODULES: { key: ModuleKey; label: string; route: string; desc: string }[] = [
  { key: "roadmap", label: "Roadmap", route: "/app/roadmap", desc: "Strategy & timeline" },
  { key: "test_prep", label: "Test prep", route: "/app/speaking", desc: "TOEFL & IELTS prep" },
  { key: "school_search", label: "School search", route: "/app/schools", desc: "Build school list" },
  { key: "applications", label: "Applications", route: "/app/applications", desc: "Draft SOP & essays" },
  { key: "finances", label: "Finances", route: "/app/counselor", desc: "I-20 & funds review" },
  { key: "visa", label: "Visa interview", route: "/app/visa", desc: "Mock consular drill" },
];

const BUDGET_OPTIONS = [
  { value: "", label: "I'm not sure yet" },
  { value: "12000", label: "Under $15k a year" },
  { value: "22000", label: "$15k to $30k a year" },
  { value: "40000", label: "Over $30k a year" },
];

const TEST_OPTIONS = ["Haven't started", "Studying now", "Already took it"];

function formatTag(tag: string): string {
  const mapping: Record<string, string> = {
    ug_rural_bootstrap: "🌾 Rural UG First-Gen",
    gr_rural_bootstrap: "🌾 Rural Grad First-Gen",
    ug_urban_resourced: "🏙️ Urban UG Scholar",
    gr_urban_resourced: "🏙️ Urban Grad Scholar",
    aid_dependent: "💸 Needs Financial Aid",
    strong_stem_weak_english: "🎙️ STEM / English Prep",
    strong_english_weak_stem: "📚 Arts & Humanities",
    non_traditional: "⏱️ Non-Traditional Path",
  };
  return mapping[tag.toLowerCase()] ?? tag.replace(/_/g, " ").toUpperCase();
}

function YesNo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Prefer not to say</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, setField, saveNow, summary, reset, hasProfile } = useProfile();
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [completed, setCompleted] = useState<ModuleKey[]>([]);
  const [journey, setJourney] = useState<JourneyState | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    setCompleted(getCompleted());
    // Returning student: rehydrate their journey and last plan automatically.
    if (hasProfile) {
      void (async () => {
        const pid = await saveNow();
        if (!pid) return;
        api.getJourney(pid).then((res) => setJourney(res.journey)).catch(() => {});
        api.agentPlan(summary(), getCompleted(), pid)
          .then((res) => { setPlan(res.plan); setSource(res.source); })
          .catch(() => {});
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function planNext() {
    setLoading(true);
    setError(false);
    try {
      const profileId = await saveNow();
      const res = await api.agentPlan(summary(), getCompleted(), profileId);
      setPlan(res.plan);
      setSource(res.source);
      if (profileId) {
        const jRes = await api.getJourney(profileId).catch(() => null);
        if (jRes) setJourney(jRes.journey);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    if (!window.confirm("This clears your saved answers and progress on this device. Are you sure?")) return;
    clearStudent();
    reset();
    setPlan(null);
    setCompleted([]);
    setJourney(null);
    setSource(undefined);
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title={hasProfile ? "Welcome back 👋" : "Hey 👋 let's plan your move"}
        subtitle="Tell Yaar a little about you. Even one or two answers is enough. Yaar figures out your best next step and keeps checking in, like a friend who's done this before."
        action={
          hasProfile && (
            <button className="btn-ghost" onClick={startOver}>
              Start over
            </button>
          )
        }
      />

      {!hasProfile && <PersonaPicker />}

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">About you</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Answer what you can. Yaar fills in the rest and gets sharper as it learns about you. Anything you set here is remembered across every page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-name">Name</label>
            <input id="f-name" className="input" value={profile.name} onChange={(e) => setField({ name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="f-level">I'm applying for</label>
            <select id="f-level" className="input" value={profile.intendedLevel} onChange={(e) => setField({ intendedLevel: e.target.value as "undergraduate" | "graduate" })}>
              <option value="undergraduate">Undergraduate (Bachelor's)</option>
              <option value="graduate">Graduate (Master's / PhD)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-grade">Where you are now</label>
            <select id="f-grade" className="input" value={profile.gradeLevel} onChange={(e) => setField({ gradeLevel: e.target.value })}>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
              <option value="gap">Gap year</option>
              <option value="bachelors">In bachelor's</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-major">Intended major <span className="font-normal text-faint">· optional</span></label>
            <input id="f-major" className="input" placeholder="Not sure yet is fine" value={profile.intendedMajor} onChange={(e) => setField({ intendedMajor: e.target.value })} />
          </div>
        </div>

        {showMore && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="f-country">Country</label>
                <input id="f-country" className="input" value={profile.country} onChange={(e) => setField({ country: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="f-budget">Budget per year</label>
                <select id="f-budget" className="input" value={profile.budget} onChange={(e) => setField({ budget: e.target.value })}>
                  {BUDGET_OPTIONS.map((b) => <option key={b.label} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="f-intake">Target intake</label>
                <input id="f-intake" className="input" value={profile.targetIntake} onChange={(e) => setField({ targetIntake: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="f-test">Test status</label>
                <select id="f-test" className="input" value={profile.testStatus} onChange={(e) => setField({ testStatus: e.target.value })}>
                  <option value="">Prefer not to say</option>
                  {TEST_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-faint">Your situation</h3>
            <p className="mb-3 text-sm text-muted">
              This is how Yaar tailors your journey. A rural, first-generation student gets a very different plan from a well-resourced one.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <YesNo label="Live in a rural area?" value={profile.isRural} onChange={(v) => setField({ isRural: v })} />
              <YesNo label="First in family to study abroad?" value={profile.firstGen} onChange={(v) => setField({ firstGen: v })} />
              <YesNo label="School has a counselor?" value={profile.schoolHasCounselor} onChange={(v) => setField({ schoolHasCounselor: v })} />
              <YesNo label="School has clubs?" value={profile.schoolHasClubs} onChange={(v) => setField({ schoolHasClubs: v })} />
              <YesNo label="Family knows the US process?" value={profile.familiarWithProcess} onChange={(v) => setField({ familiarWithProcess: v })} />
            </div>
          </>
        )}

        {!showMore && (
          <button type="button" className="mt-4 text-sm font-medium text-brand-500 hover:underline" onClick={() => setShowMore(true)}>
            Tell Yaar more so your plan fits you better (optional)
          </button>
        )}

        {error && <div className="mt-4"><ErrorNote onRetry={planNext}>Yaar couldn't reach the internet just now. Your answers are saved. Tap to try again.</ErrorNote></div>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={planNext} disabled={loading}>
            {loading ? <Spinner label="Thinking about your best step..." /> : "Plan my next step"}
          </button>
          <span className="text-xs text-faint">Saved on this device. Sign in to keep your journey on any phone or computer.</span>
        </div>
      </div>

      {loading && !plan && (
        <div className="card animate-pulse">
          <div className="h-4 w-40 rounded bg-surface-2" />
          <div className="mt-4 h-24 rounded-xl bg-surface-2" />
        </div>
      )}

      {plan && (
        <div className="card relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.10)_0,transparent_60%)]" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Recommended next step</h2>
              <SourceBadge source={source} />
            </div>
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-sm text-muted">
                <span>Journey progress</span>
                <span className="font-semibold text-ink">{plan.progressPct}%</span>
              </div>
              <ScoreBar value={plan.progressPct} />
            </div>
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
              <span className="badge bg-brand-500/15 text-brand-500">{MODULE_LABEL[plan.nextAction.module] ?? "Next step"}</span>
              <h3 className="mt-2 font-display text-xl font-bold text-ink">{plan.nextAction.title}</h3>
              <p className="mt-1 text-muted">{plan.nextAction.why}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="btn-primary" onClick={() => navigate(MODULE_ROUTE[plan.nextAction.module] ?? "/app")}>
                  Let's do it 🚀
                </button>
                <button className="text-sm font-medium text-muted hover:text-ink" onClick={() => navigate("/app/updates")}>
                  See my updates
                </button>
              </div>
              <p className="mt-3 text-sm text-muted">Do this step, then Yaar checks in and lines up your next move automatically.</p>
            </div>
            <p className="mt-4 text-sm italic text-muted">{plan.encouragement}</p>
          </div>
        </div>
      )}

      {plan && <WhatIf />}

      <div className="card overflow-hidden">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your milestone stepper</h2>
            <p className="text-xs text-muted">Core steps required to get your F-1 student visa.</p>
          </div>
          {journey && journey.personaTags && journey.personaTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {journey.personaTags.map((t) => (
                <span key={t.tag} className="badge bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] uppercase font-bold tracking-wider">
                  {formatTag(t.tag)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          {/* Timeline Connector Line */}
          <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-line lg:left-8 lg:right-8 lg:top-6 lg:bottom-auto lg:h-0.5 lg:w-auto" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:justify-between">
            {STEPPER_MODULES.map((m, idx) => {
              const isDone = completed.includes(m.key);
              const isActive = plan?.nextAction.module === m.key;

              return (
                <button
                  key={m.key}
                  onClick={() => navigate(m.route)}
                  className="group relative flex items-start gap-4 text-left focus:outline-none lg:flex-col lg:items-center lg:text-center lg:gap-2 cursor-pointer"
                >
                  {/* Step Marker Indicator */}
                  <div
                    className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : isActive
                          ? "bg-brand-500 border-brand-500 text-white shadow-glow pulse-ring-active"
                          : "bg-surface border-line text-muted group-hover:border-brand-400 group-hover:text-ink"
                    }`}
                  >
                    {isDone ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="text-sm font-bold">{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Metadata */}
                  <div className="lg:w-28">
                    <div
                      className={`text-sm font-semibold transition-colors duration-200 ${
                        isActive ? "text-brand-500" : "text-ink group-hover:text-brand-500"
                      }`}
                    >
                      {m.label}
                    </div>
                    <div className="text-[11px] text-muted leading-tight mt-0.5">{m.desc}</div>
                    <div className="mt-1.5">
                      <span
                        className={`badge text-[10px] ${
                          isDone
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isActive
                              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                              : "bg-surface-2 text-muted"
                        }`}
                      >
                        {isDone ? "done" : isActive ? "current" : "open"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
