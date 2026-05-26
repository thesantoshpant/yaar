import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { EvidenceArtifact } from "../lib/types";
import { getProfileId } from "../lib/progress";
import { useAuthGate } from "../lib/authGate";
import { Spinner, SourceBadge, PageHeading, ErrorNote, CopyButton } from "../components/ui";
import Markdown from "../components/Markdown";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>;
}

export default function Evidence() {
  const profileId = getProfileId();
  const { gate } = useAuthGate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ title: "", whatYouDid: "", whoBenefited: "", proofUrl: "", skills: "", reflection: "" });
  const [items, setItems] = useState<EvidenceArtifact[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ activityLines: string[]; essayParagraph: string; source: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [addError, setAddError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

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
    setAddError(false);
    try {
      // When we arrive from Updates with ?action=<id>, link this evidence to that
      // action item so the backend closes the gap and the loop completes.
      const actionId = params.get("action");
      await api.addEvidence({
        profileId,
        title: form.title,
        whatYouDid: form.whatYouDid,
        whoBenefited: form.whoBenefited || undefined,
        proofUrl: form.proofUrl || undefined,
        skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        reflection: form.reflection || undefined,
        linkedActionItemId: actionId || undefined,
      });
      setForm({ title: "", whatYouDid: "", whoBenefited: "", proofUrl: "", skills: "", reflection: "" });
      await load();
    } catch {
      setAddError(true);
    } finally {
      setSaving(false);
    }
  }

  async function summarize() {
    if (!profileId) return;
    setSummarizing(true);
    setSummaryError(false);
    try {
      setSummary(await api.summarizeEvidence(profileId));
    } catch {
      setSummaryError(true);
    } finally {
      setSummarizing(false);
    }
  }

  const distinctSkills = Array.from(new Set(items.flatMap((it) => it.skills)));

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

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card flex items-center gap-3 py-4">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xl font-bold text-ink">{items.length}</div>
              <div className="text-xs text-muted">logged</div>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-4">
            <span className="text-2xl">✨</span>
            <div>
              <div className="text-xl font-bold text-ink">{distinctSkills.length}</div>
              <div className="text-xs text-muted">{distinctSkills.length === 1 ? "skill" : "skills"} shown</div>
            </div>
          </div>
          <div className="card flex items-center py-4 text-sm text-muted">
            Keep going. Every one is proof for your future application.
          </div>
        </div>
      )}

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
        {addError && <ErrorNote onRetry={add} />}
        <button className="btn-primary mt-4" onClick={() => gate("evidence", () => add())} disabled={saving || !form.title.trim() || !form.whatYouDid.trim()}>
          {saving ? <Spinner label="Saving..." /> : "Add to my vault"}
        </button>
      </div>

      {summaryError && <ErrorNote onRetry={summarize} />}

      {summary && (
        <div className="card rounded-xl border-brand-500/20 bg-brand-500/5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your application material</h2>
            <div className="flex items-center gap-2">
              <SourceBadge source={summary.source} />
              <CopyButton
                text={`Common App activity lines:\n${summary.activityLines.map((l) => `- ${l}`).join("\n")}\n\nEssay-ready paragraph:\n${summary.essayParagraph}`}
                label="Copy all"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">Common App activity lines</h4>
            <CopyButton text={summary.activityLines.map((l) => `- ${l}`).join("\n")} label="Copy lines" />
          </div>
          <ul className="mt-1 list-inside list-disc text-sm text-muted">{summary.activityLines.map((l, i) => <li key={i}><Markdown inline>{l}</Markdown></li>)}</ul>
          <div className="mt-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">Essay-ready paragraph</h4>
            <CopyButton text={summary.essayParagraph} label="Copy paragraph" />
          </div>
          <Markdown className="mt-1 text-sm text-muted">{summary.essayParagraph}</Markdown>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.id} className="card transition-shadow duration-200 hover:shadow-lift">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-ink">{it.title}</h3>
              {it.whoBenefited && (
                <span className="badge shrink-0 bg-gold-300/15 text-gold-500">👥 {it.whoBenefited}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">{it.whatYouDid}</p>
            {it.reflection && <p className="mt-1.5 text-sm italic text-faint">“{it.reflection}”</p>}
            {(it.skills.length > 0 || it.proofUrl) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {it.skills.map((s) => (
                  <span key={s} className="badge bg-brand-500/12 text-brand-500">{s}</span>
                ))}
                {it.proofUrl && (
                  <a
                    href={it.proofUrl.startsWith("http") ? it.proofUrl : `https://${it.proofUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="badge bg-surface-2 text-muted transition hover:text-ink"
                  >
                    🔗 proof
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
