import { useEffect, useState } from "react";
import { api } from "../api/client";
import { setProfileId } from "../lib/progress";
import { Spinner } from "./ui";

// One-click sample students. Loads a fully fleshed profile (with memory + a logged
// activity + a consolidated mind) so a visitor or judge sees the whole product working
// instantly, and sees how differently Yaar treats different journeys.
export default function PersonaPicker() {
  const [personas, setPersonas] = useState<{ key: string; label: string; blurb: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listPersonas().then((r) => setPersonas(r.personas)).catch(() => {});
  }, []);

  async function pick(key: string) {
    setBusy(key);
    try {
      const res = await api.seedPersona(key);
      setProfileId(res.profile.id);
      try {
        localStorage.removeItem("yaar.profile.form"); // let the shared profile rehydrate from the server
        localStorage.removeItem("yaar.dashboard.plan");
      } catch {
        // ignore
      }
      await api.runDrop(res.profile.id).catch(() => {});
      window.location.assign("/app"); // full reload so every page reflects the sample student
    } catch {
      setBusy(null);
    }
  }

  if (personas.length === 0) return null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ink">Just exploring? Meet Yaar as a sample student</h2>
      <p className="mt-1 text-sm text-muted">Load a real-feeling student and see their whole journey: their plan, memory, and the agentic company, all at once.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {personas.map((p) => (
          <button
            key={p.key}
            onClick={() => pick(p.key)}
            disabled={!!busy}
            className="flex flex-col rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-500/50 hover:bg-surface-2 disabled:opacity-60"
          >
            <span className="font-semibold text-ink">{p.label}</span>
            <span className="mt-1 text-xs leading-relaxed text-muted">{p.blurb}</span>
            <span className="mt-2 text-xs font-medium text-brand-500">{busy === p.key ? <Spinner label="Loading..." /> : "Try this student →"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
