import { useState } from "react";
import { api } from "../api/client";
import { getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { Spinner, SourceBadge, PageHeading, ErrorNote, CopyButton } from "../components/ui";
import Markdown from "../components/Markdown";

type Tab = "recommender" | "funding" | "milestones" | "f1";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "recommender", label: "Recommender", emoji: "✉️" },
  { id: "funding", label: "Family & funding", emoji: "💰" },
  { id: "milestones", label: "Grade 9-12 plan", emoji: "🪜" },
  { id: "f1", label: "F-1 status", emoji: "🛂" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>;
}

// A premium AI-output block: titled, with the AI free text rendered as markdown.
function ResultBlock({ title, body, copy }: { title: string; body: string; copy?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {copy && <CopyButton text={body} />}
      </div>
      <Markdown className="mt-1 text-sm text-muted">{body}</Markdown>
    </div>
  );
}

type RecommenderRes = Awaited<ReturnType<typeof api.coachRecommender>>;
type FundingRes = Awaited<ReturnType<typeof api.coachFunding>>;
type MilestonesRes = Awaited<ReturnType<typeof api.coachMilestones>>;
type F1Res = Awaited<ReturnType<typeof api.coachF1>>;

// All per-tab state lives in the parent so switching tabs never destroys
// a student's inputs or generated result.
type CoachState = {
  recommender: { role: string; achievements: string; res: RecommenderRes | null };
  funding: { i20: string; funds: string; sponsor: string; res: FundingRes | null };
  milestones: { res: MilestonesRes | null };
  f1: { q: string; res: F1Res | null };
};

type RecommenderProps = {
  state: CoachState["recommender"];
  setState: (s: CoachState["recommender"]) => void;
};

function Recommender({ state, setState }: RecommenderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { role, achievements, res } = state;
  async function run() {
    setLoading(true);
    setError(false);
    try {
      const r = await api.coachRecommender({ profileId: getProfileId() || undefined, recommenderRole: role || undefined, achievements: achievements || undefined });
      setState({ ...state, res: r });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <p className="text-sm text-muted">Get a polite request message, a brag sheet, and everything your teacher needs to write you a strong US letter.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Recommender (role)</Label>
          <input className="input" placeholder="e.g. my math teacher" value={role} onChange={(e) => setState({ ...state, role: e.target.value })} />
        </div>
        <div>
          <Label>Things they could mention (optional)</Label>
          <input className="input" placeholder="a project, an achievement..." value={achievements} onChange={(e) => setState({ ...state, achievements: e.target.value })} />
        </div>
      </div>
      {error && <ErrorNote onRetry={run} />}
      <button className="btn-primary mt-4" onClick={run} disabled={loading}>
        {loading ? <Spinner label="Writing..." /> : "Build my recommender pack"}
      </button>
      {res && (
        <div className="mt-5 space-y-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <SourceBadge source={res.source} />
          <ResultBlock title="Request message" body={res.requestMessage} copy />
          <div>
            <h4 className="text-sm font-semibold text-ink">Brag sheet</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.bragSheet.map((b, i) => <li key={i}><Markdown inline>{b}</Markdown></li>)}</ul>
          </div>
          <ResultBlock title="Project summary" body={res.projectSummary} copy />
          <div>
            <h4 className="text-sm font-semibold text-ink">Logistics to share</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.logistics.map((b, i) => <li key={i}><Markdown inline>{b}</Markdown></li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

type FundingProps = {
  state: CoachState["funding"];
  setState: (s: CoachState["funding"]) => void;
};

function Funding({ state, setState }: FundingProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { i20, funds, sponsor, res } = state;
  async function run() {
    setLoading(true);
    setError(false);
    try {
      const r = await api.coachFunding({
        profileId: getProfileId() || undefined,
        i20CostUsd: i20 ? Number(i20) : undefined,
        fundsUsd: funds ? Number(funds) : undefined,
        sponsor: sponsor || undefined,
      });
      setState({ ...state, res: r });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <p className="text-sm text-muted">Understand the real cost, build a believable sponsor story, and see your funding gap honestly. Information, not financial advice.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <Label>I-20 cost / year (USD)</Label>
          <input className="input" placeholder="52000" value={i20} onChange={(e) => setState({ ...state, i20: e.target.value })} />
          <p className="mt-1 text-xs text-faint">Don't have your I-20 yet? Use a rough school cost. Many run $25k to $55k a year.</p>
        </div>
        <div>
          <Label>Funds you can show (USD)</Label>
          <input className="input" placeholder="20000" value={funds} onChange={(e) => setState({ ...state, funds: e.target.value })} />
        </div>
        <div>
          <Label>Sponsor</Label>
          <input className="input" placeholder="father, farmer" value={sponsor} onChange={(e) => setState({ ...state, sponsor: e.target.value })} />
        </div>
      </div>
      {error && <ErrorNote onRetry={run} />}
      <button className="btn-primary mt-4" onClick={run} disabled={loading}>
        {loading ? <Spinner label="Analyzing..." /> : "Coach my funding story"}
      </button>
      {res && (
        <div className="mt-5 space-y-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
          <SourceBadge source={res.source} />
          {res.gapUsd != null && (
            <p className={`rounded-xl border p-3 font-medium ${res.gapUsd > 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>
              Funding gap: ${res.gapUsd.toLocaleString()}
            </p>
          )}
          <ResultBlock title="Cost" body={res.costExplanation} />
          <ResultBlock title="Sponsor story" body={res.sponsorStory} copy />
          <ResultBlock title="Gap analysis" body={res.gapAnalysis} />
          <div>
            <h4 className="text-sm font-semibold text-ink">How to close it</h4>
            <ul className="mt-1 list-inside list-disc text-muted">{res.howToClose.map((b, i) => <li key={i}><Markdown inline>{b}</Markdown></li>)}</ul>
          </div>
          <ResultBlock title="Explain it to your parents" body={res.parentExplainer} copy />
        </div>
      )}
    </div>
  );
}

type MilestonesProps = {
  state: CoachState["milestones"];
  setState: (s: CoachState["milestones"]) => void;
};

function Milestones({ state, setState }: MilestonesProps) {
  const { profile, setField, saveNow } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { res } = state;
  // The plan covers grade 9-12, so use the profile grade when it's one of those.
  const grade = ["9", "10", "11", "12"].includes(profile.gradeLevel) ? profile.gradeLevel : "9";
  async function run() {
    setLoading(true);
    setError(false);
    try {
      await saveNow();
      const r = await api.coachMilestones({
        profileId: getProfileId() || undefined,
        gradeLevel: grade,
        intendedMajor: profile.intendedMajor || undefined,
      });
      setState({ ...state, res: r });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  const planText = res
    ? [
        res.overview,
        ...res.terms.map(
          (t) => `\n${t.term} — ${t.focus}\n` + t.milestones.map((m) => `- ${m.area}: ${m.action} (proof: ${m.proof})`).join("\n")
        ),
      ].join("\n")
    : "";
  return (
    <div className="card">
      <p className="text-sm text-muted">A term-by-term plan from your grade through grade 12, with provable milestones a parent can see.</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <Label>Current grade</Label>
          <select className="input" value={grade} onChange={(e) => setField({ gradeLevel: e.target.value })}>
            {["9", "10", "11", "12"].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label>Intended major</Label>
          <input className="input" placeholder="e.g. Computer Science" value={profile.intendedMajor} onChange={(e) => setField({ intendedMajor: e.target.value })} />
        </div>
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? <Spinner label="Planning..." /> : "Build my plan"}
        </button>
      </div>
      <p className="mt-2 text-xs text-faint">Pulled from your profile, and saved back to it — change it once, it's remembered everywhere.</p>
      {error && <ErrorNote onRetry={run} />}
      {res && (
        <div className="mt-5 space-y-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="flex items-center justify-between">
            <SourceBadge source={res.source} />
            <CopyButton text={planText} label="Copy plan" />
          </div>
          <Markdown className="text-sm text-muted">{res.overview}</Markdown>
          {res.terms.map((t, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-ink">{t.term}</h4>
                <span className="badge bg-brand-500/12 text-brand-500">{t.focus}</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {t.milestones.map((m, j) => (
                  <li key={j} className="text-muted">
                    <span className="font-medium text-ink">{m.area}:</span> <Markdown inline>{m.action}</Markdown> <span className="text-faint">(proof: <Markdown inline>{m.proof}</Markdown>)</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type F1Props = {
  state: CoachState["f1"];
  setState: (s: CoachState["f1"]) => void;
};

function F1({ state, setState }: F1Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { q, res } = state;
  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const r = await api.coachF1({ profileId: getProfileId() || undefined, question: q });
      setState({ ...state, res: r });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <p className="text-sm text-muted">Plain answers on keeping your F-1 status. Always informational, never legal advice.</p>
      <div className="mt-4 flex gap-2">
        <input className="input" placeholder="e.g. Can I work off campus in my first semester?" value={q} onChange={(e) => setState({ ...state, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button className="btn-primary shrink-0" onClick={run} disabled={loading || !q.trim()}>
          {loading ? <Spinner /> : "Ask"}
        </button>
      </div>
      {error && <ErrorNote onRetry={run} />}
      {res && (
        <div className="mt-5 space-y-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
          <div className="flex items-center justify-between">
            <SourceBadge source={res.source} />
            <CopyButton text={res.answer} />
          </div>
          <Markdown className="text-muted">{res.answer}</Markdown>
          <div>
            <h4 className="font-semibold text-ink">Must do</h4>
            <ul className="mt-1 list-inside list-disc text-muted">{res.mustDo.map((b, i) => <li key={i}><Markdown inline>{b}</Markdown></li>)}</ul>
          </div>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-200">{res.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

export default function Coaches() {
  const [tab, setTab] = useState<Tab>("recommender");
  const [recommender, setRecommender] = useState<CoachState["recommender"]>({ role: "", achievements: "", res: null });
  const [funding, setFunding] = useState<CoachState["funding"]>({ i20: "", funds: "", sponsor: "", res: null });
  const [milestones, setMilestones] = useState<CoachState["milestones"]>({ res: null });
  const [f1, setF1] = useState<CoachState["f1"]>({ q: "", res: null });
  return (
    <div className="space-y-6">
      <PageHeading
        title="Coaches 🧑‍🏫"
        subtitle="Specialist help for the hard parts: recommendation letters, family finances, your long-game plan, and staying legal on F-1."
      />
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface-2/40 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-gradient-to-r from-brand-600 to-violet-500 text-white shadow-glow" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <span className="mr-1.5">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "recommender" && <Recommender state={recommender} setState={setRecommender} />}
      {tab === "funding" && <Funding state={funding} setState={setFunding} />}
      {tab === "milestones" && <Milestones state={milestones} setState={setMilestones} />}
      {tab === "f1" && <F1 state={f1} setState={setF1} />}
    </div>
  );
}
