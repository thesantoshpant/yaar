import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AgentPlan, ModuleKey, JourneyState } from "../lib/types";
import { clearStudent, getCompleted, getProfileId, setProfileId, setProfileSummary } from "../lib/progress";
import { Spinner, SourceBadge, ScoreBar, PageHeading } from "../components/ui";

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

const yn = (v: string): boolean | undefined => (v === "yes" ? true : v === "no" ? false : undefined);

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
  const [form, setForm] = useState({
    name: "",
    country: "Nepal",
    intendedLevel: "undergraduate",
    intendedMajor: "",
    budget: "",
    targetIntake: "Fall 2027",
    testStatus: "",
    gradeLevel: "11",
    isRural: "",
    firstGen: "",
    schoolHasCounselor: "",
    schoolHasClubs: "",
    familiarWithProcess: "",
  });
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<ModuleKey[]>([]);
  const [journey, setJourney] = useState<JourneyState | null>(null);

  useEffect(() => {
    setCompleted(getCompleted());
    const pid = getProfileId();
    if (pid) {
      api.getJourney(pid)
        .then((res) => setJourney(res.journey))
        .catch(() => {});
      // Also get an initial agent plan if possible
      api.agentPlan(summary(), getCompleted(), pid)
        .then((res) => {
          setPlan(res.plan);
          setSource(res.source);
        })
        .catch(() => {});
    }
  }, []);

  function summary(): string {
    return `name=${form.name || "student"}, country=${form.country}, level=${form.intendedLevel}, major=${
      form.intendedMajor || "undecided"
    }, budget/yr=${form.budget || "unknown"}, intake=${form.targetIntake}, tests=${form.testStatus || "not started"}, grade=${
      form.gradeLevel
    }, rural=${form.isRural || "?"}, firstGen=${form.firstGen || "?"}, counselor=${form.schoolHasCounselor || "?"}, clubs=${
      form.schoolHasClubs || "?"
    }`;
  }

  function profilePayload(): Record<string, unknown> {
    return {
      name: form.name || "Student",
      country: form.country,
      intendedLevel: form.intendedLevel,
      intendedMajor: form.intendedMajor || undefined,
      budgetUsdPerYear: form.budget ? Number(form.budget) : undefined,
      targetIntake: form.targetIntake || undefined,
      testStatus: form.testStatus || undefined,
      gradeLevel: form.gradeLevel || undefined,
      isRural: yn(form.isRural),
      firstGen: yn(form.firstGen),
      schoolHasCounselor: yn(form.schoolHasCounselor),
      schoolHasClubs: yn(form.schoolHasClubs),
      familiarWithProcess: yn(form.familiarWithProcess),
    };
  }

  async function ensureProfileId(): Promise<string | undefined> {
    const existing = getProfileId();
    const payload = profilePayload();
    if (existing) {
      await api.updateProfile(existing, payload).catch(() => {});
      return existing;
    }
    try {
      const res = await api.createProfile(payload);
      setProfileId(res.profile.id);
      void api.runDrop(res.profile.id);
      return res.profile.id;
    } catch {
      return undefined;
    }
  }

  async function planNext() {
    setLoading(true);
    setProfileSummary(summary());
    try {
      const profileId = await ensureProfileId();
      const res = await api.agentPlan(summary(), getCompleted(), profileId);
      setPlan(res.plan);
      setSource(res.source);

      // Fetch the updated journey state (which includes classified persona tags)
      if (profileId) {
        const jRes = await api.getJourney(profileId).catch(() => null);
        if (jRes) setJourney(jRes.journey);
      }
    } catch {
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Hey 👋 let's plan your move"
        subtitle="Tell Yaar a bit about you. It figures out your single best next step and starts sending personalized nudges — working for you, with zero bias."
        action={
          getProfileId() && (
            <button
              className="btn-ghost"
              onClick={() => {
                clearStudent();
                setPlan(null);
                setCompleted([]);
                setJourney(null);
              }}
            >
              New student
            </button>
          )
        }
      />

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-ink">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
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
            <label className="label">Grade level</label>
            <select className="input" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
              <option value="gap">Gap year</option>
              <option value="bachelors">In bachelor's</option>
            </select>
          </div>
          <div>
            <label className="label">Intended major</label>
            <input className="input" placeholder="e.g. Computer Science" value={form.intendedMajor} onChange={(e) => setForm({ ...form, intendedMajor: e.target.value })} />
          </div>
          <div>
            <label className="label">Budget per year (USD)</label>
            <input className="input" placeholder="e.g. 30000" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div>
            <label className="label">Target intake</label>
            <input className="input" value={form.targetIntake} onChange={(e) => setForm({ ...form, targetIntake: e.target.value })} />
          </div>
          <div>
            <label className="label">Test status</label>
            <input className="input" placeholder="e.g. IELTS not taken" value={form.testStatus} onChange={(e) => setForm({ ...form, testStatus: e.target.value })} />
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-faint">Your situation</h3>
        <p className="mb-3 text-sm text-muted">
          This is how Yaar tailors your journey. A rural, first-generation student gets a very different plan from a well-resourced one.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <YesNo label="Live in a rural area?" value={form.isRural} onChange={(v) => setForm({ ...form, isRural: v })} />
          <YesNo label="First in family to study abroad?" value={form.firstGen} onChange={(v) => setForm({ ...form, firstGen: v })} />
          <YesNo label="School has a counselor?" value={form.schoolHasCounselor} onChange={(v) => setForm({ ...form, schoolHasCounselor: v })} />
          <YesNo label="School has clubs?" value={form.schoolHasClubs} onChange={(v) => setForm({ ...form, schoolHasClubs: v })} />
          <YesNo label="Family knows the US process?" value={form.familiarWithProcess} onChange={(v) => setForm({ ...form, familiarWithProcess: v })} />
        </div>

        <button className="btn-primary mt-5" onClick={planNext} disabled={loading}>
          {loading ? <Spinner label="Thinking..." /> : "Plan my next step"}
        </button>
      </div>

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
              <span className="badge bg-brand-500/15 text-brand-500">{MODULE_LABEL[plan.nextAction.module]}</span>
              <h3 className="mt-2 font-display text-xl font-bold text-ink">{plan.nextAction.title}</h3>
              <p className="mt-1 text-muted">{plan.nextAction.why}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => navigate(MODULE_ROUTE[plan.nextAction.module])}>
                  Let's do it 🚀
                </button>
                <button className="btn-ghost" onClick={() => navigate("/app/updates")}>
                  See my updates
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm italic text-muted">{plan.encouragement}</p>
          </div>
        </div>
      )}

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
