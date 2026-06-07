# Deploying Yaar

Yaar is two pieces: a long-running Node backend and a static frontend. They deploy
differently, and the backend's design decides the whole shape of the hosting.

## TL;DR

| Piece | Host | Why | Cost |
|---|---|---|---|
| Backend | **Google Cloud Run** (1 instance) | needs an always-on process for cron + the in-memory safety caps; native Vertex auth | ~$10-18/mo (covered by GCP credit) |
| Frontend | **Firebase Hosting** (same GCP project) | global CDN, free SSL, free subdomain, optional custom domain | free |
| Database | MongoDB Atlas M0 | already in use | free |
| AI | Vertex AI (same project) | usage, capped at $8/day in code | usage |

You do **not** need to buy a domain to launch. Firebase gives you a free
`https://<project>.web.app` URL with HTTPS. Buy a domain later if you want;
most registrars include free WHOIS privacy so it stays anonymous.

## Why not Vercel for the backend

Vercel (and any serverless host) runs short-lived functions across many parallel
instances. Yaar's backend is the opposite by design:

- **node-cron lives inside the server** (weekly opportunity drops, the digest, the
  memory agent, the heartbeat). Serverless has no always-on process to run them.
- **The safety model is single-instance in-memory**: the daily spend cap, the
  rate-limit buckets, the mock-test answer keys, and the listening-audio cache all
  live in process memory. Multiple instances would each allow the full $8/day cap
  (N instances = N x the budget) and fire duplicate cron jobs. **Run exactly one
  instance** until those counters move to Redis/Mongo.
- **Vertex auth** is cleanest from inside GCP: run the service *as* a service
  account, no key file on disk.

The static frontend could go on Vercel, but splitting one folder onto a second
vendor just doubles the config and the OAuth origins for no real gain. Keeping both
in GCP means one console, one bill, and one billing alert that covers your whole
exposure.

## Backend -> Cloud Run

A `Dockerfile` is included. From `backend/`:

```bash
# one-time: enable APIs + create a service account with Vertex access
gcloud services enable run.googleapis.com aiplatform.googleapis.com
gcloud iam service-accounts create yaar-run --display-name="Yaar Cloud Run"
gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
  --member="serviceAccount:yaar-run@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# deploy (builds the image, runs it as that service account, ONE instance)
gcloud run deploy yaar-backend \
  --source . \
  --region=us-central1 \
  --service-account="yaar-run@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
  --min-instances=1 --max-instances=1 \
  --cpu-always-allocated \
  --timeout=300 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_USE_VERTEX=true,GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,YAAR_AUTONOMY_MODE=dry_run" \
  --set-env-vars="MONGODB_URI=...,JWT_SECRET=...,GOOGLE_CLIENT_ID=...,ADMIN_TOKEN=...,COLLEGE_SCORECARD_API_KEY=...,CORS_ORIGINS=https://YOUR-FRONTEND,PUBLIC_URL=https://YOUR-FRONTEND"
```

Notes:
- `--cpu-always-allocated` is required: cron runs between requests, and request-only
  CPU would pause it.
- No `GOOGLE_APPLICATION_CREDENTIALS` and no `sa.json` on Cloud Run — the service
  account identity handles Vertex auth. Keep the sa.json path only for local dev.
- Put real secrets in **Secret Manager** and reference them with
  `--set-secrets` instead of `--set-env-vars` for anything sensitive.
- In **Atlas**, add the Cloud Run egress to the IP allowlist (or use
  `0.0.0.0/0` with a strong DB password for the simplest start).

## Frontend -> Firebase Hosting

From `frontend/`, build pointing at the deployed backend, then deploy static files:

```bash
# build with the backend URL and Google client id baked in
VITE_API_BASE="https://yaar-backend-XXXX.run.app" \
VITE_GOOGLE_CLIENT_ID="...apps.googleusercontent.com" \
npm run build

# one-time: firebase init hosting  (public dir = dist, SPA rewrite = yes)
firebase deploy --only hosting
```

The frontend calls the Cloud Run URL **directly** (CORS is configured). Do not use
a Firebase rewrite proxy to the backend: Firebase's proxy has a 60-second timeout,
and some Yaar endpoints (the boardroom, mock generation with retries) run longer.
Cloud Run's own 300s timeout handles them.

## Google OAuth (sign-in)

In the Google Cloud Console -> Credentials -> your OAuth client, add your frontend
origin (e.g. `https://yaar.web.app`) to **Authorized JavaScript origins**, or the
sign-in popup fails in production. Sign-in is optional for the product to work
(guest mode), but ownership enforcement only turns on when `GOOGLE_CLIENT_ID` +
`JWT_SECRET` are set.

## Launch checklist

1. `ADMIN_TOKEN` set (ops console + bug-report reading are locked without it).
2. `JWT_SECRET` + `GOOGLE_CLIENT_ID` set (turns on data ownership).
3. `YAAR_AUTONOMY_MODE=dry_run` (leave it; the AI company only logs).
4. `YAAR_ENABLE_LIVE_VOICE` unset (the live-audio socket bypasses the spend cap).
5. Exactly one backend instance (`--min-instances=1 --max-instances=1`).
6. A **GCP Billing alert** at ~$50 as the out-of-band backstop to the in-code cap.
7. Atlas IP allowlist includes the backend.
8. After deploy, verify against the live URL:
   `BASE=https://yaar-backend-XXXX.run.app node scripts/smoke.mjs`
   and `... node scripts/run-evals.mjs`.
9. Bookmark `/pulse` on your phone (needs the admin token) to watch spend live.

## Staying anonymous

- The free `*.web.app` subdomain needs no purchase, so there is no payment trail at all.
- If you buy a custom domain, pick a registrar with free WHOIS privacy (Cloudflare,
  Namecheap) so your name and address are not public.
- Nothing in the product surfaces a maintainer name or contact; the only support
  channel is the in-app `/feedback` form, which writes to your database, not to any
  third party tied to your identity.

## Cheaper escape hatch (optional)

If the ~$15/mo Cloud Run cost matters after the GCP credit runs out, the backend is
a single Node process and fits on a free-forever GCP `e2-micro` VM. More ops work
(you manage TLS, restarts, updates), so start on Cloud Run; keep this in your back
pocket.
