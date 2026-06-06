import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api, type HealthMode } from "../api/client";
import ErrorBoundary from "./ErrorBoundary";
import { getProfileId } from "../lib/progress";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";

type IconProps = { className?: string };
const I = (d: string) => (p: IconProps) =>
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true">
      <path d={d} />
    </svg>
  );

// Trimmed nav. The council ruled: hide Updates, Roadmap, School search, Coaches,
// and Evidence vault from the sidebar. Their routes still resolve so existing links
// and the agent-driven nudge engine keep working; they're just no longer surface area
// for the user. Order below is the journey flow: chat -> prep -> apply -> visa -> parents -> company.
const NAV: { to: string; label: string; end?: boolean; Icon: (p: IconProps) => JSX.Element }[] = [
  { to: "/app", label: "Dashboard", end: true, Icon: I("M3 12l9-9 9 9M5 10v10h14V10") },
  { to: "/app/counselor", label: "Counselor", Icon: I("M21 11.5a8.38 8.38 0 0 1-9 8.34 9 9 0 0 1-3.5-.66L3 21l1.82-5.5A8.38 8.38 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z") },
  { to: "/app/memory", label: "Mind", Icon: I("M9.5 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 9.5 18 2.5 2.5 0 0 0 12 15.5V6.5A2.5 2.5 0 0 0 9.5 4zm5 0A2.5 2.5 0 0 0 12 6.5v9a2.5 2.5 0 0 0 2.5 2.5 3 3 0 0 0 4-5.2 3 3 0 0 0-1-5.8 3 3 0 0 0-3-3z") },
  { to: "/app/progress", label: "Progress", Icon: I("M3 3v18h18M7 14l4-4 3 3 5-6") },
  { to: "/app/mock", label: "Mock test", Icon: I("M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11") },
  { to: "/app/speaking", label: "Speaking prep", Icon: I("M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3") },
  { to: "/app/applications", label: "Applications", Icon: I("M14 3v5h5M9 13h6M9 17h6M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z") },
  { to: "/app/visa", label: "Visa simulator", Icon: I("M9 12l2 2 4-4m-2.5-6.5a2 2 0 0 0-1 0L5 6v6c0 4 3 7 7 8 4-1 7-4 7-8V6l-5.5-2.5z") },
  { to: "/app/parent", label: "For parents", Icon: I("M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0-4 0M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z") },
  { to: "/app/company", label: "Company", Icon: I("M3 21h18M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 21V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v12M8 8h2M8 12h2M8 16h2") },
];

export default function Layout() {
  const [mode, setMode] = useState<HealthMode | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const reduce = useReducedMotion();

  // Company HQ is the founder's ops console: its API is admin-gated in
  // production, so showing it to students would just be a locked door in their
  // nav. Visible in local dev (the backend trusts localhost) or once an admin
  // token is stored; the direct /app/company URL always works.
  const isAdminish =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
    Boolean(localStorage.getItem("yaar.adminToken"));
  const nav = NAV.filter((n) => n.to !== "/app/company" || isAdminish);

  useEffect(() => {
    api.health().then((h) => setMode(h.mode)).catch(() => setMode(null));
    const id = getProfileId();
    if (id) api.getInbox(id).then((r) => setUnread(r.unread)).catch(() => {});
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src="/star.svg" alt="" className="h-7 w-7 [filter:brightness(0)_invert(1)]" />
          <span className="font-display text-lg font-extrabold tracking-tight text-white">Yaar</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="px-4 pb-3">
        <AuthButton />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-gold-500 text-gold-ink shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <n.Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-gold-ink" : "text-white/60 group-hover:text-white"}`} />
                <span className="flex-1">{n.label}</span>
                {n.to === "/app/updates" && unread > 0 && (
                  <span className={`badge ${isActive ? "bg-gold-ink/20 text-gold-ink" : "bg-coral-500 text-white"}`}>{unread}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4">
        {mode && (
          <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-xs text-white/80">
            <div className="mb-1 font-semibold text-white">System</div>
            <SysRow label="AI" ok={mode.gemini === "live"} on="live Gemini" off="demo mode" />
            <SysRow label="Schools" ok={mode.collegeScorecard === "live"} on="live data" off="demo data" />
            <div className="flex items-center justify-between">
              <span>Database</span>
              <span className="font-medium text-white">{mode.db}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src="/star.svg" alt="" className="h-6 w-6 dark:[filter:brightness(0)_invert(1)]" />
          <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-brand-700 bg-brand-600 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {Sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-brand-700 bg-brand-600 lg:block lg:w-64 lg:shrink-0">
        {Sidebar}
      </aside>

      <main className="flex-1 bg-bg">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SysRow({ label, ok, on, off }: { label: string; ok: boolean; on: string; off: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-emerald-500" : "text-amber-500"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        {ok ? on : off}
      </span>
    </div>
  );
}
