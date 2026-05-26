import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AgentPlan, ModuleKey } from "../lib/types";
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

const ALL_MODULES: ModuleKey[] = ["roadmap", "test_prep", "school_search", "applications", "finances", "visa"];

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

  useEffect(() => {
    setCompleted(getCompleted());
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

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-ink">Your journey</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_MODULES.map((m) => {
            const done = completed.includes(m);
            return (
              <button
                key={m}
                onClick={() => navigate(MODULE_ROUTE[m])}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-surface-2 cursor-pointer"
              >
                <span className="font-medium text-ink">{MODULE_LABEL[m]}</span>
                <span className={`inline-flex items-center gap-1.5 text-sm ${done ? "text-emerald-500" : "text-faint"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-faint"}`} />
                  {done ? "done" : "open"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
