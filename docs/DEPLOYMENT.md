# Deployment

How to deploy the Rooted Gardens app. Hosting is **Vercel** (Next.js) + **Supabase Cloud**
(Postgres/Auth/Storage). There is no self-hosted infrastructure.

---

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production at minimum;
Preview/Development optional). Locally they live in `.env.local` (gitignored — never
committed). `.env.local` is **not** uploaded to Vercel, so every value must be set in both
places.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Bypasses RLS. Never expose to the client. Used by the cron route + token refresh. |
| `QBO_CLIENT_ID` | server | QuickBooks OAuth app |
| `QBO_CLIENT_SECRET` | server | QuickBooks OAuth app |
| `QBO_REDIRECT_URI` | server | Must **exactly** match the deployed callback URL (see §4) and be registered in the Intuit developer portal |
| `QBO_ENVIRONMENT` | server | `sandbox` or `production` |
| `QBO_SERVICE_ITEM_NAME` | server | Shared QBO Product/Service every invoice line bills against (default `Services`) |
| `TWILIO_ACCOUNT_SID` | server | SMS |
| `TWILIO_AUTH_TOKEN` | server | SMS |
| `TWILIO_MESSAGING_SERVICE_SID` | server | Use a Messaging Service, not a raw number |
| `NEXT_PUBLIC_APP_URL` | public | `https://<your-app>.vercel.app` |
| `CRON_SECRET` | server | Authenticates the invoice-status cron — see §3 |

> Env var changes only take effect on a **new deployment**. After adding or changing one,
> redeploy.

---

## 2. Database migrations

Migrations live in `supabase/migrations/` and are applied to the **linked** Supabase Cloud
project (this project does **not** use local Docker / `db reset`):

```bash
supabase db push --linked
supabase gen types typescript --linked > types/database.ts   # regenerate + commit
```

Always regenerate and commit `types/database.ts` after a schema change, then run the check
trio: `npm run build` · `npm run typecheck` · `npm run lint`.

Some migrations are destructive (drop columns/tables) — they're written to run in a single
transaction with a safety check, so a failed backfill rolls back cleanly. Review the row
counts after a data-migrating push.

---

## 3. Invoice-status cron + `CRON_SECRET`

A daily Vercel Cron pulls QBO invoice lifecycle status (draft/sent/paid/overdue) back into
the `invoices` table. Defined in `vercel.json`:

```json
{ "crons": [ { "path": "/api/cron/sync-invoice-status", "schedule": "0 9 * * *" } ] }
```

`0 9 * * *` = 09:00 UTC daily. On Vercel's **Hobby** plan cron is limited to once daily and
may fire anytime within ~1 hour of the scheduled time — fine for a status backfill. The
Billing → History **"Refresh now"** button covers the immediate case. Edit the schedule (and,
on a paid plan, tighten the interval) by changing `vercel.json` and redeploying.

### How the auth works

Vercel has a built-in convention: **if a `CRON_SECRET` env var is set, Vercel automatically
attaches `Authorization: Bearer <CRON_SECRET>` to every cron invocation.** The route
(`app/api/cron/sync-invoice-status/route.ts`) verifies that header. It **fails closed** — if
`CRON_SECRET` is unset, every request (including Vercel's) gets `401` and nothing syncs. So
setting it is required for the cron to run at all.

### Setup

1. Generate a secret:
   ```bash
   openssl rand -hex 32
   ```
2. Set it as `CRON_SECRET` in Vercel (Production — cron only runs against the production
   deployment). Dashboard: Settings → Environment Variables. Or CLI:
   ```bash
   vercel env add CRON_SECRET production
   ```
3. Redeploy. Confirm the job appears under the project's **Cron Jobs** tab.
4. Verify:
   ```bash
   curl -i -H "Authorization: Bearer <secret>" \
     https://<your-app>.vercel.app/api/cron/sync-invoice-status
   ```
   - Correct header → `200 {"ok":true,"processed":N,"errors":M}` (or
     `{"ok":false,"error":"QuickBooks not connected"}` if QBO isn't linked — also 200,
     expected/recoverable).
   - No header → `401 {"error":"Unauthorized"}`.

For **local** testing, put `CRON_SECRET=<value>` in `.env.local` and curl
`http://localhost:3000/api/cron/sync-invoice-status`. Use a **different** secret for
production than any value you've shared or used locally.

> After first deploy, existing invoices show `draft` until their first sync. Trigger the cron
> manually (curl above) or click "Refresh now" in Billing → History to pull real statuses.

---

## 4. QuickBooks OAuth

`QBO_REDIRECT_URI` must exactly match the deployed callback route
(`/api/quickbooks/callback`) and be registered as a redirect URI in the Intuit developer
portal. Example: `https://<your-app>.vercel.app/api/quickbooks/callback`. Set
`QBO_ENVIRONMENT=production` and swap in production QBO credentials when going live
(defaults target the sandbox). The owner connects QuickBooks from the Billing page after
deploy.

---

## First-deploy checklist

- [ ] Supabase Cloud project created and linked; all migrations pushed (`supabase db push --linked`)
- [ ] `types/database.ts` regenerated and committed
- [ ] All env vars from §1 set in Vercel Production
- [ ] `CRON_SECRET` set (§3) and cron job visible in the Cron Jobs tab
- [ ] `QBO_REDIRECT_URI` matches the deployed URL and is registered in Intuit (§4)
- [ ] Owner has connected QuickBooks from the Billing page
- [ ] Twilio A2P 10DLC brand/campaign registered (carrier approval gates SMS delivery — start early)
- [ ] `npm run build` · `npm run typecheck` · `npm run lint` all green
