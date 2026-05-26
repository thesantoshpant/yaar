import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeading, Spinner, SourceBadge, ErrorNote } from "../components/ui";
import { getProfileId } from "../lib/progress";
import { api } from "../api/client";

type Fact = { key: string; type: string; value: string; confidence: number; source: string };
type Memory = { brief: string | null; facts: Fact[] };

// The set of fact types we surface, in display order. Each maps to a friendly
// section label and a colored badge built from the existing design tokens.
const TYPE_META: { type: string; label: string; emoji: string; badge: string }[] = [
  { type: "profile", label: "About you", emoji: "👤", badge: "bg-brand-500/12 text-brand-500" },
  { type: "goal", label: "Your goals", emoji: "🎯", badge: "bg-violet-500/12 text-violet-500" },
  { type: "constraint", label: "Constraints", emoji: "⛓️", badge: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  { type: "skill", label: "Skills & strengths", emoji: "✨", badge: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  { type: "context", label: "Context", emoji: "🧩", badge: "bg-gold-300/15 text-gold-500" },
  { type: "preference", label: "Preferences", emoji: "💡", badge: "bg-brand-500/12 text-brand-500" },
  { type: "sensitive", label: "Sensitive", emoji: "🔒", badge: "bg-rose-500/12 text-rose-600 dark:text-rose-400" },
];

export default function Memory() {
  const profileId = getProfileId();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setLoadError(false);
    try {
      setMemory(await api.getMemory(profileId));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    if (!profileId) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      await api.consolidateMemory(profileId);
      setMemory(await api.getMemory(profileId));
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="What Yaar remembers 🧠" />
        <div className="card text-muted">
          Set up your profile first on the{" "}
          <Link to="/app" className="font-medium text-brand-500 hover:underline">Dashboard</Link>, then Yaar will start
          building a mind about you.
        </div>
      </div>
    );
  }

  // Drop internal bookkeeping facts (keys namespaced under "mind."), then group by type.
  const facts = (memory?.facts ?? []).filter((f) => !f.key.startsWith("mind."));
  const grouped = TYPE_META.map((meta) => ({
    ...meta,
    items: facts.filter((f) => f.type === meta.type),
  })).filter((g) => g.items.length > 0);
  const hasFacts = facts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeading
        title="What Yaar remembers 🧠"
        subtitle="This is the memory Yaar builds about you from your chats, profile, evidence, and documents. The more you use Yaar, the sharper it gets."
        action={
          <button className="btn-primary" onClick={refresh} disabled={refreshing || loading}>
            {refreshing ? <Spinner label="Thinking it through..." /> : "Refresh my mind"}
          </button>
        }
      />

      {refreshError && <ErrorNote onRetry={refresh}>Yaar couldn't re-synthesize right now. Try again in a moment.</ErrorNote>}

      {loading ? (
        <div className="card">
          <Spinner label="Loading your mind..." />
        </div>
      ) : loadError ? (
        <ErrorNote onRetry={load} />
      ) : (
        <>
          {/* Brief — the headline story Yaar has synthesized about this student. */}
          <div className="card relative overflow-hidden rounded-xl border-brand-500/20 bg-brand-500/5">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.10)_0,transparent_60%)]" />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Your story so far</h2>
                {memory?.brief && <SourceBadge source="gemini" />}
              </div>
              {memory?.brief ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{memory.brief}</p>
              ) : (
                <p className="text-sm text-muted">
                  Yaar hasn't written your story yet. Tap{" "}
                  <span className="font-medium text-ink">Refresh my mind</span> and it'll synthesize one from everything
                  it knows.
                </p>
              )}
            </div>
          </div>

          {/* Structured facts, grouped by type. */}
          {hasFacts ? (
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.type} className="card">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`badge ${g.badge}`}>
                      {g.emoji} {g.label}
                    </span>
                    <span className="text-xs text-faint">
                      {g.items.length} {g.items.length === 1 ? "thing" : "things"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((f) => (
                      <span key={f.key} className="chip">
                        {f.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-muted">
              Nothing in Yaar's mind yet. As you chat, fill in your profile, and log evidence, Yaar will remember the
              important details here.
            </div>
          )}
        </>
      )}
    </div>
  );
}
