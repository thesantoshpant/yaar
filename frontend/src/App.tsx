import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Updates from "./pages/Updates";
import Counselor from "./pages/Counselor";
import Roadmap from "./pages/Roadmap";
import SchoolSearch from "./pages/SchoolSearch";
import Applications from "./pages/Applications";
import SpeakingPractice from "./pages/SpeakingPractice";
import VisaSimulator from "./pages/VisaSimulator";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="updates" element={<Updates />} />
        <Route path="counselor" element={<Counselor />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="schools" element={<SchoolSearch />} />
        <Route path="applications" element={<Applications />} />
        <Route path="speaking" element={<SpeakingPractice />} />
        <Route path="visa" element={<VisaSimulator />} />
      </Route>
    </Routes>
  );
}
