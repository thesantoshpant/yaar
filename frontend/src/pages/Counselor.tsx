import { useRef, useState, useEffect } from "react";
import { api } from "../api/client";
import { getProfileSummary, getProfileId } from "../lib/progress";
import { SourceBadge, PageHeading } from "../components/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTER_CHIPS = [
  "What are reach, match, and safety schools? 🎓",
  "How much bank balance is required for F-1 visa? 💰",
  "Can I work in the US on a student visa? 💼",
  "How do I write a good SOP / essay? 📝",
];

function renderMessageContent(content: string) {
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const isLi = line.startsWith('<li>') || line.endsWith('</li>');
    if (isLi && !inList) {
      inList = true;
      return '<ul>' + line;
    } else if (!isLi && inList) {
      inList = false;
      return '</ul>' + (line.trim() ? `<p>${line}</p>` : '');
    } else if (!line.trim()) {
      return '';
    } else if (!isLi && !line.startsWith('<h')) {
      return `<p>${line}</p>`;
    }
    return line;
  });
  if (inList) {
    processedLines.push('</ul>');
  }
  return processedLines.filter(Boolean).join('');
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
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  function speak(text: string, idx: number) {
    if (playingIdx === idx) {
      window.speechSynthesis.cancel();
      setPlayingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    
    // Strip markdown formatting out
    const cleanText = text.replace(/\*\*|###|- |\d+\. /g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setPlayingIdx(null);
    utterance.onerror = () => setPlayingIdx(null);

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en-"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
    setPlayingIdx(idx);
  }

  async function sendDirect(text: string) {
    if (loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await sendDirect(text);
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
        <div className="flex-1 space-y-4 overflow-y-auto bg-surface-2/50 px-5 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "user" ? (
                <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white text-slate-900 px-4 py-2.5 text-sm leading-relaxed shadow-sm ring-1 ring-black/5">
                  {m.content}
                </div>
              ) : (
                <div className="flex justify-start items-start gap-2.5 w-full">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-xs font-extrabold text-slate-900 mt-1 shadow-sm">
                    Y
                  </span>
                  <div className="relative group max-w-[80%]">
                    <div
                      className="counselor-md rounded-2xl rounded-bl-md bg-gradient-to-br from-brand-500 to-violet-500 text-white px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                      dangerouslySetInnerHTML={{ __html: renderMessageContent(m.content) }}
                    />
                    {/* TTS Button */}
                    <button
                      onClick={() => speak(m.content, i)}
                      className="absolute -right-9 top-1.5 p-1.5 rounded-lg bg-surface border border-line text-muted hover:text-ink hover:shadow-soft transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      title="Listen to response"
                    >
                      {playingIdx === i ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {messages.length === 1 && !loading && (
            <div className="mt-4 pl-10 pr-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Ask Yaar anything:</p>
              <div className="flex flex-wrap gap-2">
                {STARTER_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendDirect(chip)}
                    className="chip text-xs hover:border-brand-500 hover:text-brand-500 hover:shadow-soft transition-all cursor-pointer bg-surface"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-xs font-extrabold text-slate-900 mt-1 shadow-sm">
                Y
              </span>
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
