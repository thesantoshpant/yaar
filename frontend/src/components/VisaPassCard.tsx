// The Visa Pass: a shareable, certificate-style card a student gets after a mock
// F-1 interview. The whole payload lives in the URL hash (never hits the server),
// so sharing carries no PII to any backend. Used both in the visa flow (inline)
// and on the public /visa-pass page. Sharing is the growth loop, so it has real
// rails: WhatsApp, a saved PNG image (South Asia shares images on WhatsApp, not
// links), the native share sheet, and a copy-link fallback.
import { useRef, useState } from "react";
import { toPng } from "html-to-image";

export interface PassData {
  name: string;
  consulate: string;
  overall: number; // 0..100
  verdict: "passed" | "needs work" | "not yet ready";
  top: { name: string; score: number }[]; // strongest dimensions
  weak?: { name: string; score: number }; // the one to work on
  highlights?: { officer: string; student: string }[];
  date: string; // ISO
}

// Encode a pass into a shareable /visa-pass URL (hash payload, base64url).
export function encodePassUrl(pass: PassData): string {
  const json = JSON.stringify(pass);
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.origin}/visa-pass#data=${b64}`;
}

export function decodePass(): PassData | null {
  try {
    const raw = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#data=/, "");
    if (!raw) return null;
    const b = raw.replace(/-/g, "+").replace(/_/g, "/");
    const p = JSON.parse(decodeURIComponent(escape(atob(b)))) as Record<string, unknown>;
    // A shared link is untrusted: chat apps mangle/truncate URLs, an older link
    // can carry a legacy shape, and the value can be hand-edited. The public
    // /visa-pass page renders OUTSIDE any error boundary, so a parseable-but-
    // malformed payload must degrade to the friendly empty state, never crash.
    const verdict = p?.verdict;
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.overall !== "number" ||
      !Array.isArray(p.top) ||
      (verdict !== "passed" && verdict !== "needs work" && verdict !== "not yet ready")
    ) {
      return null;
    }
    return p as unknown as PassData;
  } catch {
    return null;
  }
}

const VERDICT: Record<PassData["verdict"], { label: string; pill: string }> = {
  passed: { label: "Ready", pill: "bg-emerald-500 text-white" },
  "needs work": { label: "Almost there", pill: "bg-gold-500 text-gold-ink" },
  "not yet ready": { label: "Keep practicing", pill: "bg-rose-500 text-white" },
};

export default function VisaPassCard({ pass }: { pass: PassData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  // Total lookup so an unexpected verdict (e.g. from the inline in-flow render)
  // can never make tone undefined and throw on tone.pill/tone.label below.
  const tone = VERDICT[pass.verdict] ?? VERDICT["needs work"];
  const shareUrl = encodePassUrl(pass);
  const shareText = `I scored ${pass.overall}/100 on my mock US student-visa interview with Yaar. Practice yours free: `;

  async function saveImage() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "yaar-visa-pass.png";
      a.click();
    } catch {
      // image export can fail on some browsers; the other share options still work
    }
  }

  async function nativeShare() {
    try {
      if (cardRef.current && navigator.canShare) {
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "yaar-visa-pass.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText + shareUrl });
          return;
        }
      }
      if (navigator.share) await navigator.share({ title: "My Yaar Visa Pass", text: shareText, url: shareUrl });
    } catch {
      // user cancelled or unsupported
    }
  }

  function copyLink() {
    if (navigator.clipboard) void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="mx-auto max-w-sm">
      {/* The card itself (captured for the PNG). Plain colors, no CSS-var-only
          backgrounds or external SVGs, so the image export is reliable. */}
      <div ref={cardRef} className="overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
        <div className="flex items-center justify-between bg-[#216867] px-5 py-4 text-white">
          <span className="font-display text-base font-extrabold tracking-tight">Yaar · Visa Pass</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/90">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            verified
          </span>
        </div>

        <div className="px-6 py-6 text-[#1c1b20]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#857461]">
            F-1 mock interview · {pass.consulate}
          </div>
          <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight">{pass.name}</h2>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-5xl font-extrabold">{pass.overall}</span>
              <span className="text-sm text-[#857461]">/ 100</span>
            </div>
            <span className={`badge px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.pill}`}>{tone.label}</span>
          </div>

          <div className="mt-5 space-y-2">
            {(pass.top ?? []).slice(0, 1).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-[#1FA37A]">Strong</span>
                <span className="text-[#524533]">{d.name}</span>
              </div>
            ))}
            {pass.weak && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-[#B45309]">Work on</span>
                <span className="text-[#524533]">{pass.weak.name}</span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-[#e6e0ea] pt-3 text-center text-xs text-[#857461]">
            Practiced free on Yaar · yaar.app/visa
          </div>
        </div>
      </div>

      {/* Share rails — the growth loop. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText + shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.728-.978zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" /></svg>
          WhatsApp
        </a>
        <button className="btn-primary" onClick={saveImage}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          Save image
        </button>
        {hasNativeShare && (
          <button className="btn-ghost" onClick={nativeShare}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
            Share
          </button>
        )}
        <button className={`btn-ghost ${hasNativeShare ? "" : "col-span-2"}`} onClick={copyLink}>
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
