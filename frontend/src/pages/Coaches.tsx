import { useState } from "react";
import { api } from "../api/client";
import { getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

type Tab = "recommender" | "funding" | "milestones" | "f1";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "recommender", label: "Recommender", emoji: "✉️" },
  { id: "funding", label: "Family & funding", emoji: "💰" },
  { id: "milestones", label: "Grade 9-12 plan", emoji: "🪜" },
  { id: "f1", label: "F-1 status", emoji: "🛂" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-muted">{children}</label>;
}

function Recommender() {
  const [role, setRole] = useState("");
  const [achievements, setAchievements] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.coachRecommender>> | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      setRes(await api.coachRecommender({ profileId: getProfileId() || undefined, recommenderRole: role || undefined, achievements: achievements || undefined }));
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
          <input className="input" placeholder="e.g. my math teacher" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <Label>Things they could mention (optional)</Label>
          <input className="input" placeholder="a project, an achievement..." value={achievements} onChange={(e) => setAchievements(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={run} disabled={loading}>
        {loading ? <Spinner label="Writing..." /> : "Build my recommender pack"}
      </button>
      {res && (
        <div className="mt-5 space-y-4">
          <SourceBadge source={res.source} />
          <div>
            <h4 className="text-sm font-semibold text-ink">Request message</h4>
            <p className="mt-1 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-muted">{res.requestMessage}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Brag sheet</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.bragSheet.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Project summary</h4>
            <p className="mt-1 text-sm text-muted">{res.projectSummary}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Logistics to share</h4>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">{res.logistics.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Funding() {
  const [i20, setI20] = useState("");
  const [funds, setFunds] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.coachFunding>> | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      setRes(
        await api.coachFunding({
          profileId: getProfileId() || undefined,
          i20CostUsd: i20 ? Number(i20) : undefined,
          fundsUsd: funds ? Number(funds) : undefined,
          sponsor: sponsor || undefined,
        })
      );
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
          <input className="input" placeholder="52000" value={i20} onChange={(e) => setI20(e.target.value)} />
        </div>
        <div>
          <Label>Funds you can show (USD)</Label>
          <input className="input" placeholder="20000" value={funds} onChange={(e) => setFunds(e.target.value)} />
        </div>
        <div>
          <Label>Sponsor</Label>
          <input className="input" placeholder="father, farmer" value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={run} disabled={loading}>
        {loading ? <Spinner label="Analyzing..." /> : "Coach my funding story"}
      </button>
      {res && (
        <div className="mt-5 space-y-3 text-sm">
          <SourceBadge source={res.source} />
          {res.gapUsd != null && (
            <p className={`rounded-xl border p-3 ${res.gapUsd > 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>
              Funding gap: ${res.gapUsd.toLocaleString()}
            </p>
          )}
          <P title="Cost" body={res.costExplanation} />
          <P title="Sponsor story" body={res.sponsorStory} />
          <P title="Gap analysis" body={res.gapAnalysis} />
          <div>
            <h4 className="font-semibold text-ink">How to close it</h4>
            <ul className="mt-1 list-inside list-disc text-muted">{res.howToClose.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
          <P title="Explain it to your parents" body={res.parentExplainer} />
        </div>
      )}
    </div>
  );
}

function Milestones() {
  const [grade, setGrade] = useState("9");
  const [major, setMajor] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.coachMilestones>> | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      setRes(await api.coachMilestones({ profileId: getProfileId() || undefined, gradeLevel: grade, intendedMajor: major || undefined }));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <p className="text-sm text-muted">A term-by-term plan from your grade through grade 12, with provable milestones a parent can see.</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <Label>Current grade</Label>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {["9", "10", "11", "12"].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label>Intended major</Label>
          <input className="input" placeholder="e.g. Computer Science" value={major} onChange={(e) => setMajor(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? <Spinner label="Planning..." /> : "Build my plan"}
        </button>
      </div>
      {res && (
        <div className="mt-5 space-y-3">
          <SourceBadge source={res.source} />
          <p className="text-sm text-muted">{res.overview}</p>
          {res.terms.map((t, i) => (
            <div key={i} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-ink">{t.term}</h4>
                <span className="badge bg-brand-500/12 text-brand-500">{t.focus}</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {t.milestones.map((m, j) => (
                  <li key={j} className="text-muted">
                    <span className="font-medium text-ink">{m.area}:</span> {m.action} <span className="text-faint">(proof: {m.proof})</span>
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

function F1() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.coachF1>> | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      setRes(await api.coachF1({ profileId: getProfileId() || undefined, question: q }));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <p className="text-sm text-muted">Plain answers on keeping your F-1 status. Always informational, never legal advice.</p>
      <div className="mt-4 flex gap-2">
        <input className="input" placeholder="e.g. Can I work off campus in my first semester?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button className="btn-primary shrink-0" onClick={run} disabled={loading || !q.trim()}>
          {loading ? <Spinner /> : "Ask"}
        </button>
      </div>
      {res && (
        <div className="mt-5 space-y-3 text-sm">
          <SourceBadge source={res.source} />
          <p className="text-muted">{res.answer}</p>
          <div>
            <h4 className="font-semibold text-ink">Must do</h4>
            <ul className="mt-1 list-inside list-disc text-muted">{res.mustDo.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-200">{res.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function P({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="font-semibold text-ink">{title}</h4>
      <p className="mt-1 text-muted">{body}</p>
    </div>
  );
}

export default function Coaches() {
  const [tab, setTab] = useState<Tab>("recommender");
  return (
    <div className="space-y-6">
      <PageHeading
        title="Coaches 🧑‍🏫"
        subtitle="Specialist help for the hard parts: recommendation letters, family finances, your long-game plan, and staying legal on F-1."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-gradient-to-r from-brand-600 to-violet-500 text-white shadow-sm" : "border border-line text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <span className="mr-1.5">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "recommender" && <Recommender />}
      {tab === "funding" && <Funding />}
      {tab === "milestones" && <Milestones />}
      {tab === "f1" && <F1 />}
    </div>
  );
}
