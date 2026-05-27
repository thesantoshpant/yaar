import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { InboxItem } from "../lib/types";
import { getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading, ErrorNote } from "../components/ui";
import { SkeletonList } from "../components/Skeleton";
import Markdown from "../components/Markdown";

const KIND_EMOJI: Record<string, string> = {
  opportunity: "🎯",
  followup: "🔁",
  celebration: "🎉",
  nudge: "💡",
};

const KIND_STYLE: Record<string, string> = {
  opportunity: "bg-brand-500/12 text-brand-500",
  followup: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  celebration: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  nudge: "bg-surface-2 text-muted",
};

export default function Updates() {
  const profileId = getProfileId();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [logged, setLogged] = useState<{ title: string; actionId?: string } | null>(null);
  const [error, setError] = useState(false);
  const didAutoRun = useRef(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.getInbox(profileId);
      setItems(res.items);
      res.items.filter((i) => !i.read).forEach((i) => void api.markInboxRead(i.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the inbox fresh when the student comes back to the tab.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function runNow() {
    if (!profileId) return;
    setRunning(true);
    setError(false);
    try {
      await api.runDrop(profileId);
      await load();
    } catch {
      setError(true);
    } finally {
      setRunning(false);
    }
  }

  // First-timers shouldn't have to know to press a button: if the inbox is empty
  // after the first load, find their first moves automatically.
  useEffect(() => {
    if (!loading && !running && !error && items.length === 0 && !didAutoRun.current) {
      didAutoRun.current = true;
      void runNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, running, error, items.length]);

  async function resolve(actionId: string, status: "done" | "skipped", title?: string) {
    setResolving(actionId);
    try {
      await api.resolveAction(actionId, status);
      await load();
      if (status === "done" && title) setLogged({ title, actionId });
    } finally {
      setResolving(null);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="Your updates" />
        <div className="card">
          <p className="text-muted">
            Set up your profile first so your counselor knows you. Head to the{" "}
            <Link to="/app" className="font-medium text-brand-500 hover:underline">
              Dashboard
            </Link>{" "}
            and tell us about yourself.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Your updates 🔔"
        subtitle="Yaar drops your best moves for the week here and checks in on what you said you'd do. Like a friend who actually follows up."
        action={
          <button className="btn-primary" onClick={runNow} disabled={running}>
            {running ? <Spinner label="Finding your moves..." /> : "Refresh my moves"}
          </button>
        }
      />

      {error && <ErrorNote onRetry={load}>Yaar couldn't load your moves just now. Check your internet and try again.</ErrorNote>}

      {logged && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/10 shadow-glow">
          <p className="text-sm text-ink">
            Proud of you for "{logged.title}" 🌟 Let's lock it in. Saved here, it becomes part of your application.
          </p>
          <div className="flex gap-2">
            <Link
              className="btn-gold"
              to={`/app/evidence?title=${encodeURIComponent(logged.title)}${logged.actionId ? `&action=${encodeURIComponent(logged.actionId)}` : ""}`}
            >
              Log evidence
            </Link>
            <button className="btn-ghost" onClick={() => setLogged(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {(loading || running) && items.length === 0 && <SkeletonList count={3} lines={2} />}

      {!loading && !running && !error && items.length === 0 && (
        <div className="card flex flex-col items-center py-12 text-center text-muted">
          <div className="text-5xl">📭</div>
          <p className="mt-4 max-w-sm">
            Nothing here yet. Tap <strong className="text-ink">Refresh my moves</strong> and Yaar will dig up this week's best moves for you.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="card transition-shadow duration-200 hover:shadow-lift">
            <div className="mb-2 flex items-center justify-between">
              <span className={`badge gap-1.5 capitalize ${KIND_STYLE[it.kind] ?? KIND_STYLE.nudge}`}>
                <span aria-hidden="true">{KIND_EMOJI[it.kind] ?? KIND_EMOJI.nudge}</span>
                {it.kind}
              </span>
              <SourceBadge source={it.source} />
            </div>
            <h3 className="text-base font-semibold text-ink">{it.title}</h3>
            <Markdown className="mt-1 text-sm leading-relaxed text-muted">{it.body}</Markdown>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {it.cta?.url && (
                <a
                  href={it.cta.url.startsWith("http") ? it.cta.url : `https://${it.cta.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  Open link
                </a>
              )}
              {it.cta?.actionItemId && (
                <>
                  <button
                    className="btn-primary"
                    onClick={() => resolve(it.cta!.actionItemId!, "done", it.title)}
                    disabled={resolving === it.cta.actionItemId}
                  >
                    I did it
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => resolve(it.cta!.actionItemId!, "skipped")}
                    disabled={resolving === it.cta.actionItemId}
                  >
                    Not now
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
