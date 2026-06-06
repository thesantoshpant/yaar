# Yaar — Demo & Setup Guide

**Yaar is an autonomous, structurally unbiased AI counselor that takes an international
student from their hometown to a US degree and an approved F-1 visa, and it's run by a
team of AI employees.** No human agents, no school commissions, so its only incentive is
the student's best outcome. It remembers each student, adapts to very different journeys,
and even keeps their parents in the loop in their own language.

## Why it can win
- **Memory MOAT.** A per-student "mind" (MongoDB) is built from every chat, document, and
  win, and feeds every feature, so advice compounds instead of resetting.
- **Fully autonomous company.** AI employees (CEO, analytics, marketing, growth, support,
  and a dedicated Memory agent) meet, debate, decide, and act through an Action Gateway
  with a human-approval valve and an eval/QA reviewer.
- **Honest + unbiased by construction.** Document-grounded visa risk reports, balanced
  school lists ranked on real outcomes (US Dept of Education data), never pay-to-rank.
- **Real Gemini, end to end.** Runs on Vertex AI; multimodal document understanding,
  per-feature personalization, and multi-agent reasoning.

## Run it locally
1. **Backend:** `cd backend && npm install && npm run dev` (listens on :4000).
   - Copy `backend/.env.example` to `backend/.env`. The app runs WITHOUT keys (mock mode).
     For live AI either set `GEMINI_API_KEY`, or use Vertex AI with
     `GEMINI_USE_VERTEX=true`, `GOOGLE_CLOUD_PROJECT`, and
     `GOOGLE_APPLICATION_CREDENTIALS` (a service-account JSON).
   - Optional: `MONGODB_URI` (else in-memory), `COLLEGE_SCORECARD_API_KEY` (live school
     data), `GOOGLE_CLIENT_ID` + `JWT_SECRET` (sign-in), `RESEND_API_KEY` + `RESEND_FROM`
     (real email; otherwise emails are simulated).
2. **Frontend:** `cd frontend && npm install && npm run dev` (Vite on :5173).
   - Optional `frontend/.env` with `VITE_GOOGLE_CLIENT_ID` to enable the sign-in gates.
3. Open `http://localhost:5173`.

## Health check
`node scripts/smoke.mjs` (with the backend running) hits every key endpoint, asserts the
responses, and prints whether each AI feature is live (`gemini`) or `mock`. Exit code is
non-zero if anything fails, so run it right before a demo.

## 3-minute judge demo script
1. **Land + the story (20s).** Open `/`. Scroll to "Not just a chatbot, a company that
   works for you": memory, an AI-run company, parent updates.
2. **Become a real student instantly (20s).** Go to `/app`, click a sample student
   (e.g. "Ramesh — rural, first-gen"). This loads a full profile, memory, a logged
   activity, and a recommended next step. (Shows Yaar adapts to different journeys.)
3. **The mind (20s).** Open **Mind**. Show the synthesized brief + the facts Yaar
   extracted. Hit "Refresh my mind" to show the Memory agent re-synthesize live.
4. **Document-grounded visa report (35s).** Open **Visa simulator**, upload an I-20
   (PDF/photo). Gemini extracts the fields and the report flags real issues (cost vs.
   funds, missing sponsor, wrong I-20 type). This is the flagship feature, free like
   everything else.
5. **What-if (20s).** On the Dashboard, "Play out a what-if" -> "raise my budget to $30k".
   Watch the plan and school options shift, grounded in this student's memory.
6. **Parent mode (25s).** Open **For parents**, pick a language (try Nepali), generate the
   update, copy the share link, open it (`/parent/:token`) in a new tab: a no-login,
   plain-language report a parent actually understands.
7. **The autonomous company (40s).** Open **Company HQ**. Run a boardroom on a real topic.
   Watch the CEO open, departments debate (referencing each other by name), the CEO decide
   and assign tasks, and the eval/QA agent approve, all from real KPIs, with the action
   queue and autonomy mode (dry-run/assist/live) visible.

## Notes
- Branch `yaar-autobuild` holds the autonomous build; `main` is the pre-session checkpoint.
- Secrets (`.env`, `credentials/`, the sample I-20) are gitignored and never committed.
- Voice mode (Gemini Live) is scaffolded; see AUTONOMOUS_PLAN.md for status.
