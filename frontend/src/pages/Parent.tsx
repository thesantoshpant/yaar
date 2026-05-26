import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type ParentReport } from "../api/client";
import { getProfileId } from "../lib/progress";
import { PageHeading, Spinner, SourceBadge, ErrorNote, CopyButton } from "../components/ui";
import ParentReportView from "../components/ParentReportView";

const LANGUAGES = ["English", "Nepali", "Hindi", "Bengali", "Urdu", "Nepali (Romanized)"];

export default function Parent() {
  const profileId = getProfileId();
  const [language, setLanguage] = useState("English");
  const [report, setReport] = useState<ParentReport | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function generate() {
    if (!profileId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.generateParentReport(profileId, language);
      setReport(res.report);
      setShareUrl(res.shareUrl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="An update for your parents 👪" />
        <div className="card text-muted">
          Set up your profile first on the{" "}
          <Link to="/app" className="font-medium text-brand-500 hover:underline">Dashboard</Link>, then Yaar can write an update your family will understand.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="An update for your parents 👪"
        subtitle="Yaar writes a warm, honest update about your journey that your family can actually follow, in their language. Share it with one link, no login needed."
        action={report ? <SourceBadge source={report.source} /> : undefined}
      />

      <div className="card">
        <label className="label" htmlFor="parent-lang">Write it in</label>
        <div className="flex flex-wrap items-center gap-3">
          <select id="parent-lang" className="input max-w-xs" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn-primary" onClick={generate} disabled={loading}>
            {loading ? <Spinner label="Writing the update..." /> : report ? "Rewrite the update" : "Write my parents an update"}
          </button>
        </div>
        {error && <div className="mt-3"><ErrorNote onRetry={generate}>Couldn't write the update just now. Check your internet and try again.</ErrorNote></div>}
      </div>

      {report && (
        <>
          {shareUrl && (
            <div className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
              <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.10)_0,transparent_60%)]" />
              <div className="relative">
                <h3 className="font-semibold text-ink">Share this with your family</h3>
                <p className="mt-1 text-sm text-muted">They open this link and read your update. No app, no login. It always shows your latest progress.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">{shareUrl}</code>
                  <CopyButton text={shareUrl} label="Copy link" />
                </div>
              </div>
            </div>
          )}
          <ParentReportView report={report} />
        </>
      )}
    </div>
  );
}
