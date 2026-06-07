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
      // Attach a UTM so we can see which shares actually bring families back.
      const u = res.shareUrl.includes("?") ? "&" : "?";
      setShareUrl(`${res.shareUrl}${u}utm_source=parent_share&utm_medium=link&utm_campaign=parent_report`);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!profileId) {
    return (
      <div className="space-y-4">
        <PageHeading title="For parents" />
        <div className="card text-muted">
          Chat with Yaar a little first on{" "}
          <Link to="/app" className="font-medium text-brand-500 hover:underline">Ask Yaar</Link>, then it can write an update your family will understand.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="For parents"
        subtitle="Yaar writes a warm, honest update your family can follow, in their language. Share it with one link, no login needed."
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
            <div className="card border-brand-500/20 bg-brand-500/5">
              <h3 className="font-semibold text-ink">Share this with your family</h3>
              <p className="mt-1 text-sm text-muted">They open this link and read your update. No app, no login. It always shows your latest progress.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`An update on my study-abroad journey, from Yaar: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.728-.978zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" /></svg>
                  Send on WhatsApp
                </a>
                <CopyButton text={shareUrl} label="Copy link" />
              </div>
            </div>
          )}
          <ParentReportView report={report} />
        </>
      )}
    </div>
  );
}
