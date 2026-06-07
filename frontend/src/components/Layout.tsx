import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import ErrorBoundary from "./ErrorBoundary";

// Lightweight inline SVG icons (no icon-font download — kinder to weak connections).
type IconProps = { className?: string };
const I = (d: string) => (p: IconProps) =>
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true">
      <path d={d} />
    </svg>
  );

// Exactly four student destinations. Order = the journey: ask → practice → visa → parents.
const NAV: { to: string; label: string; end?: boolean; Icon: (p: IconProps) => JSX.Element }[] = [
  { to: "/app", label: "Ask Yaar", end: true, Icon: I("M21 11.5a8.38 8.38 0 0 1-9 8.34 9 9 0 0 1-3.5-.66L3 21l1.82-5.5A8.38 8.38 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z") },
  { to: "/app/practice", label: "Practice", Icon: I("M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11") },
  { to: "/app/visa", label: "Visa", Icon: I("M9 12l2 2 4-4m-2.5-6.5a2 2 0 0 0-1 0L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-5.5-2.5z") },
  { to: "/app/parents", label: "Parents", Icon: I("M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0-4 0M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z") },
];

function Gear({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Active = teal icon + label, inactive = muted. No heavy highlight (per the design system).
const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors lg:flex-row lg:gap-2 lg:text-sm ${
    isActive ? "text-brand-600 dark:text-brand-400" : "text-faint hover:text-ink"
  }`;

export default function Layout() {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Top bar: logo + (desktop) the 4 links + a settings gear. */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/star.svg" alt="" className="h-6 w-6 dark:[filter:brightness(0)_invert(1)]" />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                <n.Icon className="h-[18px] w-[18px]" />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/app/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                isActive ? "text-brand-600 dark:text-brand-400" : "text-faint hover:text-ink"
              }`
            }
          >
            <Gear className="h-5 w-5" />
          </NavLink>
        </div>
      </header>

      {/* Centered, phone-width column. Extra bottom padding clears the mobile nav bar. */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-6 lg:pb-12">
          <motion.div
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      {/* Mobile bottom nav — the whole student app in four taps. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
              <n.Icon className="h-6 w-6" />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
