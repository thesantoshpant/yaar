# Yaar build status

Autonomous build session, May 25, 2026. Stack: React + Vite + TS + Tailwind (frontend), Node + Express + TS
via tsx (backend), Gemini for AI, MongoDB (with in-memory fallback), College Scorecard (with mock fallback).

## What works right now (verified)

- Backend builds (tsc --noEmit passes) and runs (`npm start`), confirmed listening on :4000.
- Frontend builds (`npm run build` passes, Tailwind purged to ~23kB CSS).
- All API endpoints smoke-tested in mock mode and returning correct shapes:
  - GET /api/health -> mode flags
  - POST /api/agent/plan -> autonomous next-best-action (the USP brain)
  - POST /api/counselor/chat -> counselor reply
  - POST /api/roadmap -> personalized roadmap
  - POST /api/schools/search -> balanced reach/match/safety list
  - POST /api/visa/next and /api/visa/score -> interview turns + scoring
  - POST /api/speaking/score -> speaking band + criteria
  - POST /api/applications/draft -> SOP / Common App essay draft
- Visa simulator accepts optional document context (paste I-20 / funding): the AI officer probes
  inconsistencies against it. This is the differentiator, working in text form today.
- Frontend pages built and wired to the backend: Landing, Dashboard (autonomous brain),
  Counselor, Roadmap, School search, Applications, Speaking practice, Visa simulator.
- The whole thing runs with NO API keys (mock mode), so it is demoable immediately.

## Personal intelligence + proactive engagement (added, verified live with Gemini + MongoDB)

The system now adapts to each student and proactively guides them, not just answers on demand.

- Persona classifier (`lib/classify.ts`): deterministic, turns a profile into an adaptive JourneyState
  (path, persona tags, pacing, stages). Verified: a rural first-gen Nepal student is classified
  `UG_RURAL_BOOTSTRAP`, patient pacing, tags rural_first_gen + aid_dependent + strong_stem_weak_english.
- Per-student memory: `memory_facts` + `events` collections, a context-pack (`services/contextPack.ts`)
  injected into the counselor and the agent brain so every reply is personal and continuous, plus
  fire-and-forget fact extraction after each chat (`services/memoryUpdate.ts`).
- Opportunity engine (`services/opportunityEngine.ts` + `data/opportunities.ts`): a seeded, verified set of
  free/low-bandwidth opportunities incl. self-startable "manufacture-an-extracurricular" initiatives; a gap
  analyzer + scorer + diversify picks a personalized weekly drop with a Gemini "why this fits you" + first step.
  Verified live: produced GSoC, MOSTEC, Kaggle, and a "build a GitHub project" initiative for the rural student.
- Proactive engagement (`services/engagement.ts` + `services/scheduler.ts`): node-cron weekly drop + twice-daily
  follow-up sweep ("did you do it?"); an Inbox the student reads; action items tracked; marking one done emits a
  celebration and a timeline event. The "Run my updates now" button triggers a drop on demand.
- New endpoints (all smoke-tested live): GET /api/journey/:id, POST /api/engine/run-now/:id,
  GET /api/engine/inbox/:id, PATCH /api/engine/inbox/:id/read, PATCH /api/engine/action/:id, POST /api/engine/followups.
- New frontend: persona intake on the Dashboard, an "Updates" page (the proactive feed) with run-now + follow-up
  buttons, and an unread badge in the nav.
- New collections: journeys, memory_facts, events, action_items, inbox_items (all with in-memory fallback).

## Trust, revenue, and auth (added after the external audit)

- Trust fixes: truthful visa-document privacy copy; Dashboard now PATCHes the backend profile on re-plan
  (not just first create); per-IP rate limiting on /api; school-search international-aid caveat; "New student" reset.
- Document-grounded visa RiskReport (the paid flagship), verified live: parses pasted I-20/admit/funding text via
  Gemini, extracts key fields, flags inconsistencies (e.g. funding below I-20 cost), scores readiness 0-100 with
  per-214(b)-dimension scores, weak points, and a recommendation. New models Document + RiskReport; route
  POST /api/risk/report (+ GET /api/risk/latest/:id); UI panel on the Visa page. Anonymous try-it path supported.
- Stripe (graceful): POST /api/billing/checkout + /confirm + /status. When STRIPE_SECRET_KEY is absent the report is
  unlocked for free; when present, the report returns a locked preview until paid, with an "Unlock full report"
  button that runs Stripe Checkout and confirms on return. Entitlements are in-memory for now (persist later).
- Google sign-in (graceful): POST /api/auth/google verifies the Google ID token (google-auth-library) and issues a
  JWT; GET /api/auth/me; User model. Frontend uses @react-oauth/google behind VITE_GOOGLE_CLIENT_ID; the client
  attaches the Bearer token. With no client id, the app runs in guest mode (sign-in hidden). Auth is additive and
  not yet enforced on routes; full per-user data scoping is the next step.
- /api/health now reports billing and auth mode. New env vars in .env.example (GOOGLE_CLIENT_ID, JWT_SECRET,
  STRIPE_SECRET_KEY, STRIPE_PRICE_USD, PUBLIC_URL; frontend VITE_GOOGLE_CLIENT_ID).

## Still open (priority order)
1. Enforce auth + scope all data by userId (auth is wired but not enforced yet).
2. Persist Stripe entitlements (currently in-memory) and add a webhook for reliability.
3. Real binary file upload (PDF/image) + Gemini multimodal extraction for the risk report (text paste works today).
4. Privacy policy, consent, and delete-my-data path before real users.
5. Wave 2/3 from the plan: Gap + EvidenceArtifact models, recommender coach, family/funding coach, Safe Arrival OS,
   F-1 Status Guard (informational), School Truth Layer, WhatsApp channel. Seed grad-level opportunities.

## How to run

See README.md. Short version: `npm install` then `npm run dev` in both `backend/` and `frontend/`.

## What is stubbed or needs work next

1. Gemini Live voice (services/geminiLive.ts) is a scaffold. It needs a real GEMINI_API_KEY, an audio-capable
   Live model, and a browser audio pipeline (mic capture -> 16kHz PCM over WS -> play 24kHz PCM back). The
   visa and speaking modules currently use the fully working text-turn fallback.
2. Real keys not yet added. Drop GEMINI_API_KEY and COLLEGE_SCORECARD_API_KEY into backend/.env to go live.
3. No auth yet. Profiles are created but there is no login. Add auth before real users.
4. MongoDB models: only Profile exists. Add Journey/Session, scores history, and documents collections.
5. Applications essay drafting agent is built (SOP + Common App). Still to add: recommender management,
   deadline/portal tracking, and a dedicated I-20 financial-doc organizer (Finances still routes to chat).
   Visa doc-grounding is text-paste today; next step is real file upload + Gemini multimodal extraction.
6. Payments (Stripe) not wired. Needed for the XPRIZE revenue evidence.
7. Document upload + multimodal grounding (parse a real I-20 / bank statement to ground the visa mock) is the
   key differentiator and is not built yet.
8. Voice capture UI, security review of PII handling, and rate limiting.

## Suggested next priorities (when you are back)

1. Add a GEMINI_API_KEY and confirm live JSON generation across roadmap / visa / speaking / agent.
2. Build the document-grounded visa mock (upload I-20 + bank doc, Gemini multimodal extracts, the officer
   probes inconsistencies). This is the wow feature and the moat.
3. Wire Stripe so the speaking and visa packs can take real payments (revenue evidence for the submission).
4. Stand up MongoDB Atlas and add the Journey model so progress persists per student.
