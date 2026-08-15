# Deployment

Hosting is **Vercel** (Next.js) + **Supabase Cloud** (Postgres/Auth/Storage). There is no
self-hosted infrastructure, and this deploy uses Vercel's own `*.vercel.app` domain — no
custom domain is configured.

**Two environments, two Supabase projects:**

| | Supabase project | Vercel |
|---|---|---|
| **Dev** | existing project (`obbbvohmcaneehzxuuyo`), what `.env.local` points at today | `next dev` locally |
| **Prod** | a **new, separate** Supabase Cloud project (Part 1 below) | the Vercel project deployed from `main` |

They never share data. Prod starts empty except for the marketing copy baked into the
baseline migration — no dev/test rows.

---

## Part 1 — First deploy (do this once, in order)

### 1. Pre-flight ✅

- Ship from `main` — it's the GitHub repo's default branch, so Vercel's import in step 5
  will target it automatically.
- Run the check trio and confirm all green: `npm run build` · `npm run typecheck` · `npm run lint`.
- Confirm the Supabase CLI is available: `supabase --version`. A Vercel CLI isn't required —
  this runbook uses the Vercel dashboard.

### 2. Create the production Supabase project ✅

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New Project.
2. Region: pick one close to Norwich, VT (e.g. `us-east-1`).
3. Generate a strong DB password and save it in a password manager — you won't need it
   directly (the app uses the API keys below), but you'll want it for `psql`/dashboard access.
4. Once provisioned, from **Project Settings → API** record:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (never expose client-side)

### 3. Apply the schema ✅

This project's workflow is **cloud-only** — no local Docker, no `supabase db reset`. All
migrations live in `supabase/migrations/`, currently a single squashed baseline file
(`20260807090000_baseline_schema.sql`, ~1100 lines) that is the entire prod standup: 16
tables with RLS + policies, 6 functions, indexes/triggers, the realtime publication, the
three Storage buckets (`photos` private, `site-media` **public**, `resumes` private) with
their `storage.objects` policies, and ~45 `site_content` rows + 12 `site_collection_items`
rows of real marketing copy (about/contact/FAQ/jobs text, team bios, contact info).

```bash
supabase link --project-ref <prod-project-ref>
supabase db push --linked
```

> ⚠️ **Do not run `supabase/seed.sql` against this project.** It's dev-only fake data (5
> accounts, 8 properties, 5 employees including a placeholder "Ralph Tigertown", 19 visits, 3
> leads) and is only ever wired to local `db reset`, which this project doesn't use — but
> nothing stops you from running it by hand, so don't.

> ⚠️ **Apply the baseline migration exactly once.** The `site_collection_items` insert in
> Section 3 has no `ON CONFLICT` clause — replaying it would duplicate the 5 FAQ / 2 job / 4
> team rows.

**Verify:** in the Supabase dashboard, Table Editor shows 16 tables with RLS enabled on
each; Storage shows `photos`, `site-media`, `resumes`; `site_content` has ~45 rows.

### 4. Configure Supabase Auth URLs ✅

`supabase/config.toml`'s `[auth]` block (`site_url = "http://localhost:3000"`) is **local
CLI config only** — `supabase db push` does not touch Auth settings. You don't know the
Vercel URL yet, so:

- For now, set Site URL to a placeholder (`https://placeholder.vercel.app` is fine) in
  **Authentication → URL Configuration**.
- Come back and set the real values in step 7, once the Vercel URL exists. Don't skip that
  return trip — until it's done, every magic-link email will redirect to the placeholder.

### 5. Import the repo into Vercel ✅

1. [vercel.com/new](https://vercel.com/new) → import `maxkrieg/rooted-gardens`. Framework
   preset (Next.js) is auto-detected, and Production Branch defaults to `main` (the repo's
   default branch) — no override needed.
2. Node version: leave on Vercel's default (the repo pins no `engines`/`.nvmrc`; developed
   against Node 22, which is Vercel's current default).

### 6. Set environment variables ✅

Project Settings → Environment Variables, scope **Production** (Preview optional — see the
QBO/Auth caveats in Part 4 before relying on it). Three of these are read **at build time**,
not just at runtime — missing them doesn't error the build, it silently breaks a feature:

| Variable | Build-time? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | From step 2. `next.config.ts` derives `next/image`'s allowed remote host from this — if unset at build, every `site-media` image 400s from the image optimizer with no build error. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (inlined) | From step 2. |
| `SUPABASE_SERVICE_ROLE_KEY` | no (server-only) | From step 2. **Load-bearing for login, not just cron/admin jobs** — `proxy.ts` looks up `employees.role` via this key on every protected-route request; if it's missing, role lookup silently fails and *every* `/management/*` and `/crew/*` request bounces to `/login?error=no-employee-record`, which looks like a permissions bug but is a missing env var. |
| `NEXT_PUBLIC_APP_URL` | **yes** | Set after step 7 gives you the real `*.vercel.app` URL. Drives `robots.txt`, `sitemap.xml`, and OG `metadataBase` — all three silently fall back to `http://localhost:3000` if unset. |
| `QBO_CLIENT_ID` | no | Sandbox app credentials (Part 4 covers production QBO later). |
| `QBO_CLIENT_SECRET` | no | Sandbox app credentials. |
| `QBO_REDIRECT_URI` | no | Set after step 7 — must equal `https://<app>.vercel.app/api/quickbooks/callback` **exactly**, and be registered in the Intuit developer portal (§ QuickBooks below). Passed straight to the OAuth client, not derived from the request. |
| `QBO_ENVIRONMENT` | no | `sandbox` for this deploy. |
| `QBO_SERVICE_ITEM_NAME` | no | Defaults to `Services` in code if unset, but set it explicitly to avoid surprises — it's the shared QBO Product/Service every invoice line bills against. |
| `CRON_SECRET` | no | Generate: `openssl rand -hex 32`. Required — the cron route fails closed (401s, syncs nothing) if this is unset. Use a value different from anything used locally. |

**Do not set:** any `TWILIO_*` variable (SMS is deferred — zero code paths read them) or
`NEXT_PUBLIC_ENABLE_SW` (dev-only flag; the service worker is always on in production
regardless).

### 7. Deploy, then backfill the URL-dependent vars ✅

1. Trigger the deploy (push to `main`, or "Redeploy" in the dashboard once the branch/env
   vars above are set).
2. Once live, copy the assigned domain, e.g. `https://rooted-gardens.vercel.app`.
3. Set `NEXT_PUBLIC_APP_URL` to that URL and `QBO_REDIRECT_URI` to
   `https://rooted-gardens.vercel.app/api/quickbooks/callback` in Vercel, then **redeploy** —
   env var changes only take effect on a new deployment.
4. Back in Supabase (step 4's placeholder), set **Site URL** to the real domain and add
   `https://rooted-gardens.vercel.app/auth/callback` to **Redirect URLs**.

**Verify:** visiting the deployed root URL loads the public marketing home page.

### 8. Bootstrap the first owner ✅

There is no signup flow and no trigger on `auth.users` — every path that creates an
`employees` row already requires an existing owner (`requireOwner()` in
`app/management/team/actions.ts`, and the `employees_insert` RLS policy is `owner`-only). The
very first owner has to be created by hand:

1. Supabase dashboard → Authentication → Users → **Invite user**, with the owner's real
   email. This creates the `auth.users` row, which is all we need from it (see the
   auth-email caveat in Part 4 before inviting a large group).
2. Copy that user's UUID, then open the SQL editor and run:
   ```sql
   insert into employees (user_id, name, email, role, side, active)
   values ('<auth-user-uuid-from-step-1>', 'Owner Name', 'owner@example.com', 'owner', 'both', true);
   ```
3. Have that person sign in at **`/login`** on the deployed site — enter their email and
   click the fresh magic link. From here, invite everyone else through **Team → Invite
   to App** in-app; no more manual SQL needed.

> **Do the `employees` insert *before* they sign in, and have them sign in via `/login`
> rather than clicking the dashboard's invite link.** The dashboard invite redirects to the
> project's Site URL (`/`), which is a public marketing page with nothing that can consume
> auth params, so the sign-in is silently dropped and the link is spent. `/login` uses
> `signInWithOtp` (PKCE `?code=`), which `/auth/callback` exchanges server-side. If they do
> click the dashboard link first, it's recoverable — just request a fresh link from
> `/login`.

**Verify:** the invited owner can sign in and reach `/management/dashboard`; `/management/team`
shows them with role `owner`.

### 9. Connect QuickBooks (sandbox)

1. In the [Intuit Developer Portal](https://developer.intuit.com/), on your sandbox app,
   register the redirect URI exactly as set in step 7:
   `https://<app>.vercel.app/api/quickbooks/callback`.
2. As the owner, go to `/management/billing` and click **Connect QuickBooks**.

**Verify:** billing page shows QuickBooks connected; pushing a visit to invoice creates a
draft invoice in the QBO sandbox company.

### 10. Verify the cron

`vercel.json` already declares the daily job:
```json
{ "crons": [ { "path": "/api/cron/sync-invoice-status", "schedule": "0 9 * * *" } ] }
```
Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to its own invocations
(that's why setting `CRON_SECRET` in step 6 was required — the route 401s without it).

1. Confirm the job appears under the project's **Cron Jobs** tab.
2. Manually verify auth works:
   ```bash
   curl -i -H "Authorization: Bearer <CRON_SECRET>" \
     https://<app>.vercel.app/api/cron/sync-invoice-status
   ```
   Correct header → `200 {"ok":true,...}` or `{"ok":false,"error":"QuickBooks not connected"}`
   (also 200 — expected before step 9). No/wrong header → `401`.

### 11. Re-upload the gardens hero image ✅

The baseline migration's seeded `site_content` row for `gardens.hero_image` points at
`site-media/gardens-hero_image/de94b204-....jpg` — a file that lives only in the **dev**
project's Storage bucket; migrations don't carry blobs. Until it's replaced, the `/gardens`
page falls back to no hero image (not a broken link). Fix it as the owner: `/gardens` →
Edit mode → upload a new hero image through the in-app editor.

### 12. Point the CLI back at dev

`supabase link` is global state on your machine, not per-repo. Now that prod is set up:
```bash
supabase link --project-ref obbbvohmcaneehzxuuyo
```
so day-to-day `supabase db push --linked` / `supabase gen types typescript --linked` keep
targeting dev, not prod, by default.

---

## Part 2 — Post-deploy verification checklist

Run through this against the live URL once Part 1 is complete:

- [ ] Signed out: `/`, `/lawn`, `/gardens`, `/about`, `/faq`, `/jobs`, `/contact` all load,
      rendering the seeded `site_content` copy.
- [ ] Signed out: `/management/dashboard` and `/crew/schedule` redirect to `/login`.
- [ ] `/robots.txt` and `/sitemap.xml` reference the `*.vercel.app` domain, not `localhost`.
- [ ] The bootstrapped owner's magic link arrives and signing in lands on
      `/management/dashboard`.
- [ ] Owner can create an account + property; the schedule grid renders a week.
- [ ] On a phone, `/crew/schedule` is installable (Add to Home Screen); `/serwist/sw.js`
      returns `200`; after install, an offline reload still shows cached stops.
- [ ] Submitting the `/contact` form inserts a `leads` row (visible in
      `/management/leads`), confirming the anon-INSERT RLS policy works end-to-end.
- [ ] As owner, editing a public page's text/image in Edit mode saves and is visible
      immediately when signed out.
- [ ] Billing: pushing a visit to invoice creates a QBO sandbox invoice; "Refresh now" pulls
      its status back.
- [ ] Cron job visible in Vercel's Cron Jobs tab (§10 above).

---

## Part 3 — Reference

### Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public, **build-time** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public, build-time | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Bypasses RLS. Used by the cron route, the proxy's role lookup, Team invites, and (as an HMAC key) lead spam-hashing. Never expose to the client. |
| `QBO_CLIENT_ID` | server | QuickBooks OAuth app |
| `QBO_CLIENT_SECRET` | server | QuickBooks OAuth app |
| `QBO_REDIRECT_URI` | server | Must **exactly** match the deployed callback URL and be registered in the Intuit developer portal |
| `QBO_ENVIRONMENT` | server | `sandbox` or `production` |
| `QBO_SERVICE_ITEM_NAME` | server | Shared QBO Product/Service every invoice line bills against (default `Services`) |
| `NEXT_PUBLIC_APP_URL` | public, **build-time** | `https://<your-app>.vercel.app` |
| `CRON_SECRET` | server | Authenticates the invoice-status cron (§10 above) |

`TWILIO_*` variables are **not** used anywhere in code (SMS is deferred indefinitely — see
CLAUDE.md) — don't set them.

> Env var changes only take effect on a **new deployment**. After adding or changing one,
> redeploy.

### Database migrations (ongoing, after this first deploy)

Migrations live in `supabase/migrations/` and are applied to the **linked** Supabase Cloud
project — this project does **not** use local Docker / `db reset`:

```bash
supabase db push --linked
supabase gen types typescript --linked > types/database.ts   # regenerate + commit
```

Always regenerate and commit `types/database.ts` after a schema change, then run the check
trio: `npm run build` · `npm run typecheck` · `npm run lint`. Remember `supabase link` is
global on your machine — check `supabase projects list` / re-link if you're not sure which
project (dev or prod) you're currently pointed at before pushing.

Some migrations are destructive (drop columns/tables) — they're written to run in a single
transaction with a safety check, so a failed backfill rolls back cleanly. Review the row
counts after a data-migrating push.

### Invoice-status cron + `CRON_SECRET`

A daily Vercel Cron pulls QBO invoice lifecycle status (draft/sent/paid/overdue) back into
the `invoices` table. On Vercel's **Hobby** plan cron is limited to once daily and may fire
anytime within ~1 hour of the scheduled time — fine for a status backfill. The Billing →
History **"Refresh now"** button covers the immediate case. Edit the schedule (and, on a
paid plan, tighten the interval) by changing `vercel.json` and redeploying.

**How the auth works:** Vercel has a built-in convention — **if a `CRON_SECRET` env var is
set, Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to every cron
invocation.** The route (`app/api/cron/sync-invoice-status/route.ts`) verifies that header
and **fails closed** — if `CRON_SECRET` is unset, every request (including Vercel's) gets
`401` and nothing syncs.

For **local** testing, put `CRON_SECRET=<value>` in `.env.local` and curl
`http://localhost:3000/api/cron/sync-invoice-status` (or `npm run sync:invoices`). Use a
**different** secret for production than any value you've used locally.

### QuickBooks OAuth

`QBO_REDIRECT_URI` must exactly match the deployed callback route
(`/api/quickbooks/callback`) and be registered as a redirect URI in the Intuit developer
portal — it's passed straight to the OAuth client, never derived from the request host, so
a Vercel preview URL will not work unless separately registered.

Your Intuit developer app is **not** tied to any particular QuickBooks company. The company
is chosen at OAuth time by whoever completes the consent screen — `exchangeCodeForTokens`
reads the `realmId` off that response (and throws if Intuit omits it) and stores it in
`integrations`. So you own the app; the Rooted Gardens owner authorizes it against *their*
company by clicking **Connect QuickBooks** while signed into QBO.

#### Switching sandbox → production QBO

Do these in order — step 1 has lead time and gates the rest.

1. **Get production keys from Intuit.** Sandbox keys are issued instantly; production keys
   are gated behind completing the app's profile in the developer portal (host domain,
   launch URL, privacy policy URL, EULA/terms URL). Lighter than full app-store publishing
   for a private internal app like this one, but not instant — check the portal for the
   current requirements and start early.
2. **Register the redirect URI under the production keys.** Sandbox and production keep
   *separate* redirect-URI allow-lists, so `https://<app>.vercel.app/api/quickbooks/callback`
   does not carry over — add it again.
3. **Create the service item in the real company.** `getServiceItemId()`
   (`lib/quickbooks/invoice.ts`) looks up a Product/Service by name and **throws** if it's
   missing — it deliberately never auto-creates one, since that would require choosing an
   Income account, which is the accountant's decision. Sandbox companies ship with a
   `Services` item; a real company may not. Either have them create a Product/Service named
   `Services`, or set `QBO_SERVICE_ITEM_NAME` to match an item they already use.
4. **Update the env vars in Vercel and redeploy:**
   - `QBO_ENVIRONMENT` → `production` (must be exactly that string — `qboEnvironment()`
     treats any other value as sandbox, so a typo silently keeps you on the sandbox API)
   - `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` → the production credentials
   - `QBO_REDIRECT_URI` → unchanged
5. **Have the owner reconnect from the Billing page.** This is required, not automatic.
   `upsertIntegrationTokens` matches the row by `service = 'quickbooks'` and updates it in
   place (no duplicate row), but the sandbox tokens and sandbox `realm_id` sit there until
   someone reconnects — until then the app presents sandbox tokens to the production API and
   every push fails.

---

## Part 4 — Known limitations & follow-ups

These are accepted gaps for this deploy, not oversights — read before relying on the
corresponding feature.

- **Crew can't log in yet.** Login is magic-link only, and Supabase's built-in auth email
  sender is rate-limited (~2 emails/hour) and, on a new project, delivers **only to
  addresses added as project members** in the Supabase dashboard. That's fine for the owner
  + a couple of early testers, but blocks onboarding the ~18 crew members as-is. Before
  broader rollout: **Authentication → Emails** → configure a custom SMTP provider (e.g.
  Resend or Postmark) and raise the email rate limit under **Authentication → Rate Limits**.
- **QuickBooks is on sandbox.** No real invoices are created until the production-QBO switch
  above is done deliberately.
- **SMS is deferred entirely** (see CLAUDE.md) — no Twilio setup, no `TWILIO_*` vars, and the
  only notification channel is in-app realtime (crew toast, owner live start/stop panel).
  Owners still text crew manually for anything the app can't reach them with, as before.
- **PWA icons are placeholders.** `public/icons/icon-192.png` / `icon-512.png` exist and are
  the right dimensions but are minimal placeholder art — the install prompt will look rough
  until real icon art is dropped in.
- **No `.env.example`** ships in the repo (the `.gitignore` anticipates one with
  `!.env.example`, but it was never added). Use the table in Part 3 as the source of truth
  for what to put in `.env.local`.
- **No automated tests.** The check trio (`npm run build` · `npm run typecheck` · `npm run
  lint`) is the only pre-deploy gate; `npm run build` also compiles `app/sw.ts` via
  `createSerwistRoute`, so a broken service worker fails the build.
- **Preview deployments** will not complete QuickBooks OAuth or magic-link redirects unless
  their preview URLs are separately added to the Intuit redirect-URI list and Supabase's
  Auth Redirect URLs — expect those two flows not to work on preview branches out of the box.
