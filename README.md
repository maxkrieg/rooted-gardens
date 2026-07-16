# Rooted Gardens

Internal business management app for **Rooted Gardens**, a small eco-landscaping company in
Norwich, VT (~20 employees). It replaces a large Excel spreadsheet and text/call scheduling
with a proper web app. Parent company: **Tigertown Farm LLC**.

Two service lines run through one app:

- **The Electric Lawn** — weekly electric mowing, route-based, crew-driven
- **Rooted Gardens** — ecological garden design, installation, and maintenance

## Who uses it

| User | Device | Primary needs |
|------|--------|---------------|
| Owner (lawn side) | Phone first | Schedule management, crew dispatch, route oversight |
| Owner (garden side) | Phone first | Garden project tracking, client notes |
| Crew (~18 people) | Personal phones only | Today's stops, log completions, photos |
| Accountant | Laptop | Invoice queue, QuickBooks sync |

Everyone except the accountant works primarily from a phone. The crew UI (`/crew/*`) is an
installable **PWA**, mobile-first and offline-tolerant. Management UI (`/management/*`) is
phone-first and responsive. Billing (`/management/billing/*`) is the one laptop-first area.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — do not add a webpack config
- **Tailwind CSS** + **shadcn/ui** (components in `components/ui/`)
- **Supabase** — Postgres, Auth (magic link, no passwords), Storage, Realtime; RLS on all tables
- **Serwist** (`@serwist/next`) — PWA manifest + service worker for crew install
- **@tanstack/react-query** — client state/caching (required on `/crew/*`, persisted to IndexedDB)
- **react-hook-form** + **zod** — forms and validation
- **date-fns** — date math (weeks are Mon–Sun)
- **lucide-react** — icons
- **QuickBooks Online** (`node-quickbooks` + `intuit-oauth`) — one-way invoice push, with one
  narrow read-back of invoice lifecycle status only
- **Twilio** — outbound SMS for crew schedule changes (only notification channel; no email anywhere)
- Deployed on **Vercel** + **Supabase Cloud**

## Getting started

```bash
npm install
npm run dev        # next dev --turbopack → http://localhost:3000
```

Create `.env.local` (see [Environment variables](#environment-variables)). The database runs on
**Supabase Cloud** — apply migrations with `supabase db push` against the linked project; there is
no local Docker/`db reset` workflow.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — use this, not raw `tsc`, for type checks |
| `npm run lint` | ESLint |

The check trio before committing: `npm run build` · `npm run typecheck` · `npm run lint`.

## Project structure

```
app/
  (auth)/login/          magic-link login
  management/            phone-first management UI (dashboard, schedule, accounts,
                         billing, fleet, team, route-groups)
  crew/                  mobile PWA (today's schedule, stop detail, history, profile)
  api/
    quickbooks/          OAuth connect + callback
    webhooks/            supabase + twilio (inbound STOP/HELP)
    cron/sync-invoice-status/  daily QBO invoice-status read-back (Vercel Cron)
components/
  ui/                    shadcn primitives (auto-generated — don't edit)
  management/            desktop/management components
  crew/                  mobile crew components
lib/
  supabase/              browser + server clients
  quickbooks/            client, sync, invoice, invoiceStatus
  utils/                 dates, visits, billing helpers
types/                   database.ts (generated) + app.ts
supabase/
  migrations/            SQL migrations
  seed.sql               dev seed (NOT real spreadsheet data)
proxy.ts                 root request proxy — auth + role gating (Next 16; was middleware.ts)
```

## Domain model

- **Accounts** are billing entities. Three billing types, never conflated: `per_visit`
  (residential, one price per completed visit), `contract` (flat periodic rate), and `as_needed`.
- **Properties** are the unit of scheduling; each carries a single `frequency`. (The old
  multi-work-area `service_zones` concept was dropped.)
- **Visits** are the core operational record — one row per `(property, week_start)`, where
  `week_start` is always a Monday. Status is `scheduled | completed | skipped`.
- **In-progress** and **invoiced** are *derived* flags, never `visits.status` values:
  in-progress = `started_at IS NOT NULL AND ended_at IS NULL`; invoiced = `invoice_id IS NOT NULL`.
- **Invoices** track the real QBO lifecycle (`draft | sent | paid | overdue`), synced back from
  QBO. To the owners, "invoiced" means QBO actually *sent* it.
- **Crew↔visit** links live in the relational `visit_crew` table (`assigned` / `completed`),
  which is FK-joinable and filterable by Supabase Realtime.

See `CLAUDE.md` for the full schema, roles/RLS, design system, and conventions, and `PHASES.md`
for build history.

## Data architecture

The two halves use different data-fetching models — pick by route group:

- **`/management/*`** (online, phone/laptop) → server-first: RSC reads via the Supabase server
  client, mutations via Server Actions.
- **`/crew/*`** (rural VT, intermittent signal) → client-first: React Query reads over the browser
  client, and all writes (completions, photos, job start/stop) go through an **offline mutation
  queue** in IndexedDB that flushes when connectivity returns. Never use Server Actions here.

Realtime is a best-effort live overlay (in-progress state, new assignments), never the source of truth.

## Roles

`owner` (full access) · `lead` (schedule read + crew views + logging) · `crew` (`/crew/*` only) ·
`accountant` (billing + account read). Role lives on `employees.role`; RLS gates data by role.

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never expose to client

# QuickBooks
QBO_CLIENT_ID=
QBO_CLIENT_SECRET=
QBO_REDIRECT_URI=
QBO_ENVIRONMENT=sandbox         # 'sandbox' | 'production'
QBO_SERVICE_ITEM_NAME=Services  # Product/Service every invoice line bills against

# Cron (invoice-status sync)
CRON_SECRET=                    # Vercel Cron sends `Authorization: Bearer <secret>`

# Twilio (SMS only — no email anywhere in the app)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=

# App
NEXT_PUBLIC_APP_URL=            # https://yourapp.vercel.app
```

## Conventions

- TypeScript strict mode — no `any`; generate types from Supabase (`supabase gen types typescript`)
  and commit `types/database.ts`.
- Mutations follow the route group (Server Actions on management, offline queue on crew).
- Zod schemas for all form validation (`lib/validators/`).
- Never import the Supabase browser client in a Server Component, or the server client in a Client Component.
- Keep QBO sync in `lib/quickbooks/`, schedule logic in `lib/utils/`.
- Dates display human-readable ("Mon Jun 8"), never ISO.

## Out of scope

No customer portal/login, no native app (PWA only), no Prisma/Drizzle, no pulling data *from*
QuickBooks (except the one status read-back), no in-app invoice presentation (QBO owns that).
