import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { EvidenceArtifact } from "../lib/types";
import { getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-muted">{children}</label>;
}

export default function Evidence() {
  const profileId = getProfileId();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ title: "", whatYouDid: "", whoBenefited: "", proofUrl: "", skills: "", reflection: "" });
  const [items, setItems] = useState<EvidenceArtifact[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ activityLines: string[]; essayParagraph: string; source: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  // Prefill from a completed action (e.g. arriving from "I did it" on Updates).
  useEffect(() => {
    const t = params.get("title");
    if (t) setForm((f) => ({ ...f, title: t, whatYouDid: t }));
  }, [params]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const res = await api.listEvidence(profileId);
    setItems(res.evidence);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!profileId || !form.title.trim() || !form.whatYouDid.trim()) return;
    setSaving(true);
    try {
      await api.addEvidence({
        profileId,
        title: form.title,
        whatYouDid: form.whatYouDid,
        whoBenefited: form.whoBenefited || undefined,
        proofUrl: form.proofUrl || undefined,
        skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        reflection: form.reflection || undefined,
      });
      setForm({ title: "", whatYouDid: "", whoBenefited: "", proofUrl: "", skills: "", reflection: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function summarize() {
    if (!profileId) return;
    setSummarizing(true);
    try {
      setSummary(await api.summarizeEvidence(profileId));
    } finally {
      setSummarizing(false);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="Evidence vault 🏆" />
        <div className="card text-muted">
          Set up your profile first on the{" "}
          <Link to="/app" className="font-medium text-brand-500 hover:underline">Dashboard</Link>, then come log what you do.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Evidence vault 🏆"
        subtitle="Log everything you do, while it's fresh. By senior year, Yaar turns it into your application: activity lines and essay material, automatically."
        action={
          items.length > 0 ? (
            <button className="btn-gold" onClick={summarize} disabled={summarizing}>
              {summarizing ? <Spinner label="Building..." /> : "Build application material"}
            </button>
          ) : undefined
        }
      />

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">Log something you did</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>What was it?</Label>
            <input className="input" placeholder="Weekend coding class" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Who benefited? (optional)</Label>
            <input className="input" placeholder="6 kids in my neighbourhood" value={form.whoBenefited} onChange={(e) => setForm({ ...form, whoBenefited: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <Label>What did you actually do?</Label>
          <textarea className="input min-h-[80px]" placeholder="Taught Scratch every Saturday for 8 weeks..." value={form.whatYouDid} onChange={(e) => setForm({ ...form, whatYouDid: e.target.value })} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Proof link (optional)</Label>
            <input className="input" placeholder="github.com/..., a photo, a post" value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} />
          </div>
          <div>
            <Label>Skills shown (comma separated)</Label>
            <input className="input" placeholder="leadership, teaching" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <Label>Reflection (optional)</Label>
          <input className="input" placeholder="What did it teach you?" value={form.reflection} onChange={(e) => setForm({ ...form, reflection: e.target.value })} />
        </div>
        <button className="btn-primary mt-4" onClick={add} disabled={saving || !form.title.trim() || !form.whatYouDid.trim()}>
          {saving ? <Spinner label="Saving..." /> : "Add to my vault"}
        </button>
      </div>

      {summary && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your application material</h2>
            <SourceBadge source={summary.source} />
          </div>
          <h4 className="text-sm font-semibold text-ink">Common App activity lines</h4>
          <ul className="mt-1 list-inside list-disc text-sm text-muted">{summary.activityLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <h4 className="mt-3 text-sm font-semibold text-ink">Essay-ready paragraph</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{summary.essayParagraph}</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="card">
            <h3 className="font-semibold text-ink">{it.title}</h3>
            <p className="mt-1 text-sm text-muted">{it.whatYouDid}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {it.skills.map((s) => (
                <span key={s} className="badge bg-brand-500/12 text-brand-500">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
