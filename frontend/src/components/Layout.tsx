import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { api, type HealthMode } from "../api/client";
import { getProfileId } from "../lib/progress";
import AuthButton from "./AuthButton";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/updates", label: "Updates" },
  { to: "/app/counselor", label: "Counselor" },
  { to: "/app/roadmap", label: "Roadmap" },
  { to: "/app/schools", label: "School search" },
  { to: "/app/applications", label: "Applications" },
  { to: "/app/speaking", label: "Speaking prep" },
  { to: "/app/visa", label: "Visa simulator" },
];

export default function Layout() {
  const [mode, setMode] = useState<HealthMode | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api
      .health()
      .then((h) => setMode(h.mode))
      .catch(() => setMode(null));
    const id = getProfileId();
    if (id) api.getInbox(id).then((r) => setUnread(r.unread)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-r border-slate-200 bg-white lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-2 px-6 py-5">
          <img src="/star.svg" alt="" className="h-6 w-6" />
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Yaar
          </Link>
        </div>
        <div className="px-6 pb-3">
          <AuthButton />
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <span>{n.label}</span>
              {n.to === "/app/updates" && unread > 0 && (
                <span className="badge bg-brand-600 text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-6 py-4 lg:block">
          {mode && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <div className="font-semibold text-slate-600">System</div>
              <div>AI: {mode.gemini === "live" ? "live Gemini" : "demo mode"}</div>
              <div>Schools: {mode.collegeScorecard === "live" ? "live data" : "demo data"}</div>
              <div>DB: {mode.db}</div>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
