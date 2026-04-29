# Hook + Subtitle + Retention Booster

Production-minded MVP scaffold for a self-serve creator SaaS that improves short-form clips. The core V1 flow is:

`Upload a clip -> choose a boost preset -> send it to an external processor -> preview and download the improved version`

## Stack

- Next.js App Router
- React 19 + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Gumroad billing scaffold
- Processor provider abstraction with `mock` and `n8n` providers

## What is in the app

- Public marketing site: home, pricing, FAQ, contact, terms, privacy
- Auth: sign up, sign in, check-email, forgot password flow scaffold
- Protected app: `/app`, `/app/create`, `/app/jobs`, `/app/jobs/[id]`, `/app/billing`, `/app/settings`
- Admin area: `/app/admin`
- File upload flow for source clips
- Boost job creation and status tracking
- Gumroad checkout links, billing management handoff, and webhook scaffold
- Supabase schema with plans, subscriptions, usage ledger, boost jobs, and RLS

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy envs:

```bash
copy .env.example .env.local
```

3. Fill in `.env.local`.

4. Run the Supabase SQL in:

[supabase/schema.sql](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/supabase/schema.sql)

5. Start the app:

```bash
npm run dev -- --hostname localhost --port 3001
```

6. Open:

[http://localhost:3001](http://localhost:3001)

## Environment variables

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Gumroad

- `GUMROAD_WEBHOOK_SECRET` (optional if Gumroad gives you a real webhook signature secret)
- `GUMROAD_SELLER_ID` (use the seller ID Gumroad shows under the Ping endpoint when no secret is available)
- `GUMROAD_PORTAL_URL`
- `GUMROAD_PRODUCT_URL` (optional shared membership URL when one Gumroad product contains all tiers)
- `GUMROAD_CREATOR_PRODUCT_URL`
- `GUMROAD_PRO_PRODUCT_URL`
- `GUMROAD_BUSINESS_PRODUCT_URL`
- `GUMROAD_CREATOR_PRODUCT_ID`
- `GUMROAD_PRO_PRODUCT_ID`
- `GUMROAD_BUSINESS_PRODUCT_ID`

### Processor

- `PROCESSOR_PROVIDER`
  - `mock` for local dev simulation
  - `n8n` for external processing
- `N8N_PROCESSOR_ENDPOINT`
- `N8N_PROCESSOR_SECRET`

### Rate limiting

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Monitoring / alerting

- `ALERT_WEBHOOK_URL` optional, for forwarding critical operational alerts to Slack, Discord, Better Stack, PagerDuty intake, or another incident channel

`N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` are still accepted as legacy aliases if your existing external flow already uses those names. The production build guard also accepts `N8N_WEBHOOK_SECRET` as the legacy alias for `N8N_PROCESSOR_SECRET`.

Use separate keys for development, preview / staging, and production. If a secret was pasted into chat, logs, screenshots, or a public issue, rotate it immediately and replace it in your hosting environment manager.

## Supabase setup

Run the schema file in the Supabase SQL Editor. It creates:

- `profiles`
- `plans`
- `subscriptions`
- `usage_ledger`
- `boost_jobs`
- `admin_events`
- `webhook_events`

It also:

- seeds plan rows
- enables RLS
- creates the `source-videos` storage bucket
- adds storage policies
- adds a trigger that creates a profile and free subscription when a new auth user signs up

### Auth

Email/password is the primary MVP auth path.

Optional Google sign-in can be enabled through Supabase Auth providers. If enabled, add:

```txt
https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

to Google OAuth redirect URIs, and allow:

```txt
http://localhost:3001
http://localhost:3001/auth/callback
http://localhost:3001/app
```

in the Supabase redirect allow list.

## Storage

Uploads go to Supabase Storage bucket `source-videos`.

The upload helper lives in:

[supabase-storage.ts](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/lib/storage/supabase-storage.ts)

This keeps the app on one storage provider for the MVP. If you later move outputs to another provider, the storage layer is already isolated.

## Processor provider setup

Processor abstraction lives in:

- [types.ts](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/lib/processor/types.ts)
- [provider.ts](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/lib/processor/provider.ts)
- [mock.ts](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/lib/processor/providers/mock.ts)
- [n8n.ts](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/lib/processor/providers/n8n.ts)

Current contract:

- `submitJob(input)`
- `getJobStatus(externalJobId)`
- `cancelJob(externalJobId)` optional
- `parseWebhook(payload)` optional

### Processor webhook

External processors can update jobs through:

`POST /api/webhooks/processor`

The app resolves the target job by `jobId` or `externalJobId` and updates status, progress, output URL, and error state.

### n8n

Set:

- `PROCESSOR_PROVIDER=n8n`
- `N8N_PROCESSOR_ENDPOINT=...`
- `N8N_PROCESSOR_SECRET=...`

The provider is scaffolded so another engineer can connect the existing external flow without rewriting app pages or DB logic.

## Billing setup

Current direction: Gumroad.

You need these pieces to turn on paid checkout:

- Gumroad webhook credential (`GUMROAD_WEBHOOK_SECRET` or `GUMROAD_SELLER_ID`)
- Either one shared Gumroad membership URL or Creator / Pro / Business product URLs
- Optional Creator / Pro / Business product IDs for stricter product-based mapping
- Optional customer self-serve URL (defaults to `https://app.gumroad.com/library`)

Routes now wired for Gumroad:

- [checkout route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/gumroad/checkout/route.ts)
- [portal route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/gumroad/portal/route.ts)
- [webhook route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/gumroad/webhook/route.ts)

The webhook updates the `subscriptions` row from verified Gumroad sale / membership events.
Webhook deliveries are also written to `webhook_events` for durable auditability and replay-safe idempotency.
If one Gumroad membership product contains tiers named `Creator`, `Pro`, and `Business`, the webhook will map the plan by tier name.

For local webhook testing, point Gumroad at:

```txt
http://localhost:3001/api/gumroad/webhook
```

## Production rate limiting

The app now supports a shared Redis-backed rate limiter through Upstash. If these env vars are present:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

the auth routes, boost-job creation, admin job updates, and video proxy requests use a shared rate-limit store instead of the in-memory fallback. If the Upstash envs are missing, the app still works locally with the in-memory limiter.

## Logging, monitoring, and alerts

- `GET /api/health` is available for uptime checks and returns a minimal database-aware health status without exposing secrets.
- Auth failures, billing events, webhook failures, upload / submission failures, permission denials, job failures, and admin actions are written to audit logs or structured server logs.
- Sensitive values are redacted before logging:
  - auth tokens
  - cookies
  - webhook signatures
  - service-role keys
  - API secrets
- If `ALERT_WEBHOOK_URL` is configured, the app emits throttled operational alerts for:
  - repeated login abuse
  - billing webhook failures
  - payment state regressions like `past_due`, `cancelled`, `refunded`, `paused`
  - failed job queue updates
  - sudden job-creation spikes
- Recommended external monitoring:
  - uptime monitor on `/api/health`
  - alert on repeated `5xx` rates in Vercel
  - alert on Supabase database connectivity failures
  - alert on unusual storage growth / quota exhaustion

## Backups and disaster recovery

- Enable daily automated backups / PITR in Supabase for production.
- Keep backups in provider-managed encrypted storage separate from the app runtime.
- Run restore drills regularly: create a fresh database from backup and verify the app can boot and read key tables.
- Keep uploaded source videos in Supabase Storage so they remain recoverable alongside database state.
- Keep the previous production deployment available in Vercel so a bad release can be rolled back quickly from the deployments list.
- Write down an incident runbook for:
  - restoring the database
  - restoring storage
  - rotating leaked secrets
  - pausing billing webhooks
  - redeploying the last known-good release

## Email security

Supabase handles email verification and password reset token lifecycle for this app, and the auth routes are rate-limited to reduce signup and reset abuse. Before production launch, also configure the sending domain with:

- SPF
- DKIM
- DMARC

Start DMARC in monitoring mode first, then tighten enforcement once you trust your deliverability and provider alignment. Do not place secrets, tokens, or internal IDs into email bodies.

## Deployment security

- Production builds now fail if required env vars are missing or if `NEXT_PUBLIC_APP_URL` is not HTTPS.
- Browser source maps are disabled in production builds.
- Security headers are enforced in middleware:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- The app does not use wildcard CORS with credentials. Browser-authenticated state changes stay same-origin and are CSRF-protected.
- Use separate environment-variable sets for development, preview, staging, and production.

## Security and database operations

- App code uses the Supabase SDK and parameterized filters only. There is no string-built SQL in request handlers.
- Keep real secrets out of Git. The repository should only contain `.env.example` with fake placeholder values. Put live secrets in Vercel, Supabase, Upstash, Gumroad, or another dedicated secret manager.
- Only expose `NEXT_PUBLIC_*` values that are truly safe for the browser. Service-role keys, webhook secrets, auth tokens, and provider API keys must stay server-only.
- Restrict third-party keys wherever the provider supports it:
  - origin / domain restrictions for browser-safe keys
  - narrow scopes for API keys
  - IP or webhook-specific restrictions when available
- User-facing reads stay behind Supabase Auth + RLS. Keep the `SUPABASE_SERVICE_ROLE_KEY` server-only and use it only for privileged server actions, background sync, and verified webhooks.
- The app already uses UUIDs for user, subscription, and job identifiers. Avoid replacing them with sequential public ids.
- If you ever store third-party user secrets or tokens in Postgres, encrypt them before insert and decrypt only on the server.
- Keep the production database on least privilege:
  - anon/authenticated traffic should go through RLS-scoped Supabase clients
  - only server handlers and webhooks should use the service role
  - do not expose service-role powered APIs to the browser
- Run the SQL in [schema.sql](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/supabase/schema.sql) after schema changes. It now hardens both the newer `boost_jobs` schema and the legacy `video_jobs` / `subscriptions` tables with extra constraints and indexes.
- Turn on Supabase backups / PITR for production, and schedule restore drills. Backups are not enough until you have actually restored to a fresh instance and verified the app can boot against it.
- The admin area includes abuse controls so you can suspend an account, lock submissions, lock billing, and flag suspicious users without touching SQL manually.

## Admin

`/app/admin` is role-gated through the `profiles.role` column.

To make a user an admin for local testing:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

## Credits model

- Free: 2 boosts
- Creator: 150 boosts / month
- Pro: 350 boosts / month
- Business: 2500 boosts / month

Each submitted boost debits 1 credit and writes to `usage_ledger`.

## Deploy notes

- Vercel works well for the Next.js app
- Supabase handles auth, Postgres, and source uploads
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `GUMROAD_WEBHOOK_SECRET`, and `GUMROAD_SELLER_ID` server-only
- Add the production app URL to Supabase redirect settings
- Add the production Gumroad webhook endpoint before going live

## Quality notes

This codebase is intentionally scoped as a focused MVP:

- one main workflow
- real DB shape
- real auth structure
- real billing scaffold
- real processor abstraction

No fake timeline editor, no bloated automation UI, no extra modes.
