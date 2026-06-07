import { Routes, Route, Navigate } from "react-router-dom";
import { ProfileProvider } from "./lib/profile";
import { AuthGateProvider } from "./lib/authGate";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
// The 4 student screens. During the redesign these point at the existing pages;
// each phase swaps in the rebuilt screen. Ask Yaar (chat) is the home.
import Counselor from "./pages/Counselor"; // → Ask Yaar home (Phase 1)
import MockTest from "./pages/MockTest"; // → Practice (Phase 3)
import VisaSimulator from "./pages/VisaSimulator"; // → Visa flow (Phase 2)
import Parent from "./pages/Parent"; // → For parents (Phase 4)
import Memory from "./pages/Memory"; // → Settings (Phase 5)
import Company from "./pages/Company"; // admin ops, off the student nav
// Public + share pages.
import ParentShared from "./pages/ParentShared";
import VisaPass from "./pages/VisaPass";
import Privacy from "./pages/Privacy";
import Feedback from "./pages/Feedback";
import Evals from "./pages/Evals";
import MockCard from "./pages/MockCard";
import Wrapped from "./pages/Wrapped";
import Pulse from "./pages/Pulse";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/parent/:token" element={<ParentShared />} />
      <Route path="/visa-pass" element={<VisaPass />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/evals" element={<Evals />} />
      <Route path="/mock-card" element={<MockCard />} />
      <Route path="/wrapped" element={<Wrapped />} />
      <Route path="/pulse" element={<Pulse />} />
      <Route path="/app" element={<ProfileProvider><AuthGateProvider><Layout /></AuthGateProvider></ProfileProvider>}>
        {/* The four screens + off-nav Settings. */}
        <Route index element={<Counselor />} />
        <Route path="practice" element={<MockTest />} />
        <Route path="visa" element={<VisaSimulator />} />
        <Route path="parents" element={<Parent />} />
        <Route path="settings" element={<Memory />} />
        <Route path="company" element={<Company />} />
        {/* Redirect old deep links so existing bookmarks/shares don't 404. */}
        <Route path="counselor" element={<Navigate to="/app" replace />} />
        <Route path="mock" element={<Navigate to="/app/practice" replace />} />
        <Route path="speaking" element={<Navigate to="/app/practice" replace />} />
        <Route path="memory" element={<Navigate to="/app/settings" replace />} />
        <Route path="parent" element={<Navigate to="/app/parents" replace />} />
        {/* Anything else under /app (old roadmap/schools/coaches/etc.) → home. */}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
