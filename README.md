# Yaar

A free, open-source AI counselor that takes an international student from their hometown to a US degree and an F-1 visa interview they're actually ready for. No human agents, no school commissions, no bias, and nothing to pay.

Most students in South Asia get their study-abroad advice from paid consultants who collect 15-25% commissions from the schools they recommend. Yaar exists so that advice is free, honest, and works only for the student.

**Free forever. There is no payment system in this codebase, on purpose.**

## What a student gets

- **A counselor that remembers you.** Every chat, practice score, and document feeds a persistent per-student memory, so advice compounds instead of resetting.
- **An autonomous next-step brain.** Yaar decides the single best next action for where you are: roadmap, test prep, school list, applications, finances, visa.
- **Full IELTS/TOEFL mock tests.** All four skills, adaptive to your weak areas, with evidence-quoted feedback and score history.
- **A document-grounded visa risk report.** Upload your I-20 / funding proof (photo or PDF); Yaar reads them the way a consular officer would and flags every gap before you walk in. Free, like everything else.
- **A mock F-1 interview** with an AI officer that cross-checks your answers against your documents.
- **Balanced school lists** built from US Dept of Education data, ranked on outcomes. Never pay-to-rank.
- **Parent updates** in your parents' own language, shareable with one no-login link.
- **Your data, your call.** A privacy page in plain words and a one-click "delete everything Yaar knows about me."

## Architecture, in one breath

```
 user / inbound -> Counselor / Mock / Visa / etc -> persistent memory (typed facts + timeline)
                                                                |
                  +--- agents propose actions ---+              v
                  |                              |     contextPack used everywhere
        CEO -> Arjun / Aanya / Ravi / ...        |
                  |                              v
                  +-------> Action Gateway (risk tier + Diya 6-dim eval + safety gate)
                                                |
                                                +-> dry_run | pending_approval | executed
```

- **Gemini via Vertex AI (or an AI Studio key)** for every model call: text, JSON, neural TTS, transcription, multimodal vision on uploaded docs.
- **MongoDB** for persistent state, with a full in-memory fallback so the app runs with zero infrastructure.
- **A multi-agent "company"** (CEO, analyst, content, growth, support, evaluator, memory) that proposes work through a single Action Gateway. Every external action passes a six-dimension brand-safety eval (Diya) and a safety gate before touching the world. Default autonomy is `dry_run`: log only.
- **A safety layer** with a kill switch, a daily dollar cap, and per-user caps, charged on every model call.
- **A public eval suite** (`/evals`) that runs against the live backend and publishes pass rates. Honest measurement, not vibe-check.

## Cost protection (read this before deploying)

Yaar is free for students, which means the person deploying it pays for the AI calls. The protections are layered so a surprise bill is very hard to produce:

1. **Daily hard cap** (`DAILY_HARD_CAP_USD`, default $8/day): every Gemini call checks and charges an in-memory, Mongo-persisted budget. At the cap, AI calls degrade to friendly fallbacks. Spend $0 more.
2. **Per-user daily cap** (`PER_USER_DAILY_CAP_USD`, default $0.50/day per profile).
3. **Strict per-IP rate tiers**: AI endpoints (20/min, 150/hr, 500/day), heavy document/voice endpoints (8/min, 50/hr, 150/day), profile creation (5/min, 30/day). All env-tunable.
4. **Cron fan-out caps** (`MAX_CRON_FANOUT`, default 300) so scheduled jobs can't scale costs with a pile of scripted profiles.
5. **Kill switch**: `POST /api/ops/safety/kill` (or the `/pulse` page) stops all external actions and AI spend instantly.
6. Set a **GCP Billing alert** (e.g. $50) as belt-and-suspenders.

## Quickstart

```bash
# backend
cd backend && npm install && npm run dev

# frontend (separate terminal)
cd frontend && npm install && npm run dev

# smoke check (separate terminal, backend must be running)
node scripts/smoke.mjs

# eval suite
node scripts/run-evals.mjs
```

Works out of the box without any API keys: every AI call has a deterministic mock fallback, so you can explore the whole product first. To run live, copy `backend/.env.example` to `backend/.env` and either set `GEMINI_API_KEY`, or use Vertex AI with `GEMINI_USE_VERTEX=1`, `GOOGLE_CLOUD_PROJECT=...`, and `GOOGLE_APPLICATION_CREDENTIALS=./credentials/sa.json`.

Optional extras: `MONGODB_URI` (persistence), `COLLEGE_SCORECARD_API_KEY` (live school data, free key), `GOOGLE_CLIENT_ID` + `JWT_SECRET` (sign-in and data ownership), `RESEND_API_KEY` + `RESEND_FROM` (real email digests).

## Deploying

1. **Use `npm start`, not `npm run dev`.** `tsx watch` reloads on file save and is not for prod.
2. **Set `ADMIN_TOKEN`.** Without it, every `/api/ops/*` endpoint returns 503 from non-localhost.
3. **Set `JWT_SECRET` and `GOOGLE_CLIENT_ID`.** This turns on real data ownership: profiles get bound to accounts and cross-user access is blocked.
4. **Keep `YAAR_AUTONOMY_MODE=dry_run`** until you've eyeballed a week of queued agent actions. Then `assist` (human approves outbound), and only then consider `live`.
5. **Leave `YAAR_ENABLE_LIVE_VOICE` unset.** The live-audio websocket bypasses the spend gate and has no per-connection auth yet.
6. **Set a GCP Billing alert** in addition to the in-code daily cap.
7. **Cloud Run:** set `--min-instances=1` so scale-to-zero doesn't pause the cron loop. The `/pulse` page shows a red "Scheduler STALE" tile if the heartbeat misses three 5-minute ticks.
8. **Verify with `BASE=https://your.domain node scripts/run-evals.mjs`** before announcing.

## The named AI org

| Agent | Role | Cadence | Allowed actions |
|---|---|---|---|
| CEO | Sets the week's one big bet | weekly | `internal_task`, `report` |
| Arjun | Nightly analyst memo | daily | `report` |
| Kabir | Weekly roadmap issues | weekly | `internal_task`, `report` |
| Aanya | One honest article per day | daily | `draft_content` |
| Ravi | Reddit answers, where helpful | daily | `draft_content`, `social_post` |
| Maya | Cuts long content into social | on_demand | `draft_content`, `social_post` |
| Leo | Personalized outreach DMs | weekly | `email_campaign`, `internal_task` |
| Sara | Inbound student/parent triage | on_demand | `support_reply`, `internal_task` |
| Diya | Six-dim evaluator (eval/QA gate) | on_demand | `report` |
| Memory | Per-user mind synthesis | daily | `internal_task`, `report` |

Every external action proposed by any of them flows through Diya, then the Action Gateway, then the safety gate, before reaching anything real.

## Privacy

The plain-words version lives at `/privacy` in the app. The short version: profiles, learned facts, and practice history are stored (so Yaar can remember you); uploaded documents and voice recordings are processed transiently and never persisted; nothing is sold or shared; and "Delete everything Yaar knows about me" on the Mind page wipes it all, permanently.

## Contributing

Issues and PRs welcome. The bar for anything student-facing: honest, specific, never hypey, and never guarantees outcomes. Run `npm run typecheck` (backend), `npm run build` (frontend), and `node scripts/smoke.mjs` before opening a PR.

## License

MIT. See [LICENSE](LICENSE).

---

> Yaar is a coaching and information tool, not legal or immigration advice. Outcomes are never guaranteed.
