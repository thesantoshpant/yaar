import { useRef, useState } from "react";
import { api } from "../api/client";
import { getProfileSummary, getProfileId } from "../lib/progress";
import { SourceBadge, PageHeading } from "../components/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function Counselor() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi, I am your Yaar counselor. I work only for you, never for the schools. Ask me anything about studying in the USA, or tell me where you are stuck.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat(next, getProfileSummary() || undefined, getProfileId() || undefined);
      setMessages([...next, { role: "assistant", content: res.reply }]);
      setSource(res.source);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, I could not reach the server. Is the backend running?" }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Your counselor 💬"
        subtitle="Always on, fully on your side. No question is too small."
        action={<SourceBadge source={source} />}
      />

      <div className="card flex h-[62vh] flex-col overflow-hidden p-0">
        {/* Buddy header */}
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-sm font-extrabold text-slate-900">
            Y
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Yaar</div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> online · always
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2/50 px-5 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                    : "rounded-bl-md bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-gradient-to-br from-brand-500 to-violet-500 px-4 py-3 shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="flex gap-2 border-t border-line bg-surface px-5 py-4">
          <input
            className="input"
            placeholder="Message Yaar..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn-primary shrink-0" onClick={send} disabled={loading} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
