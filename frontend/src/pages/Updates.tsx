import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { InboxItem } from "../lib/types";
import { getProfileId } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

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
  const [logged, setLogged] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const res = await api.getInbox(profileId);
      setItems(res.items);
      res.items.filter((i) => !i.read).forEach((i) => void api.markInboxRead(i.id));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow() {
    if (!profileId) return;
    setRunning(true);
    try {
      await api.runDrop(profileId);
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function resolve(actionId: string, status: "done" | "skipped", title?: string) {
    setResolving(actionId);
    try {
      await api.resolveAction(actionId, status);
      await load();
      if (status === "done" && title) setLogged(title);
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
            {running ? <Spinner label="Thinking..." /> : "Run my updates now"}
          </button>
        }
      />

      {logged && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/10">
          <p className="text-sm text-ink">
            Nice work on "{logged}". Save it as evidence so Yaar can use it in your applications later.
          </p>
          <div className="flex gap-2">
            <Link className="btn-gold" to={`/app/evidence?title=${encodeURIComponent(logged)}`}>
              Log evidence
            </Link>
            <button className="btn-ghost" onClick={() => setLogged(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading && items.length === 0 && <Spinner label="Loading your updates..." />}

      {!loading && items.length === 0 && (
        <div className="card text-center text-muted">
          <div className="text-4xl">📭</div>
          <p className="mt-3">
            Nothing here yet. Hit <strong className="text-ink">Run my updates now</strong> and Yaar will dig up this week's best moves for you.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="card transition-shadow duration-200 hover:shadow-lift">
            <div className="mb-2 flex items-center justify-between">
              <span className={`badge capitalize ${KIND_STYLE[it.kind] ?? KIND_STYLE.nudge}`}>{it.kind}</span>
              <SourceBadge source={it.source} />
            </div>
            <h3 className="text-base font-semibold text-ink">{it.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{it.body}</p>
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
