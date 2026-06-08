// Ask Yaar — the home screen. A chat is the whole front door: a scared student
// taps one of three fears or just types. The chat engine (api.chat, localStorage
// history, gate, markdown, TTS) is lifted verbatim from the old Counselor page;
// only the layout is new (greeting + 3 fear cards as the empty state, a pinned
// composer that clears the bottom nav).
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, errText } from "../api/client";
import { getProfileSummary, getProfileId } from "../lib/progress";
import { useAuthGate } from "../lib/authGate";
import { useProfile } from "../lib/profile";
import { markdownToHtml } from "../components/Markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// The three things the target student actually came to find out. Two open the
// chat with the question pre-asked; the visa one routes to the flagship flow.
const FEARS: { label: string; ask?: string; to?: string }[] = [
  { label: "Can I actually get in?", ask: "Can I actually get into a US university? Please be honest with me about my real chances and what would make me stronger." },
  { label: "Can I afford this?", ask: "Can I really afford to study in the US? Help me understand the true costs and what financial aid or scholarships are realistic for someone like me." },
  { label: "Will I pass the visa interview?", to: "/app/visa" },
];

const STARTER_CHIPS = [
  "How much bank balance is needed for an F-1 visa?",
  "What are reach, match, and safety schools?",
  "Can I work in the US on a student visa?",
  "Help me write my SOP",
];

const GREETING: Msg = {
  role: "assistant",
  content: "Hi, I'm Yaar. I work for you, never for any school. Ask me anything, or tap one of the questions below.",
};

const STORE_KEY = "yaar.counselor";

function loadMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Msg[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // ignore
  }
  return [GREETING];
}

export default function AskYaar() {
  const [messages, setMessages] = useState<Msg[]>(loadMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { gate } = useAuthGate();
  const { saveNow } = useProfile();
  const navigate = useNavigate();

  const empty = messages.length <= 1;
  // Some browsers / WebViews (locked-down Android WebView, kiosk, older engines)
  // lack the Web Speech API; guard every use and hide the Listen button there.
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => () => { if (ttsSupported) window.speechSynthesis.cancel(); }, [ttsSupported]);

  // Follow the conversation to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Persist the chat so a scared student who typed something vulnerable never loses it.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
  }, [messages]);

  function clearChat() {
    window.speechSynthesis.cancel();
    setMessages([GREETING]);
  }

  function speak(text: string, idx: number) {
    if (!ttsSupported) return;
    if (playingIdx === idx) {
      window.speechSynthesis.cancel();
      setPlayingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\*\*|###|- |\d+\. /g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setPlayingIdx(null);
    utterance.onerror = () => setPlayingIdx(null);
    const englishVoice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en-"));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
    setPlayingIdx(idx);
  }

  async function sendDirect(text: string) {
    if (loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      // The chat IS the intake: create a lightweight profile on the first real
      // message so memory accumulates and saving (history, parent report) works,
      // without ever asking the student to fill a form. Rate-limited server-side.
      let pid = getProfileId();
      if (!pid) {
        try {
          pid = (await saveNow()) ?? null;
        } catch {
          // a failed create must never block the reply
        }
      }
      const res = await api.chat(next, getProfileSummary() || undefined, pid || undefined);
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: errText(e, "Sorry yaar, I couldn't reach you just now. Check your internet and try again in a sec.") }]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    gate("counselor", () => sendDirect(text));
  }

  function tapFear(f: (typeof FEARS)[number]) {
    if (f.to) navigate(f.to);
    else if (f.ask) gate("counselor", () => sendDirect(f.ask!));
  }

  return (
    <div className="pb-28 lg:pb-24">
      {empty ? (
        // Empty state: a warm greeting + the three big fear taps.
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold leading-snug tracking-tight text-ink sm:text-[28px]">
            Hi, I'm Yaar. I work for you, <span className="text-brand-600 dark:text-brand-400">not for any school.</span>
          </h1>
          <p className="mt-2 text-muted">What's worrying you most right now?</p>

          <div className="mt-5 space-y-3">
            {FEARS.map((f) => (
              <button
                key={f.label}
                onClick={() => tapFear(f)}
                className="card flex w-full items-center justify-between gap-3 p-5 text-left transition hover:border-brand-400 hover:shadow-lift"
              >
                <span className="font-display text-lg font-bold text-ink">{f.label}</span>
                <svg className="h-5 w-5 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-faint">Or ask anything</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STARTER_CHIPS.map((chip) => (
              <button key={chip} onClick={() => gate("counselor", () => sendDirect(chip))} className="chip text-xs hover:border-brand-500 hover:text-brand-500">
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Active conversation.
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button className="text-sm font-medium text-muted hover:text-ink" onClick={clearChat}>
              New chat
            </button>
          </div>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">Y</span>
                <div className="group relative max-w-[85%]">
                  <div
                    className="counselor-md rounded-2xl rounded-bl-md bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }}
                  />
                  {ttsSupported && (
                  <button
                    onClick={() => speak(m.content, i)}
                    className="absolute -right-9 top-1.5 rounded-lg border border-line bg-surface p-1.5 text-muted opacity-0 transition hover:text-ink group-hover:opacity-100 focus:opacity-100"
                    title="Listen"
                    aria-label="Listen to this reply"
                  >
                    {playingIdx === i ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                    )}
                  </button>
                  )}
                </div>
              </div>
            )
          )}
          {loading && (
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">Y</span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-brand-600 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer — pinned above the bottom nav on mobile, in-flow on desktop. */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-lg lg:static lg:z-auto lg:mt-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            className="input min-h-[44px] flex-1 resize-none"
            rows={1}
            placeholder="Ask Yaar anything…"
            aria-label="Message Yaar"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-gold-ink shadow-sm transition hover:bg-gold-400 disabled:opacity-50"
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-2xl text-[11px] text-faint">
          Coaching and information, not legal advice. Verify visa and money rules with official sources.
        </p>
      </div>
    </div>
  );
}
