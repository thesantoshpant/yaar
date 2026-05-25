# Yaar

The honest, fully autonomous AI counselor that takes an international student from their hometown to a US
degree and an approved F-1 visa. No human agents, no school commissions, no bias.

Built for the Build with Gemini XPRIZE. React frontend + Node.js backend, deep Gemini integration, and graceful
mock fallbacks so the whole app runs and demos **before any API keys are added**.

---

## Quick start (for collaborators)

Prereqs: **Node 18+** (developed on Node 24) and npm. MongoDB and API keys are all optional (see below).

```bash
# 1. clone
git clone https://github.com/Santoshpant23/yaar.git
cd yaar

# 2. backend (terminal 1)
cd backend
npm install
cp .env.example .env        # optional: fill in keys to go live; works empty in mock mode
npm run dev                 # http://localhost:4000

# 3. frontend (terminal 2)
cd frontend
npm install
cp .env.example .env        # optional
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173. Landing page is at `/`, the app at `/app`.

On Windows PowerShell, replace `cp` with `Copy-Item`.

---

## It runs with zero setup (mock / guest mode)

With no keys at all:
- Gemini calls return deterministic, useful **mock** responses (badged "demo mode" in the UI).
- School search returns a curated list of real US universities.
- Data is kept in memory and resets on restart.
- Auth is disabled (guest mode); payments are unlocked for free.

The sidebar shows the current mode, and every AI result is badged `live` vs `demo`. Check `GET /api/health` for
the same flags.

---

## Environment variables (all optional)

All live in `backend/.env` except the last, which is `frontend/.env`. Copy each `.env.example` and fill what you have.

| Variable | What it unlocks | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Live AI across every module | https://aistudio.google.com/apikey |
| `COLLEGE_SCORECARD_API_KEY` | Live US school data in search | https://api.data.gov/signup/ (free, instant) |
| `MONGODB_URI` | Persistent storage (else in-memory) | local Mongo or free MongoDB Atlas |
| `GOOGLE_CLIENT_ID` + `JWT_SECRET` | Google sign-in (else guest mode) | Google Cloud Console → OAuth 2.0 Web client |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_USD` | Paid visa risk report (else free) | Stripe dashboard |
| `PUBLIC_URL` | Stripe redirect target | your frontend URL (default `http://localhost:5173`) |
| `VITE_GOOGLE_CLIENT_ID` (frontend) | Shows the Google sign-in button | same client ID as the backend |

---

## What's inside

Journey modules, each driven by an AI agent:
- **Dashboard** — the autonomous counselor brain that decides the student's single best next step, and a persona intake.
- **Updates** — a proactive inbox: weekly personalized opportunity drops and "did you do it?" follow-ups.
- **Counselor** — an always-on, unbiased chat advisor with per-student memory.
- **Roadmap** — an honest, realistic plan for tests, schools, finances, and the visa.
- **School search** — a balanced reach / match / safety list from public College Scorecard data.
- **Applications** — SOP and Common App essay drafting.
- **Speaking practice** — TOEFL / IELTS speaking, scored against the official rubric.
- **Visa simulator** — a document-grounded **risk report** plus a mock F-1 interview, scored honestly.

Personal-intelligence layer: a persona classifier (rural/first-gen vs urban etc.), per-student memory (facts +
timeline) injected into prompts, an opportunity engine (incl. self-startable "no-club" initiatives), and a
node-cron proactive engine.

## Tech

- **Frontend:** React + Vite + TypeScript + Tailwind CSS.
- **Backend:** Node.js + Express + TypeScript (run via `tsx`).
- **AI:** Google Gemini (text, JSON, a Gemini Live voice relay scaffold).
- **Data:** MongoDB via Mongoose, with an in-memory fallback.
- **External data:** US College Scorecard API. **Auth:** Google sign-in (JWT). **Payments:** Stripe.

## Scripts

Backend (`/backend`): `npm run dev` (watch), `npm start`, `npm run typecheck`.
Frontend (`/frontend`): `npm run dev`, `npm run build`, `npm run preview`.

## API surface (selected)

- `GET  /api/health` — mode flags (gemini, scorecard, db, billing, auth)
- `POST /api/agent/plan` — autonomous next-best-action (persona + memory aware)
- `GET  /api/journey/:profileId` — the student's adaptive journey state
- `POST /api/engine/run-now/:profileId` — generate this week's personalized opportunity drop
- `GET  /api/engine/inbox/:profileId`, `PATCH /api/engine/action/:id` — inbox + follow-up loop
- `POST /api/counselor/chat`, `POST /api/roadmap`, `POST /api/schools/search`
- `POST /api/risk/report` — document-grounded visa risk report (the paid flagship)
- `POST /api/visa/next`, `POST /api/visa/score`, `POST /api/speaking/score`, `POST /api/applications/draft`
- `POST /api/auth/google`, `GET /api/auth/me` — Google sign-in
- `POST /api/billing/checkout`, `POST /api/billing/confirm` — Stripe

## Project structure

```
yaar/
  backend/    Express + TS API, agents, engine, models, services
  frontend/   React + Vite + TS + Tailwind app
```

## Status / known limitations

This is an active hackathon MVP. Notably: Google auth is wired but **not yet enforced** on routes (no per-user
data scoping yet); Stripe entitlements are in-memory; the visa report takes pasted document text (binary file
upload + multimodal extraction is the next step); no privacy policy / consent flow yet. See `STATUS.md` for the
running list.

## Note on autonomy and safety

Yaar is positioned as fully autonomous and structurally unbiased: the AI does the work and never earns
commissions from schools. It is a coaching and information tool, **not legal or immigration advice**, and it never
guarantees admission or visa outcomes.
