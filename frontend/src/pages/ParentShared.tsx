import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ParentReport } from "../api/client";
import { Spinner } from "../components/ui";
import ParentReportView from "../components/ParentReportView";

// Public, no-login page a parent opens from a shared link. Standalone (no app chrome).
export default function ParentShared() {
  const { token } = useParams();
  const [report, setReport] = useState<ParentReport | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) return;
    api
      .getSharedParentReport(token)
      .then((r) => {
        setReport(r.report);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-5 py-4">
          <img src="/star.svg" alt="" className="h-6 w-6 dark:[filter:brightness(0)_invert(1)]" />
          <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
          <span className="ml-auto text-xs text-faint">An honest update from your child's AI counselor</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        {state === "loading" && <div className="card"><Spinner label="Loading the update..." /></div>}

        {state === "error" && (
          <div className="card text-center">
            <div className="text-4xl">🔗</div>
            <p className="mt-3 text-muted">This link is invalid or has expired. Ask your child to share a fresh one from Yaar.</p>
          </div>
        )}

        {state === "ok" && report && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">An update on {report.childName}</h1>
              <p className="mt-1 text-sm text-muted">Written by Yaar, the AI counselor who works only for {report.childName}, never for any school.</p>
            </div>
            <ParentReportView report={report} />
            <div className="card text-center">
              <p className="text-sm text-muted">Want to support your child's journey?</p>
              <Link to="/" className="btn-primary mt-3 inline-flex">See how Yaar helps</Link>
            </div>
            <p className="text-center text-xs text-faint">Yaar is a coaching and information tool, not legal or immigration advice. Outcomes are never guaranteed.</p>
          </div>
        )}
      </main>
    </div>
  );
}
