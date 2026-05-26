import { useEffect, useState } from "react";
import { api } from "../api/client";
import { markCompleted, getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { useAuthGate } from "../lib/authGate";
import { Spinner, SourceBadge, PageHeading, ErrorNote, CopyButton } from "../components/ui";

const STORAGE_KEY = "yaar.essay";

type EssayType = "sop" | "common_app";

export default function Applications() {
  const { profile, setField, saveNow, summary } = useProfile();
  const { gate } = useAuthGate();
  const [type, setType] = useState<EssayType>("sop");
  const [school, setSchool] = useState("");
  const [promptText, setPromptText] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Restore any in-progress work so navigating away never destroys a draft.
  // Major/level live on the shared profile, so they are not restored from here.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        type: EssayType;
        school: string;
        promptText: string;
        notes: string;
        draft: string;
        source: string;
      }>;
      if (saved.type) setType(saved.type);
      if (saved.school) setSchool(saved.school);
      if (saved.promptText) setPromptText(saved.promptText);
      if (saved.notes) setNotes(saved.notes);
      if (saved.draft) setDraft(saved.draft);
      if (saved.source) setSource(saved.source);
    } catch {
      // Ignore corrupt storage; the student can simply regenerate.
    }
  }, []);

  async function generate() {
    setLoading(true);
    setError(false);
    try {
      await saveNow();
      const res = await api.draftEssay({
        type,
        school: school || undefined,
        major: profile.intendedMajor || undefined,
        promptText: promptText || undefined,
        notes: notes || undefined,
        profileSummary: summary() || undefined,
        profileId: getProfileId() || undefined,
      });
      setDraft(res.draft);
      setSource(res.source);
      markCompleted("applications");
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ type, school, promptText, notes, draft: res.draft, source: res.source })
        );
      } catch {
        // Storage may be unavailable (private mode); the draft still shows on screen.
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Applications ✍️"
        subtitle="Draft your SOP or Common App essay in minutes. Yaar writes a first draft in your voice. You make it true and unmistakably yours."
      />

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Essay type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as EssayType)}>
              <option value="sop">Statement of Purpose</option>
              <option value="common_app">Common App personal essay</option>
            </select>
          </div>
          <div>
            <label className="label">Level</label>
            <select
              className="input"
              value={profile.intendedLevel}
              onChange={(e) => setField({ intendedLevel: e.target.value as "undergraduate" | "graduate" })}
            >
              <option value="undergraduate">Undergraduate</option>
              <option value="graduate">Graduate</option>
            </select>
          </div>
          <div>
            <label className="label">Major</label>
            <input
              className="input"
              value={profile.intendedMajor}
              onChange={(e) => setField({ intendedMajor: e.target.value })}
              placeholder="e.g. Computer Science"
            />
          </div>
          <div>
            <label className="label">Target school (optional)</label>
            <input className="input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Arizona State University" />
          </div>
        </div>
        <label className="label mt-4">Essay prompt (optional)</label>
        <textarea
          className="input min-h-[60px]"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Paste the exact prompt"
        />
        <label className="label mt-4">Real details to use (the more, the better)</label>
        <textarea
          className="input min-h-[110px]"
          placeholder="Tell the AI true specifics: a moment that drew you to this field, a project you built, why this school, your career plan, your ties to home. Real details beat generic essays."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="mt-2 text-xs text-faint">
          Yaar already knows you're aiming for {profile.intendedLevel === "graduate" ? "graduate" : "undergraduate"} study
          {profile.intendedMajor ? ` in ${profile.intendedMajor}` : ""}. Edit above and it's remembered everywhere.
        </p>
        {error && <ErrorNote onRetry={generate} />}
        <button className="btn-primary mt-4" onClick={() => gate("essay", () => generate())} disabled={loading}>
          {loading ? <Spinner label="Drafting..." /> : "Draft my essay"}
        </button>
      </div>

      {draft && (
        <div className="card rounded-xl border-brand-500/20 bg-brand-500/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Your draft</h2>
            <div className="flex items-center gap-2">
              <SourceBadge source={source} />
              <CopyButton text={draft} label="Copy draft" />
            </div>
          </div>
          <textarea
            className="input min-h-[320px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-faint">
            {wordCount} {wordCount === 1 ? "word" : "words"}
            {type === "common_app" && " · Common App personal statement target: 650 words"}
          </p>
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            This is a first draft. Replace every placeholder with a true, specific detail, and cut anything that
            could appear in anyone's essay. Never submit anything that is not genuinely yours.
          </p>
        </div>
      )}
    </div>
  );
}
