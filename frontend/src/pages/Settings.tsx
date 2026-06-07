// Settings — the small off-nav page. Holds account (sign in/out), the weekly-email
// opt-in, appearance, the privacy + delete-everything control (lifted verbatim from
// the old Mind page), and a quiet system-status readout.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type HealthMode } from "../api/client";
import { useProfile } from "../lib/profile";
import { getProfileId, clearStudent, clearAuth } from "../lib/progress";
import { PageHeading, Spinner, ErrorNote } from "../components/ui";
import AuthButton from "../components/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

export default function Settings() {
  const { profile, setField } = useProfile();
  const [mode, setMode] = useState<HealthMode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    api.health().then((h) => setMode(h.mode)).catch(() => setMode(null));
  }, []);

  // Delete-everything: erase the student's data + sign them out + reload to a
  // clean slate. This is the privacy-page promise; behaviour preserved verbatim.
  async function deleteEverything() {
    const sure = window.confirm(
      "This permanently deletes everything Yaar knows about you: your profile, chats, practice history, reports, and progress. It cannot be undone. Delete everything?"
    );
    if (!sure) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const pid = getProfileId();
      if (pid) await api.deleteProfile(pid);
      clearStudent();
      clearAuth();
      window.location.assign("/");
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeading title="Settings" />

      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Your account</h2>
        <div className="mt-3"><AuthButton /></div>
        <p className="mt-2 text-xs text-muted">Sign in to keep your journey on any phone or computer. Yaar works fine without an account too.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-ink">Weekly email</h2>
            <p className="mt-0.5 text-sm text-muted">A short, honest note from Yaar each week. Off unless you turn it on.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.emailOptIn === "yes"}
            onClick={() => setField({ emailOptIn: profile.emailOptIn === "yes" ? "no" : "yes" })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${profile.emailOptIn === "yes" ? "bg-brand-600" : "bg-surface-2"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${profile.emailOptIn === "yes" ? "left-6" : "left-1"}`} />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-ink">Appearance</h2>
            <p className="mt-0.5 text-sm text-muted">Light or dark.</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Privacy</h2>
        <p className="mt-1 text-sm text-muted">
          Yaar never sells your data and never shows ads. Read the full{" "}
          <Link to="/privacy" className="font-medium text-brand-500 hover:underline">privacy page</Link>.
        </p>
        {deleteError && <div className="mt-3"><ErrorNote onRetry={deleteEverything}>Couldn't delete just now. Try again.</ErrorNote></div>}
        <button
          className="btn-ghost mt-3 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          onClick={deleteEverything}
          disabled={deleting}
        >
          {deleting ? <Spinner label="Deleting everything..." /> : "Delete everything Yaar knows about me"}
        </button>
      </div>

      {mode && (
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">System</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            <SysRow label="AI" ok={mode.gemini === "live"} on="live" off="demo mode" />
            <SysRow label="School data" ok={mode.collegeScorecard === "live"} on="live" off="demo" />
            <div className="flex items-center justify-between">
              <span className="text-muted">Database</span>
              <span className="font-medium text-ink">{mode.db}</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-faint">
        Something broken? <Link to="/feedback" className="font-medium text-brand-500 hover:underline">Report it</Link>.
      </p>
    </div>
  );
}

function SysRow({ label, ok, on, off }: { label: string; ok: boolean; on: string; off: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        {ok ? on : off}
      </span>
    </div>
  );
}
