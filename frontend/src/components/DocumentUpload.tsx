import { useRef, useState } from "react";
import { api } from "../api/client";
import { Spinner, ErrorNote } from "./ui";

type Kind = "i20" | "admit" | "funding" | "other";
type Field = { field: string; value: string; confidence?: "high" | "medium" | "low" };
type Pending = { name: string; mimeType: string; data: string; kind: Kind };

const KIND_OPTIONS: { id: Kind; label: string }[] = [
  { id: "i20", label: "I-20" },
  { id: "admit", label: "Admission letter" },
  { id: "funding", label: "Funding proof" },
  { id: "other", label: "Other" },
];

function guessKind(name: string): Kind {
  const n = name.toLowerCase();
  if (n.includes("i20") || n.includes("i-20")) return "i20";
  if (n.includes("admit") || n.includes("offer") || n.includes("admission")) return "admit";
  if (n.includes("bank") || n.includes("fund") || n.includes("statement") || n.includes("sponsor")) return "funding";
  return "other";
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function compose(fields: Field[]): string {
  return fields
    .filter((f) => f.value.trim() && f.value.trim().toLowerCase() !== "not found")
    .map((f) => `${f.field}: ${f.value}`)
    .join("\n");
}

// Upload documents -> Gemini reads them -> student confirms the fields. Falls back to typing.
// `value` is the plain-text details the parent uses for the report and the interview.
export default function DocumentUpload({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [mode, setMode] = useState<"upload" | "type">("upload");
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [fields, setFields] = useState<Field[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(false);
    const next: Pending[] = [];
    for (const f of Array.from(list).slice(0, 4)) {
      try {
        const data = await readAsBase64(f);
        next.push({ name: f.name, mimeType: f.type || "application/octet-stream", data, kind: guessKind(f.name) });
      } catch {
        // A single unreadable file (corrupt, permission revoked, undecodable
        // mobile photo) must not throw an unhandled rejection or silently drop
        // the whole batch. Keep the readable files and surface the error.
        setError(true);
      }
    }
    if (next.length) setFiles((prev) => [...prev, ...next].slice(0, 4));
  }

  async function extract() {
    if (files.length === 0) return;
    setBusy(true);
    setError(false);
    try {
      const res = await api.riskExtract(files.map((f) => ({ kind: f.kind, mimeType: f.mimeType, data: f.data, filename: f.name })));
      setFields(res.extracted);
      setWarnings(res.warnings);
      onChange(compose(res.extracted));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function editField(i: number, val: string) {
    setFields((prev) => {
      if (!prev) return prev;
      const next = prev.map((f, j) => (j === i ? { ...f, value: val } : f));
      onChange(compose(next));
      return next;
    });
  }

  function reset() {
    setFiles([]);
    setFields(null);
    setWarnings([]);
    setError(false);
    onChange("");
  }

  // --- Type-it-yourself fallback ---
  if (mode === "type") {
    return (
      <div>
        <textarea
          className="input min-h-[120px]"
          placeholder="In your own words: your school, your program, who's paying and their job, and the funds you can show. I'll sort it out."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="mt-2 text-sm font-medium text-brand-500 hover:underline" onClick={() => setMode("upload")}>
          Upload my documents instead
        </button>
      </div>
    );
  }

  // --- Confirm step: the student edits, barely types ---
  if (fields) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Here's what I read. Fix anything that looks off, then build your report.</p>
        <div className="space-y-2.5">
          {fields.map((f, i) => {
            const low = f.confidence === "low" || f.value.trim().toLowerCase() === "not found";
            return (
              <div key={i}>
                <label className="label flex items-center gap-2">
                  {f.field}
                  {low && <span className="badge bg-amber-500/15 text-amber-600 dark:text-amber-400">check this</span>}
                </label>
                <input className="input" value={f.value === "Not found" ? "" : f.value} placeholder="Add this" onChange={(e) => editField(i, e.target.value)} />
              </div>
            );
          })}
        </div>
        {warnings.length > 0 && (
          <ul className="list-inside list-disc text-sm text-amber-600 dark:text-amber-400">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        <button type="button" className="text-sm font-medium text-brand-500 hover:underline" onClick={reset}>
          Upload different documents
        </button>
      </div>
    );
  }

  // --- Upload step ---
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-brand-500 bg-brand-500/5" : "border-line hover:border-brand-500/50 hover:bg-surface-2/50"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
        </svg>
        <p className="mt-2 text-sm font-medium text-ink">Upload your I-20, admission letter, or bank proof</p>
        <p className="mt-0.5 text-xs text-muted">Take a photo or pick a file. PDF or image, up to 4.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-sm">
              <span className="flex-1 truncate text-ink">{f.name}</span>
              <select
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted"
                value={f.kind}
                onChange={(e) => setFiles((prev) => prev.map((p, j) => (j === i ? { ...p, kind: e.target.value as Kind } : p)))}
              >
                {KIND_OPTIONS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <button type="button" aria-label="Remove" className="text-muted hover:text-rose-500" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mt-3"><ErrorNote onRetry={extract}>I couldn't read that just now. Check your internet and try again, or type the details instead.</ErrorNote></div>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={extract} disabled={busy || files.length === 0}>
          {busy ? <Spinner label="Reading your documents..." /> : "Read my documents"}
        </button>
        <button type="button" className="text-sm font-medium text-brand-500 hover:underline" onClick={() => setMode("type")}>
          Prefer to type it?
        </button>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        Your documents stay private. I read them to help you, then they're gone. Never upload passwords.
      </p>
    </div>
  );
}
