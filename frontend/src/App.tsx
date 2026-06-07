import { Routes, Route } from "react-router-dom";
import { ProfileProvider } from "./lib/profile";
import { AuthGateProvider } from "./lib/authGate";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Updates from "./pages/Updates";
import Counselor from "./pages/Counselor";
import Roadmap from "./pages/Roadmap";
import SchoolSearch from "./pages/SchoolSearch";
import Applications from "./pages/Applications";
import Coaches from "./pages/Coaches";
import Evidence from "./pages/Evidence";
import Memory from "./pages/Memory";
import Progress from "./pages/Progress";
import SpeakingPractice from "./pages/SpeakingPractice";
import MockTest from "./pages/MockTest";
import VisaSimulator from "./pages/VisaSimulator";
import Company from "./pages/Company";
import Parent from "./pages/Parent";
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
        <Route index element={<Dashboard />} />
        <Route path="updates" element={<Updates />} />
        <Route path="memory" element={<Memory />} />
        <Route path="progress" element={<Progress />} />
        <Route path="counselor" element={<Counselor />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="schools" element={<SchoolSearch />} />
        <Route path="applications" element={<Applications />} />
        <Route path="coaches" element={<Coaches />} />
        <Route path="evidence" element={<Evidence />} />
        <Route path="speaking" element={<SpeakingPractice />} />
        <Route path="mock" element={<MockTest />} />
        <Route path="visa" element={<VisaSimulator />} />
        <Route path="company" element={<Company />} />
        <Route path="parent" element={<Parent />} />
      </Route>
    </Routes>
  );
}
