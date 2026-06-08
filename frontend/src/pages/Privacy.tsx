// Plain-language privacy page. Honest and specific: what Yaar stores, what it
// never stores, and how to delete everything. No legalese a student can't read.
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Back to Yaar</Link>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">Privacy, in plain words</h1>
        <p className="mt-3 text-muted">
          Yaar is free and works for you, not for schools or advertisers. Here is exactly what happens with your information.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold">What Yaar stores</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
              <li>Your profile (name, country, goals, budget range) so advice fits you.</li>
              <li>Facts Yaar learns from your chats and practice, so it remembers you next time.</li>
              <li>Your practice history (mock test scores, interview scores) so you can see your progress.</li>
              <li>If you sign in with Google: your name and email, only to keep your data attached to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">What Yaar never stores</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
              <li>Your uploaded documents. When you upload an I-20, bank letter, or photo, Yaar reads it once to build your report and the file is gone when the request finishes. Only the report itself is saved, and only if you have a profile.</li>
              <li>Your voice recordings. Audio is transcribed and discarded.</li>
              <li>Card or payment details. There is nothing to pay.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Who sees your data</h2>
            <p className="mt-2 text-muted">
              Your text is processed by Google's Gemini models (on Google Cloud) to generate replies, scores, and reports.
              Nobody sells your data, shows you ads, or shares your information with schools, agents, or anyone else.
              A parent can only see the plain-language update you choose to share with them, through a link you create.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Delete everything</h2>
            <p className="mt-2 text-muted">
              You can erase everything Yaar knows about you, permanently, from <Link to="/app/settings" className="font-medium text-ink underline hover:no-underline">Settings</Link>
              {" "}inside the app (tap the gear, then "Delete everything Yaar knows about me"). It removes your profile, memory, history, reports, and progress.
              There is no retention after that.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Questions</h2>
            <p className="mt-2 text-muted">
              If anything here looks wrong or unclear, tell us through the{" "}
              <Link to="/feedback" className="font-medium text-ink underline hover:no-underline">report form</Link>{" "}
              and it will be fixed. No login needed.
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-faint">
          Yaar is a coaching and information tool, not legal or immigration advice. Outcomes are never guaranteed.
        </p>
      </div>
    </div>
  );
}
