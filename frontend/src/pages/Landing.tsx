import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal, stagger, staggerItem } from "../components/Reveal";
import ThemeToggle from "../components/ThemeToggle";

const JOURNEY = [
  { step: "01", title: "Roadmap", text: "An honest plan for your tests, timeline, and budget — no fluff." },
  { step: "02", title: "Test prep", text: "Unlimited TOEFL & IELTS speaking practice, scored on the spot." },
  { step: "03", title: "School search", text: "A balanced list from real data, never from who pays us." },
  { step: "04", title: "Applications", text: "Common App setup and essays drafted in your voice." },
  { step: "05", title: "Money & I-20", text: "Sort your funding proof the right way, stress-free." },
  { step: "06", title: "Visa", text: "Practice your F-1 interview till you walk in fearless." },
];

const USP = [
  {
    t: "Does the work for you",
    d: "It plans, drills you, finds schools, drafts essays, and runs mock interviews — and keeps going while you sleep.",
    icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
  },
  {
    t: "Zero bias, zero cut",
    d: "Agents earn commissions from schools. Yaar earns nothing from them, ever. The only job is your best outcome.",
    icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z M9 12l2 2 4-4",
  },
  {
    t: "Same shot for everyone",
    d: "No connections? No problem. The same elite guidance, 24/7, in your language — whoever you are.",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  },
];

const PERSONAS = [
  { emoji: "🌾", t: "Rural & first-gen", d: "Nobody at home has done this before? Yaar walks you through every single step." },
  { emoji: "🏙️", t: "City kid, big dreams", d: "Aiming for a top school? Get a sharp, honest plan to actually get there." },
  { emoji: "💸", t: "On a tight budget", d: "Find schools that fund international students and skip the agency fees." },
  { emoji: "📨", t: "Already applying", d: "Mid-process and overwhelmed? Drop in anytime and pick up where you are." },
];

function Check() {
  return (
    <svg className="mx-auto h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="yes">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function Cross() {
  return (
    <svg className="mx-auto h-5 w-5 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="no">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// A friendly mock conversation that shows Yaar's personality. Bubbles fade in
// in sequence so it feels alive.
const CHAT: { from: "you" | "yaar"; text: string }[] = [
  { from: "you", text: "ngl i'm scared i'll bomb my visa interview 😭" },
  { from: "yaar", text: "totally normal. let's practice — i'll play the officer, you answer. by the end you'll walk in ready 💪" },
  { from: "you", text: "wait you'd actually do that with me?" },
  { from: "yaar", text: "anytime. that's literally why i'm here, yaar. free, 24/7, no judgement." },
];

function ChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-3 rounded-[2rem] bg-vibe-anim opacity-30 blur-2xl" />
      <div className="relative rounded-[1.75rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-sm font-extrabold text-slate-900">Y</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Yaar</div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online · always
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {CHAT.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                  m.from === "you"
                    ? "rounded-br-md bg-white text-slate-900"
                    : "rounded-bl-md bg-gradient-to-br from-brand-500 to-violet-500 text-white"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SandboxPersona {
  name: string;
  avatar: string;
  tag: string;
  stats: string;
  nextStep: {
    module: string;
    title: string;
    why: string;
    progress: number;
  };
  opportunity: {
    kind: string;
    title: string;
    body: string;
    cta: string;
  };
  chatSnippet: {
    user: string;
    yaar: string;
  };
}

const SANDBOX_PERSONAS: SandboxPersona[] = [
  {
    name: "Ramesh",
    avatar: "🌾",
    tag: "RURAL & FIRST-GEN",
    stats: "Nepal · Grade 11 · $5k budget",
    nextStep: {
      module: "Roadmap",
      title: "Launch a 'Manufactured Extracurricular' Project",
      why: "US colleges demand leadership. Since your rural school lacks formal clubs, Yaar suggests creating a localized project, like building a community resource website. We'll track your first step this week.",
      progress: 15,
    },
    opportunity: {
      kind: "opportunity",
      title: "Weekly Drop: Community Technology Project",
      body: "Because you indicated your school has no clubs, here is a self-start initiative. Build a simple website mapping local agriculture or services. First action: Create a free GitHub account and learn HTML basics.",
      cta: "GitHub Quickstart Guide",
    },
    chatSnippet: {
      user: "Nobody in my family has ever been to college, let alone the US. Is it even possible with a $5k budget? 🥺",
      yaar: "It is absolutely possible, Ramesh! Private liberal arts colleges in the US have massive financial aid funds. Because your budget is $5k, we will bypass standard commercial schools and target need-blind/need-aware institutions. I will help you build a standout portfolio to secure that scholarship.",
    },
  },
  {
    name: "Aditya",
    avatar: "🏙️",
    tag: "CITY CS ASPIRANT",
    stats: "India · Gap Year · $30k budget",
    nextStep: {
      module: "Test prep",
      title: "TOEFL Speaking Drill: Academic Expression",
      why: "Your technical projects are outstanding, but top-tier universities and graduate assistantships require a strong speaking band. Let's aim for a 26+ speaking score to secure your funding.",
      progress: 40,
    },
    opportunity: {
      kind: "followup",
      title: "Action Item: 45-Second TOEFL Speaking Drill",
      body: "Your speaking test is coming up. Record yourself explaining why you chose Computer Science. Focus on transition words ('furthermore', 'on the other hand') to maximize fluency scores.",
      cta: "Start Speaking Drill",
    },
    chatSnippet: {
      user: "My grades are good, but I'm nervous about the speaking part. What if I stutter or blank out?",
      yaar: "Totally normal, Aditya. Consulates and exams don't check for accent perfection; they check for structured thoughts and fluency. Let's practice. I'll give you a prompt, you record your response, and I'll score it using the official rubric.",
    },
  },
  {
    name: "Sabrina",
    avatar: "🎨",
    tag: "BUDGET SCHOLAR",
    stats: "Bangladesh · Grade 12 · $12k budget",
    nextStep: {
      module: "School search",
      title: "Build your 100% Aid School List",
      why: "You need a list of US colleges that meet full demonstrated financial need for international students. We'll start with private liberal arts colleges that match your cultural arts interests.",
      progress: 65,
    },
    opportunity: {
      kind: "opportunity",
      title: "Weekly Drop: Curated Liberal Arts Colleges List",
      body: "We selected 5 schools (e.g. Williams, Amherst, Bowdoin) that offer full aid to international students. They have excellent arts departments and match your profile.",
      cta: "Explore Selected Schools",
    },
    chatSnippet: {
      user: "Do liberal arts colleges offer real value compared to big universities?",
      yaar: "Yes, Sabrina! For international students on a budget, liberal arts colleges are actually a goldmine. They focus exclusively on undergraduates, meaning all their research opportunities, funding, and career guidance go directly to you, not graduate students.",
    },
  },
];

function InteractiveSandbox() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"next" | "opps" | "chat">("next");

  const p = SANDBOX_PERSONAS[activeIdx];

  return (
    <div className="mx-auto mt-12 max-w-5xl">
      {/* Selector Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SANDBOX_PERSONAS.map((item, idx) => (
          <button
            key={item.name}
            onClick={() => {
              setActiveIdx(idx);
              setActiveTab("next");
            }}
            className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 cursor-pointer ${
              activeIdx === idx
                ? "border-brand-500 bg-surface shadow-glow"
                : "border-line bg-surface/50 hover:bg-surface hover:shadow-soft"
            }`}
          >
            <div className="text-3xl">{item.avatar}</div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">{item.tag}</span>
              <h3 className="text-base font-bold text-ink">{item.name}</h3>
              <p className="text-xs text-muted mt-0.5 truncate">{item.stats}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Screen Device Mockup */}
      <div className="mt-8 rounded-3xl border border-line bg-surface shadow-lift overflow-hidden">
        {/* Device Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line bg-surface-2/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{p.avatar}</span>
            <div>
              <div className="text-sm font-semibold text-ink">{p.name}'s Yaar Workspace</div>
              <div className="text-xs text-muted flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Tailoring Layer
              </div>
            </div>
          </div>
          {/* Device Tabs */}
          <div className="flex gap-1.5 rounded-xl bg-surface-2 p-1 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("next")}
              className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                activeTab === "next" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Recommended Step
            </button>
            <button
              onClick={() => setActiveTab("opps")}
              className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                activeTab === "opps" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Opportunity Drop
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                activeTab === "chat" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Counselor Chat
            </button>
          </div>
        </div>

        {/* Device Content Screen */}
        <div className="relative min-h-[280px] bg-bg/40 p-6 md:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-violet-500/5 pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx + "_" + activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10"
            >
              {activeTab === "next" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold uppercase tracking-wider text-brand-500">Suggested Action Plan</span>
                    <span>Progress: {p.nextStep.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${p.nextStep.progress}%` }} />
                  </div>
                  
                  <div className="rounded-2xl border border-brand-500/20 bg-surface p-6 shadow-soft">
                    <span className="badge bg-brand-500/12 text-brand-600 dark:text-brand-400 capitalize">{p.nextStep.module}</span>
                    <h4 className="mt-3 font-display text-lg font-bold text-ink">{p.nextStep.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{p.nextStep.why}</p>
                    <button className="btn-primary mt-5" disabled>
                      Let's do it 🚀 (Interactive Mock)
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "opps" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold uppercase tracking-wider text-amber-500">Weekly Personal Nudges</span>
                    <span className="badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">new update</span>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`badge capitalize ${p.opportunity.kind === "opportunity" ? "bg-brand-500/12 text-brand-500" : "bg-amber-500/12 text-amber-600"}`}>
                        {p.opportunity.kind}
                      </span>
                      <span className="badge bg-emerald-500/10 text-emerald-600">live AI tailored</span>
                    </div>
                    <h4 className="font-semibold text-ink text-base">{p.opportunity.title}</h4>
                    <p className="text-sm leading-relaxed text-muted">{p.opportunity.body}</p>
                    <button className="btn-ghost mt-2" disabled>
                      {p.opportunity.cta}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "chat" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold uppercase tracking-wider text-violet-500">Mock Advisor Chat</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Always Online</span>
                  </div>
                  
                  <div className="space-y-4 rounded-2xl border border-line bg-surface/50 p-5 shadow-inner">
                    {/* Student bubble */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white text-slate-900 px-4 py-2.5 text-sm shadow-sm border border-line">
                        {p.chatSnippet.user}
                      </div>
                    </div>
                    {/* Yaar bubble */}
                    <div className="flex justify-start gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-xs font-bold text-slate-900 mt-1">Y</span>
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gradient-to-br from-brand-500 to-violet-500 text-white px-4 py-2.5 text-sm shadow-sm leading-relaxed">
                        {p.chatSnippet.yaar}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-bg">
      {/* Hero — deep premium navy with vibrant gradient energy */}
      <header className="relative overflow-hidden bg-brand-950 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(60%_50%_at_12%_8%,rgba(99,102,241,0.5)_0,transparent_60%),radial-gradient(50%_45%_at_88%_5%,rgba(217,70,239,0.32)_0,transparent_55%),radial-gradient(45%_45%_at_75%_95%,rgba(251,191,36,0.2)_0,transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:64px_64px]" />

        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <img src="/star.svg" alt="" className="h-7 w-7 [filter:brightness(0)_invert(1)]" />
            <span className="font-display text-xl font-extrabold tracking-tight">Yaar</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/app" className="btn-gold">Start free</Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-10 lg:grid-cols-2 lg:pt-16">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="badge gap-2 bg-white/10 text-brand-100 ring-1 ring-white/20"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />
              "Yaar" means buddy. That's the whole idea.
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mx-auto mt-6 max-w-xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:mx-0"
            >
              Your hometown to a{" "}
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-fuchsia-300 bg-clip-text text-transparent">US degree</span>
              — with a buddy who never takes a cut.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-brand-100 lg:mx-0"
            >
              No agents. No commissions. No bias. An AI that runs your whole study-abroad journey,
              gives every student the same world-class shot, and costs a fraction of a consultancy.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            >
              <Link to="/app" className="btn-gold px-6 py-3 text-base">Start free — no card</Link>
              <Link to="/app/visa" className="btn px-6 py-3 text-base text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/10">
                Try a mock visa interview
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-7 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
            >
              {["🇳🇵 Nepal", "🇮🇳 India", "🇧🇩 Bangladesh", "+ South Asia"].map((c) => (
                <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15">
                  {c}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: live chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <ChatPreview />
          </motion.div>
        </div>

        <div className="relative h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </header>

      {/* Personas — relatable */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-b border-line">
        <Reveal>
          <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">Built for students like you</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted">
            Yaar reads your situation and adapts the whole plan. Select a profile below to preview how Yaar tailors the study-abroad journey.
          </p>
        </Reveal>
        <InteractiveSandbox />
      </section>

      {/* USP */}
      <section className="border-y border-line bg-surface-2/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-6 md:grid-cols-3"
          >
            {USP.map((c) => (
              <motion.div key={c.t} variants={staggerItem} className="card transition-shadow duration-300 hover:shadow-lift">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-fuchsia-500/15 text-brand-500">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={c.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Compare */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <Reveal>
          <h2 className="mb-8 text-center font-display text-2xl font-bold text-ink sm:text-3xl">
            Why students ghost the consultancy
          </h2>
          <Compare />
        </Reveal>
      </section>

      {/* Journey */}
      <section className="border-y border-line bg-surface-2/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="mb-2 text-center font-display text-2xl font-bold text-ink sm:text-3xl">Zero to hero, one buddy</h2>
            <p className="mb-12 text-center text-muted">Every step of the journey, handled for you.</p>
          </Reveal>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {JOURNEY.map((j) => (
              <motion.div key={j.step} variants={staggerItem} className="group card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="font-display text-sm font-bold text-vibe">{j.step}</div>
                <div className="mt-1 text-lg font-semibold text-ink">{j.title}</div>
                <div className="mt-1 text-sm text-muted">{j.text}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl overflow-hidden px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Your dream school is closer than an agent's fee.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Start free today. Yaar figures out your next best step and walks you through it — like a friend who actually knows the system.
          </p>
          <Link to="/app" className="btn-primary mt-8 px-8 py-3.5 text-base">Start free — it takes 2 minutes</Link>
          <p className="mx-auto mt-8 max-w-xl text-xs leading-relaxed text-faint">
            Yaar is a coaching and information tool. It is not legal or immigration advice, and outcomes are never guaranteed.
          </p>
        </Reveal>
      </section>
    </div>
  );
}

function Compare() {
  const rows: [string, boolean, boolean | "partly"][] = [
    ["Available 24/7, instant", true, false],
    ["Same quality for every student", true, false],
    ["Unbiased, no school commissions", true, false],
    ["Unlimited practice and revisions", true, false],
    ["Costs a fraction of agency fees", true, false],
    ["Handles your whole journey", true, "partly"],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="grid grid-cols-3 bg-surface-2 px-5 py-3.5 text-sm font-semibold text-muted">
        <div>What matters</div>
        <div className="text-center text-vibe">Yaar</div>
        <div className="text-center">Typical consultancy</div>
      </div>
      {rows.map(([label, a, b], i) => (
        <div key={i} className="grid grid-cols-3 items-center border-t border-line px-5 py-3.5 text-sm">
          <div className="text-ink">{label}</div>
          <div>{a === true ? <Check /> : <Cross />}</div>
          <div className="text-center">
            {b === true ? <Check /> : b === "partly" ? <span className="text-sm font-semibold text-gold-500">Partly</span> : <Cross />}
          </div>
        </div>
      ))}
    </div>
  );
}
