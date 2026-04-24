# Hook + Subtitle + Retention Booster

Production-minded MVP scaffold for a self-serve creator SaaS that improves short-form clips. The core V1 flow is:

`Upload a clip -> choose a boost preset -> send it to an external processor -> preview and download the improved version`

## Stack

- Next.js App Router
- React 19 + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Paddle-ready billing scaffold (with legacy Stripe scaffold still present in code)
- Processor provider abstraction with `mock` and `n8n` providers

## What is in the app

- Public marketing site: home, pricing, FAQ, contact, terms, privacy
- Auth: sign up, sign in, check-email, forgot password flow scaffold
- Protected app: `/app`, `/app/create`, `/app/jobs`, `/app/jobs/[id]`, `/app/billing`, `/app/settings`
- Admin area: `/app/admin`
- File upload flow for source clips
- Boost job creation and status tracking
- Paddle setup placeholders, plus legacy Stripe checkout, billing portal, and webhook scaffold
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

### Paddle

- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_CREATOR_PRICE_ID`
- `PADDLE_PRO_PRICE_ID`
- `PADDLE_BUSINESS_PRICE_ID`
- `PADDLE_ENVIRONMENT`

### Legacy Stripe scaffold

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CREATOR_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`

### Processor

- `PROCESSOR_PROVIDER`
  - `mock` for local dev simulation
  - `n8n` for external processing
- `N8N_PROCESSOR_ENDPOINT`
- `N8N_PROCESSOR_SECRET`

`N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` are still accepted as legacy aliases if your existing external flow already uses those names.

## Supabase setup

Run the schema file in the Supabase SQL Editor. It creates:

- `profiles`
- `plans`
- `subscriptions`
- `usage_ledger`
- `boost_jobs`
- `admin_events`

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

Current direction: Paddle.

You need four things to turn on paid checkout:

- Paddle API key
- Paddle client-side token
- Paddle webhook secret
- Paddle price IDs for Creator / Pro / Business

The app already has the Paddle API key placeholder path wired in env handling. Once the other three are added, we can swap the remaining legacy Stripe routes for Paddle checkout and webhooks cleanly.

Legacy Stripe routes still in the repo:

- [checkout route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/stripe/checkout/route.ts)
- [portal route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/stripe/portal/route.ts)
- [webhook route](C:/Users/asus/Documents/Codex/2026-04-20-i-want-to-build-a-saas/app/api/stripe/webhook/route.ts)

The webhook updates the `subscriptions` row from Stripe events.

For local Stripe webhook testing, point the Stripe CLI or your webhook forwarder at:

```txt
http://localhost:3001/api/stripe/webhook
```

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
- Creator: 40 boosts / month
- Pro: 150 boosts / month
- Business: 500 boosts / month

Each submitted boost debits 1 credit and writes to `usage_ledger`.

## Deploy notes

- Vercel works well for the Next.js app
- Supabase handles auth, Postgres, and source uploads
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` server-only
- Add the production app URL to Supabase redirect settings
- Add the production Stripe webhook endpoint before going live

## Quality notes

This codebase is intentionally scoped as a focused MVP:

- one main workflow
- real DB shape
- real auth structure
- real billing scaffold
- real processor abstraction

No fake timeline editor, no bloated automation UI, no extra modes.
