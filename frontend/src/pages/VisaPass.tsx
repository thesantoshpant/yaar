// Public, no-login Visa Pass page. Decodes the pass payload from the URL hash
// (never sent to the server) and renders the shared card with real share rails.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import VisaPassCard, { decodePass, type PassData } from "../components/VisaPassCard";

export default function VisaPass() {
  const loc = useLocation();
  const [pass, setPass] = useState<PassData | null>(null);

  useEffect(() => {
    setPass(decodePass());
  }, [loc.hash]);

  if (!pass) {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-xl pt-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Visa Pass</h1>
          <p className="mt-2 text-muted">Run a free mock visa interview to generate your own.</p>
          <Link to="/app/visa" className="btn-primary mt-6 inline-block">Practice my visa interview</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10 text-ink">
      <VisaPassCard pass={pass} />
      <div className="mx-auto mt-6 max-w-sm text-center">
        <Link to="/app/visa" className="btn-primary inline-block">Practice yours free →</Link>
        <p className="mt-4 text-xs text-faint">A practice score, not a prediction. Real interviews depend on many things only the consular officer can weigh.</p>
      </div>
    </div>
  );
}
