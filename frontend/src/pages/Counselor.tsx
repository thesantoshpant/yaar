import { useRef, useState } from "react";
import { api } from "../api/client";
import { getProfileSummary, getProfileId } from "../lib/progress";
import { Spinner, SourceBadge } from "../components/ui";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Counselor</h1>
          <p className="mt-1 text-slate-600">Your always-on, unbiased advisor.</p>
        </div>
        <SourceBadge source={source} />
      </div>

      <div className="card flex h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <Spinner label="Counselor is typing..." />}
          <div ref={endRef} />
        </div>
        <div className="mt-4 flex gap-2">
          <input
            className="input"
            placeholder="Ask your counselor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn-primary" onClick={send} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
