import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { InboxItem } from "../lib/types";
import { getProfileId } from "../lib/progress";
import { Spinner, SourceBadge } from "../components/ui";

const KIND_STYLE: Record<string, string> = {
  opportunity: "bg-brand-100 text-brand-700",
  followup: "bg-amber-100 text-amber-700",
  celebration: "bg-emerald-100 text-emerald-700",
  nudge: "bg-slate-100 text-slate-600",
};

export default function Updates() {
  const profileId = getProfileId();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const res = await api.getInbox(profileId);
      setItems(res.items);
      // mark everything read so the nav badge clears
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

  async function resolve(actionId: string, status: "done" | "skipped") {
    setResolving(actionId);
    try {
      await api.resolveAction(actionId, status);
      await load();
    } finally {
      setResolving(null);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Your updates</h1>
        <div className="card">
          <p className="text-slate-600">
            Set up your profile first so your counselor knows you. Head to the{" "}
            <Link to="/app" className="font-medium text-brand-600 hover:underline">
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your updates</h1>
          <p className="mt-1 text-slate-600">
            Your counselor checks in here with personalized, unbiased next steps and follows up on what you said you would do.
          </p>
        </div>
        <button className="btn-primary" onClick={runNow} disabled={running}>
          {running ? <Spinner label="Thinking..." /> : "Run my updates now"}
        </button>
      </div>

      {loading && items.length === 0 && <Spinner label="Loading your updates..." />}

      {!loading && items.length === 0 && (
        <div className="card text-slate-600">
          No updates yet. Click <strong>Run my updates now</strong> and your counselor will find this week's best moves for you.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <span className={`badge ${KIND_STYLE[it.kind] ?? KIND_STYLE.nudge}`}>{it.kind}</span>
              <SourceBadge source={it.source} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{it.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{it.body}</p>
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
                    onClick={() => resolve(it.cta!.actionItemId!, "done")}
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
