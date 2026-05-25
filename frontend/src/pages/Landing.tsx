import { Link } from "react-router-dom";

const JOURNEY = [
  { step: "01", title: "Roadmap", text: "An honest plan for your tests, timeline, and budget." },
  { step: "02", title: "Test prep", text: "Unlimited TOEFL and IELTS speaking practice, scored instantly." },
  { step: "03", title: "School search", text: "A balanced list from real data, never from who pays us." },
  { step: "04", title: "Applications", text: "Common App setup and essays drafted for each school." },
  { step: "05", title: "Finances and I-20", text: "Organize funding proof the right way." },
  { step: "06", title: "Visa", text: "Practice your F-1 interview until you are ready." },
];

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="grid grid-cols-3 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600">
        <div>What matters</div>
        <div className="text-center text-brand-700">Yaar</div>
        <div className="text-center">Typical consultancy</div>
      </div>
      {rows.map(([label, a, b], i) => (
        <div key={i} className="grid grid-cols-3 items-center border-t border-slate-100 px-5 py-3 text-sm">
          <div className="text-slate-700">{label}</div>
          <div className="text-center text-lg">{a === true ? "✅" : "—"}</div>
          <div className="text-center text-lg text-slate-500">
            {b === true ? "✅" : b === "partly" ? "½" : "❌"}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden bg-brand-950 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#4f46e5_0,transparent_40%),radial-gradient(circle_at_80%_0,#312e81_0,transparent_35%)]" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <img src="/star.svg" alt="" className="h-7 w-7 [filter:brightness(0)_invert(1)]" />
            <span className="text-xl font-extrabold tracking-tight">Yaar</span>
          </div>
          <Link to="/app" className="btn-gold">
            Start free
          </Link>
        </nav>
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-12 text-center">
          <span className="badge bg-white/10 text-brand-100 ring-1 ring-white/20">
            Fully autonomous. Built with Gemini.
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            The honest AI counselor that takes you from your hometown to a US degree.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100">
            No human agents. No school commissions. No bias. An AI that runs your entire study-abroad
            journey, gives every student the same world-class guidance, and costs a fraction of a consultancy.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/app" className="btn-gold px-6 py-3 text-base">
              Start your journey free
            </Link>
            <Link to="/app/visa" className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/20">
              Try the visa interview simulator
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-200">
            For students in Nepal, India, and across South Asia applying to US universities.
          </p>
        </div>
      </header>

      {/* USP */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              t: "Fully autonomous",
              d: "AI does the work end to end: it plans, drills you, searches schools, drafts essays, and runs mock interviews. It keeps moving even while you sleep.",
            },
            {
              t: "Structurally unbiased",
              d: "Consultancies earn commissions from schools. We earn nothing from schools, ever. Our only job is your best outcome.",
            },
            {
              t: "Equal for everyone",
              d: "Same elite guidance whether your family has connections or not. Infinite capacity, available 24/7, in your language.",
            },
          ].map((c) => (
            <div key={c.t} className="card">
              <h3 className="text-lg font-bold text-slate-900">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">
          Why students leave the consultancy
        </h2>
        <Compare />
      </section>

      {/* Journey */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">Zero to hero, one counselor</h2>
          <p className="mb-10 text-center text-slate-600">Every step of the journey, handled by the AI.</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {JOURNEY.map((j) => (
              <div key={j.step} className="card">
                <div className="text-sm font-bold text-brand-500">{j.step}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{j.title}</div>
                <div className="mt-1 text-sm text-slate-600">{j.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900">Your dream school is closer than a consultancy fee.</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Start free today. The AI will figure out your next best step and walk you through it.
        </p>
        <Link to="/app" className="btn-primary mt-8 px-8 py-3 text-base">
          Start free
        </Link>
        <p className="mt-6 text-xs text-slate-400">
          Yaar is a coaching and information tool. It is not legal or immigration advice, and outcomes are
          never guaranteed.
        </p>
      </section>
    </div>
  );
}
