// Anonymous bug-report / idea form. This is the product's contact channel: no
// login, no personal details required, no links to anyone's identity.
import { useState } from "react";
import { Link } from "react-router-dom";
import { errText } from "../api/client";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export default function Feedback() {
  const [kind, setKind] = useState<"bug" | "idea" | "other">("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (message.trim().length < 5 || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          email: email.trim() || undefined,
          page: document.referrer || undefined,
        }),
      });
      if (!res.ok) {
        let msg = "";
        try {
          msg = (await res.json())?.error ?? "";
        } catch {
          // non-JSON body
        }
        throw new Error(typeof msg === "string" ? msg : "");
      }
      setSent(true);
    } catch (e) {
      setError(errText(e, "Couldn't send that just now. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-xl px-6 py-14">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Back to Yaar</Link>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">Report a problem</h1>
        <p className="mt-2 text-muted">
          Found a bug? Have an idea? This goes straight to the people building Yaar. No login needed.
        </p>

        {sent ? (
          <div className="card mt-8">
            <h2 className="text-lg font-semibold">Got it. Thank you 🙏</h2>
            <p className="mt-1 text-sm text-muted">
              Reports like yours are how Yaar gets better for every student. If you left an email, you might hear back.
            </p>
            <div className="mt-4 flex gap-3">
              <Link to="/app" className="btn-primary">Back to the app</Link>
              <button className="btn-ghost" onClick={() => { setSent(false); setMessage(""); }}>Send another</button>
            </div>
          </div>
        ) : (
          <div className="card mt-8">
            <label className="label" htmlFor="fb-kind">What is it?</label>
            <select id="fb-kind" className="input max-w-xs" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="bug">Something is broken</option>
              <option value="idea">An idea to make Yaar better</option>
              <option value="other">Something else</option>
            </select>

            <label className="label mt-4" htmlFor="fb-message">Tell us what happened</label>
            <textarea
              id="fb-message"
              className="input min-h-[140px]"
              placeholder={kind === "bug" ? "What did you do, and what went wrong? The more detail, the faster it gets fixed." : "What's your idea?"}
              value={message}
              maxLength={4000}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label className="label mt-4" htmlFor="fb-email">
              Email <span className="font-normal text-faint">· optional, only if you want a reply</span>
            </label>
            <input
              id="fb-email"
              className="input max-w-sm"
              type="email"
              placeholder="you@example.com"
              value={email}
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <button className="btn-primary mt-5" onClick={submit} disabled={sending || message.trim().length < 5}>
              {sending ? "Sending..." : "Send report"}
            </button>
            <p className="mt-3 text-xs text-faint">Nothing about you is collected unless you type it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
