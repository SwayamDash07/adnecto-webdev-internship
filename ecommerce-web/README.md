# Cartly Hypermarket

Cartly is a Next.js storefront and operations console backed by Supabase. The repository contains customer catalog/cart/checkout flows, Razorpay payment routes, admin CRUD, inventory reservations, fulfilment queues, reports, realtime order notifications, and the Edge Function worker.

## Local setup

1. Install Node.js 20+ and run `npm ci`.
2. Copy `.env.local` to your local environment and set the public Supabase URL/key. Keep service-role and Razorpay secrets server-only.
3. Apply SQL in this order with the Supabase CLI or SQL editor: `schema.sql`, `phase1_*`, `phase2_*`, `phase3_admin.sql`, `phase4_*`, `phase5_payments.sql`, then `segment1_security.sql` through `segment8_release.sql`.
4. Run `npm run dev`.

Required production secrets are `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `TURNSTILE_SECRET_KEY`. The browser only receives `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, and optionally `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Payment and CAPTCHA routes return a configuration error when their server secret is missing.

## Edge Function worker

`supabase/functions/process-background-jobs/index.ts` claims pending rows from `background_jobs` and processes them with the service role. Deploy with `supabase functions deploy process-background-jobs --no-verify-jwt`, set the function secrets with `supabase secrets set`, and schedule an authenticated POST from Supabase Cron every minute. The worker is safe to retry because jobs are claimed and attempts are recorded.

## Verification

- `npm run typecheck`
- `npm run test`
- `npm run build`

The unit suite covers pricing/tax totals, inventory reservation decisions, payment input validation, and legal order transitions. Supabase RPC and browser checkout tests require a configured Supabase project plus seeded roles/products; Razorpay end-to-end capture additionally requires test credentials and webhook delivery.

Deploy the Next.js app with the same server environment variables, run the migrations in the order above, deploy the Edge Function, configure Razorpay webhook URL/signing secret, and verify RLS with a customer and each staff role before accepting live traffic.
