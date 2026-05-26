import { useState } from "react";
import { api } from "../api/client";
import { getProfileSummary, markCompleted } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

export default function Applications() {
  const [type, setType] = useState<"sop" | "common_app">("sop");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [promptText, setPromptText] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await api.draftEssay({
        type,
        school: school || undefined,
        major: major || undefined,
        promptText: promptText || undefined,
        notes: notes || undefined,
        profileSummary: getProfileSummary() || undefined,
      });
      setDraft(res.draft);
      setSource(res.source);
      markCompleted("applications");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Applications ✍️"
        subtitle="Draft your SOP or Common App essay in minutes. Yaar writes a first draft in your voice — you make it true and unmistakably yours."
      />

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Essay type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as "sop" | "common_app")}>
              <option value="sop">Statement of Purpose</option>
              <option value="common_app">Common App personal essay</option>
            </select>
          </div>
          <div>
            <label className="label">Target school (optional)</label>
            <input className="input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Arizona State University" />
          </div>
          <div>
            <label className="label">Major (optional)</label>
            <input className="input" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
          </div>
          <div>
            <label className="label">Essay prompt (optional)</label>
            <input className="input" value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="Paste the exact prompt" />
          </div>
        </div>
        <label className="label mt-4">Real details to use (the more, the better)</label>
        <textarea
          className="input min-h-[110px]"
          placeholder="Tell the AI true specifics: a moment that drew you to this field, a project you built, why this school, your career plan, your ties to home. Real details beat generic essays."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="btn-primary mt-4" onClick={generate} disabled={loading}>
          {loading ? <Spinner label="Drafting..." /> : "Draft my essay"}
        </button>
      </div>

      {draft && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your draft</h2>
            <SourceBadge source={source} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">{draft}</pre>
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            This is a first draft. Replace every placeholder with a true, specific detail, and cut anything that
            could appear in anyone's essay. Never submit anything that is not genuinely yours.
          </p>
        </div>
      )}
    </div>
  );
}
