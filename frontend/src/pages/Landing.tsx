// Public landing. Short, honest, fast — no long animated sections, no fake
// testimonials. The job: in five seconds, make a skeptical student trust this
// enough to tap "Start free".
import { Link } from "react-router-dom";
import { getUser } from "../lib/progress";
import ThemeToggle from "../components/ThemeToggle";

const ROWS: { to: string; icon: JSX.Element; title: string; line: string }[] = [
  {
    to: "/app/visa",
    title: "Practice your visa interview",
    line: "An AI officer probes your ties, funds, and study plan, then scores you honestly.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m-2.5-6.5a2 2 0 0 0-1 0L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-5.5-2.5z" /></svg>
    ),
  },
  {
    to: "/app/practice",
    title: "Get scored on IELTS & TOEFL",
    line: "Real exam-style sections, graded on the actual rubrics. Free and unlimited.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
    ),
  },
  {
    to: "/app",
    title: "Find out if you can afford it",
    line: "Ask Yaar honestly about costs, aid, and which schools actually fund students like you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
    ),
  },
];

export default function Landing() {
  const user = getUser();
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <img src="/star.svg" alt="" className="h-6 w-6 dark:[filter:brightness(0)_invert(1)]" />
            <span className="font-display text-base font-extrabold tracking-tight">Yaar</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5">
        {/* Hero */}
        <section className="pt-12 pb-10 text-center sm:pt-16">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Your honest guide to US universities.{" "}
            <span className="text-brand-600 dark:text-brand-400">Free, forever.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted">
            An agency charges a lakh and a half and takes a cut from the schools it pushes. Yaar is free, and works only
            for you.
          </p>
          <Link to="/app" className="btn-primary mt-7 inline-block px-7 py-3 text-base">
            {user ? "Continue where you left off" : "Start free — no signup needed"}
          </Link>
          <p className="mt-3 text-xs text-faint">No commissions. No human agents. No one's name to sell you anything.</p>
        </section>

        {/* What it does — three plain rows */}
        <section className="space-y-3 pb-12">
          {ROWS.map((r) => (
            <Link key={r.title} to={r.to} className="card flex items-start gap-4 transition hover:border-brand-400 hover:shadow-lift">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <span className="h-5 w-5">{r.icon}</span>
              </span>
              <span>
                <span className="block font-display text-base font-bold">{r.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{r.line}</span>
              </span>
            </Link>
          ))}
        </section>

        <p className="mx-auto max-w-md pb-8 text-center text-xs leading-relaxed text-faint">
          Yaar is a coaching and information tool, not legal or immigration advice. Outcomes are never guaranteed.
        </p>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-faint sm:flex-row">
          <span>Yaar · free and open source, built for students</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/feedback" className="hover:text-ink">Report a problem</Link>
            <Link to="/evals" className="hover:text-ink">Evals</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
