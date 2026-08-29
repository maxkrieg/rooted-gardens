# CLAUDE.md — Rooted Gardens Business App

## Project Overview

This is an internal business management app for **Rooted Gardens**, a small eco-landscaping
company based in Norwich, VT (~20 employees). The company has two service lines:

- **The Electric Lawn** — weekly electric mowing, route-based, crew-driven
- **Rooted Gardens** — ecological garden design, installation, and maintenance

The app replaces a large Excel spreadsheet and text/call scheduling with a proper
web app. Parent company is **Tigertown Farm LLC**.

---

## Who Uses This App

| User | Device | Primary Needs |
|------|--------|--------------|
| **Owner — lawn side** | Phone (primary), laptop occasionally | Schedule management, crew dispatch, route oversight |
| **Owner — garden side** | Phone (primary), laptop rarely | Garden project tracking, client notes |
| **Crew members** (~18 people) | Personal phones only | Today's stops, log completions, photos |
| **Accountant** | Laptop (almost always) | Invoice queue, QuickBooks sync |

**Critical:** Everyone except the accountant works primarily from a phone.
- Crew members use personal phones only — the crew experience must be a PWA
  (installable from browser, no app store). Since the R1 merge that PWA is the whole
  signed-in app at `/app/*` — owners install the same thing crew do.
- The owners also use the app **mostly on their phones**, only
  occasionally on a laptop. So `/management/*` routes must be **fully responsive and
  usable one-handed on a phone first**, then progressively enhanced for the extra
  screen space on desktop. Do NOT build desktop-only management layouts.
- The accountant is the one laptop-first user; their billing views
  (`/management/billing/*`) can assume a wide screen.

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router, TypeScript) — Turbopack is the default bundler for `dev` and
  `build`; do NOT add a webpack config (it breaks the Turbopack build). Caching is opt-in /
  dynamic-by-default, which suits this always-fresh business app.
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — component library (installed via CLI, components live in `components/ui/`)
- **Serwist** (`@serwist/turbopack`, NOT `@serwist/next` — that's the webpack integration and
  would break the Turbopack build) — PWA manifest and service worker for crew mobile install.
  Replaces `next-pwa` (unmaintained and webpack-based — incompatible with Turbopack/Next 16).
  Turbopack doesn't support build plugins, so `@serwist/turbopack`'s `withSerwist` in
  `next.config.ts` does nothing but register the `esbuild`/`esbuild-wasm` external package —
  the worker itself is compiled and served by a Route Handler,
  `app/serwist/[path]/route.ts` (`createSerwistRoute`), at `/serwist/sw.js`. The worker
  source lives at `app/sw.ts` — it's excluded from the main `tsconfig.json` (webworker lib
  conflicts with the DOM lib) and typechecked separately via `npm run typecheck:sw`
  (`tsconfig.sw.json`).
- **lucide-react** — icons
- **react-hook-form** + **zod** — form handling and validation
- **date-fns** — date manipulation (NOT moment.js, NOT dayjs)
- **@tanstack/react-query** — server state management and caching

### Backend / Database
- **Supabase** — PostgreSQL + Auth + Storage + Realtime
  - Auth: magic link email (no passwords — simpler for small team)
  - Storage: photo uploads (visit photos, property how-to guides)
  - Realtime: schedule updates push to crew phones without refresh
  - Row-Level Security (RLS) enabled on all tables
- **Next.js Server Actions** — preferred over API routes for mutations
- **Next.js Route Handlers** (`app/api/`) — only for webhooks and QuickBooks OAuth

### External Integrations
- **QuickBooks Online API** — invoice sync
  - Package: `node-quickbooks` + `intuit-oauth`
  - Auth: OAuth 2.0 (tokens stored in `integrations` table, encrypted)
  - Scope: one-way push (app → QBO) for everything EXCEPT one narrow read-path — a
    polling sync + manual "Refresh now" reads back an invoice's *lifecycle status only*
    (draft/sent/paid/overdue) via `getInvoice`, to answer "has QBO actually sent this to
    the customer yet". Never customer data, payment details, or edits made in QBO, and
    nothing read back feeds into invoice creation or pricing.
  - Endpoints used: `createInvoice`, `createCustomer`, `getCustomer`, `getInvoice` (status read)
- **Twilio** — ⚠️ **DEFERRED (2026-07-25) — not built, do not build.** Outbound SMS for crew
  schedule-change notifications (PHASES.md 8.2 / 8.3, plus the 0.1 registration lead-time
  item) is postponed indefinitely. **There is currently no SMS in this app.** The design
  below is retained as the intended shape for when it's picked back up — treat it as a
  plan, not as existing architecture, and don't write code against it.
  - **What this means today:** in-app realtime is the *only* notification channel
    (crew: the schedule-change toast; owners: live start/stop indicators). Still **no email
    anywhere in the app** — that part is permanent, not deferred. Owners cover the
    app-is-closed gap by texting crew manually, as they did before the app.
  - `employees.sms_opt_out` and the Team page consent toggle **are built and stay** — they
    are inert until SMS ships. Leave them alone; don't remove them as dead code.
  - _When un-deferred:_ sent from a Supabase Edge Function (`send-sms`), never inline;
    STOP/HELP via inbound webhook → `employees.sms_opt_out`; requires US **A2P 10DLC**
    brand + campaign registration — restart ~2 weeks ahead, carrier approval gates all
    delivery.

### Deployment
- **Vercel** — Next.js hosting
- **Supabase Cloud** — database and auth
- Environment: `.env.local` for dev, Vercel env vars for prod

---

## Repository Structure

```
rooted-gardens/
├── CLAUDE.md                    ← you are here
├── PHASES.md                    ← build phases and tasks
├── REDESIGN.md                  ← the field-first redesign, R1–R5. BUILT — this file
│                                  describes the result. Read it for the reasoning behind
│                                  /app/*, the generated week, and route defaults.
├── proxy.ts                     ← root request proxy (Next 16; auth + role gating, formerly middleware.ts)
├── app/
│   ├── layout.tsx               ← root layout (fonts, providers)
│   ├── (auth)/
│   │   └── login/page.tsx       ← magic link login
│   ├── (public)/                ← public marketing site + lead intake (no auth) [Phase 9]
│   │   ├── layout.tsx           ← public chrome (top nav + footer, no app nav)
│   │   ├── page.tsx             ← home / landing (root /)
│   │   ├── lawn/page.tsx
│   │   ├── gardens/page.tsx
│   │   ├── about/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── jobs/page.tsx        ← careers + application form
│   │   └── contact/page.tsx     ← inquiry intake form
│   ├── app/                     ← THE FIELD APP (PWA) — crew, lead, owner, accountant
│   │   ├── layout.tsx           ← PWA metadata + AppShell (one nav for the whole app)
│   │   ├── (padded)/            ← route group: page padding only, adds no URL segment
│   │   │   ├── schedule/page.tsx    ← the core screen; carries `Today` and `Week`
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx         ← account list
│   │   │   │   └── [id]/page.tsx    ← account detail
│   │   │   └── routes/page.tsx      ← route groups + their defaults
│   │   └── stop/[visitId]/      ← one stop: log completion, start/stop, photos.
│   │       └── page.tsx             Outside (padded) — it owns its own chrome.
│   ├── management/              ← THE DESK ROUTES — server-first, same AppShell
│   │   ├── layout.tsx
│   │   ├── billing/page.tsx     ← invoice queue (the one laptop-first screen)
│   │   ├── leads/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── fleet/page.tsx
│   │   └── team/page.tsx
│   └── api/
│       ├── quickbooks/
│       │   ├── connect/route.ts ← OAuth initiation
│       │   └── callback/route.ts← OAuth callback
│       └── webhooks/
│           ├── supabase/route.ts
│           └── twilio/route.ts   ← inbound STOP/HELP (SMS opt-out) [DEFERRED — not built]
├── components/
│   ├── ui/                      ← shadcn components (auto-generated, don't edit)
│   ├── app/                     ← shell, nav, role context, shared selection UI
│   │   ├── AppShell.tsx         ← the one shell: bottom bar, sidebar, More sheet
│   │   ├── RoleProvider.tsx     ← useRole() / useCan() — affordances, never security
│   │   └── nav-items.ts         ← one nav array, access-filtered by lib/auth/access.ts
│   ├── management/              ← schedule, accounts, routes, billing components
│   │   ├── ScheduleGrid.tsx     ← the 4-week desktop grid (lg+ only)
│   │   ├── ScheduleListMobile.tsx   ← the phone schedule (the screen that matters)
│   │   ├── RouteGroupBand.tsx       ← route header: crew, truck, progress, week note
│   │   └── InvoiceQueue.tsx
│   └── crew/                    ← field-work components (name predates the merge)
│       ├── VisitLogger.tsx      ← completion form
│       └── ServiceTypeSelector.tsx
├── lib/
│   ├── auth/
│   │   └── access.ts            ← ROUTE_ACCESS + capabilities; imported by proxy.ts,
│   │                              so it must stay dependency-free (Edge runtime)
│   ├── offline/                 ← the offline queue + caches (was lib/crew/)
│   │   ├── mutation-queue.ts
│   │   ├── idb.ts
│   │   └── photo-blobs.ts
│   ├── supabase/
│   │   ├── client.ts            ← browser client
│   │   ├── server.ts            ← server client (Server Actions / RSC)
│   │   └── middleware.ts
│   ├── quickbooks/
│   │   ├── client.ts
│   │   └── sync.ts              ← push visits to QBO
│   └── utils/
│       ├── dates.ts             ← week helpers (getWeekStart, etc.)
│       ├── schedule.ts          ← buildScheduleWeek + planWeek (the generate rule)
│       └── visits.ts            ← visit status helpers
├── types/
│   ├── database.ts              ← generated Supabase types (supabase gen types)
│   └── app.ts                   ← app-level types built on top of DB types
├── supabase/
│   ├── migrations/              ← SQL migration files
│   └── seed.sql                 ← dev seed data (NOT from real spreadsheet)
└── public/
    ├── manifest.json            ← PWA manifest
    └── icons/                   ← PWA icons (192, 512)
```

---

## Database Schema

All tables use UUID primary keys. All tables have `created_at` and `updated_at`
with `updated_at` maintained by a trigger. RLS enabled everywhere.

### Core Domain Tables

```sql
-- Billing entities (the people/orgs that get invoices)
accounts (
  id uuid PK,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  billing_type text NOT NULL   -- app writes only 'per_visit' | 'contract'
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
    -- NOTE: 'as_needed' was RETIRED as a billing type (see "Billing Types" below).
    -- The CHECK still permits it deliberately — no migration was run — so read
    -- paths keep a fallback, but nothing in the app ever writes it.
  price_per_visit numeric(8,2), -- only for per_visit accounts
  contract_rate numeric(8,2),   -- only for contract accounts
  contract_period text,         -- 'monthly' | 'seasonal' (for contract accounts)
  status text DEFAULT 'active'  -- 'active' | 'inactive' | 'prospective'
    CHECK (status IN ('active', 'inactive', 'prospective')),
  is_archived boolean NOT NULL DEFAULT false,  -- soft delete; see "Archiving" below
  qbo_customer_id text,         -- QuickBooks customer ID
  notes text,
  created_at, updated_at
)

-- Public inquiries & job applications (CRM-lite). Captures UNTRUSTED public form input,
-- kept separate from accounts (curated billing entities). Owner triages in the management
-- Leads inbox and converts a qualified service inquiry into a prospective account. [Phase 9]
leads (
  id uuid PK,
  kind text NOT NULL            -- 'service_inquiry' | 'job_application'
    CHECK (kind IN ('service_inquiry', 'job_application')),
  status text DEFAULT 'new'     -- pipeline: new → contacted → qualified → won/lost
    CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  service_interest text         -- 'lawn' | 'garden' | 'both' | 'other'
                                --   (was to route the new-lead SMS — deferred; still used
                                --    to route the in-app notification + triage)
    CHECK (service_interest IN ('lawn', 'garden', 'both', 'other')),
  message text,
  source text DEFAULT 'website',
  details jsonb,                -- kind-specific extras (e.g. job position, resume path)
  converted_account_id uuid FK → accounts,  -- set when a lead becomes an account
  created_at, updated_at
)
-- RLS: anon role INSERT only (public form, no reads); owner/lead SELECT+UPDATE;
-- crew/accountant no access. Realtime-enabled for the management new-lead toast.
-- assigned_to (FK → employees) DROPPED (migration 20260807090000_drop_leads_assigned_to.sql)
-- — the Leads inbox has no per-lead assignment step; owners triage inline.

-- Owner-editable copy for the fixed public marketing pages (app/(public)/*). The
-- owners must be able to change every word, phone number, email, and social link
-- themselves with no code change — see UI Conventions below for the inline
-- WYSIWYG editor this backs. `page='global'` slots (footer contacts, socials) are
-- shared across every page; everything else is scoped to one route. [Phase 9.2]
site_content (
  id uuid PK,
  page text NOT NULL            -- 'global' | 'home' | 'lawn' | 'gardens' | 'about' | 'faq' | 'jobs' | 'contact'
    CHECK (page IN ('global', 'home', 'lawn', 'gardens', 'about', 'faq', 'jobs', 'contact')),
  key text NOT NULL,            -- slot name, e.g. 'hero_heading', 'lawn_contact_phone'
  kind text NOT NULL            -- drives which editor control renders + how the value validates
    CHECK (kind IN ('text', 'richtext', 'image', 'email', 'phone', 'url')),
  value jsonb,                  -- plain string for text/image/email/phone/url; Tiptap JSON for richtext
  updated_by uuid FK → employees,
  created_at, updated_at,
  UNIQUE (page, key)
)
-- RLS: SELECT open to anon + all staff (public marketing content, requires an
-- explicit anon GRANT — RLS alone confers nothing, same lesson as leads/9.1);
-- INSERT/UPDATE restricted to owner only — narrower than most staff-write tables
-- in this schema, since editing the live public site is deliberately owner-only.
-- A missing/deleted row is NOT an error: lib/content/defaults.ts is the runtime
-- fallback, so a page never renders blank.

-- Ordered, owner-managed lists rendered on a fixed public page — FAQ entries,
-- job openings, team bios. `data` shape is per-collection and enforced by Zod
-- (lib/validators/site-content.ts), not the DB, mirroring leads.details. [Phase 9.2]
site_collection_items (
  id uuid PK,
  collection text NOT NULL      -- 'faq' | 'job' | 'team'
    CHECK (collection IN ('faq', 'job', 'team')),
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,  -- soft-hide (e.g. a filled job opening) without deleting
  data jsonb NOT NULL,
  created_at, updated_at
)
-- RLS: same shape as site_content — public SELECT, owner-only writes (DELETE too,
-- since a stale FAQ/job/team entry can be removed outright, unlike site_content
-- slots which are edited, never removed).

-- Public (not signed-URL, unlike the `photos` bucket) Storage bucket for
-- owner-uploaded marketing images referenced by site_content 'image' slots and
-- site_collection_items.data.image_path (team bios). Public because marketing
-- images need stable, cacheable, crawlable URLs. Owner-only writes.
-- storage.buckets: 'site-media', public=true, 20MB limit, jpeg/png/webp.

-- Physical locations (an account may have multiple properties)
properties (
  id uuid PK,
  account_id uuid FK → accounts,
  address text NOT NULL,
  lat numeric(10,7),
  lng numeric(10,7),
  frequency text NOT NULL DEFAULT 'weekly'  -- 'weekly' | 'biweekly' | 'monthly' | 'as_needed'
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'as_needed')),
  parking_notes text,
  access_notes text,          -- gate codes, key location, etc.
  crew_notes text,            -- standing instructions for all visits
  is_archived boolean NOT NULL DEFAULT false,  -- soft delete; see "Archiving" below
  created_at, updated_at
)
-- service_zones DROPPED (migration 20260630130000_drop_service_zones). A property no
-- longer has multiple named work areas with independent frequencies — frequency is a
-- single value on the property, and a visit anchors directly to a property (see below).

-- Route groupings (geographic clusters of properties)
route_groups (
  id uuid PK,
  name text NOT NULL,   -- e.g. "Sharon VT", "Hawk Pine Rd Corridor"
  sort_order integer DEFAULT 0,
  -- The standing plan. The paper route sheet encoded this in the group NAME
  -- ("Wilder - Mon/Tues") because there was nowhere else for it. A generated
  -- week (planWeek + the generate preview) pre-fills from these; a visit's own
  -- crew and vehicle always win over them.
  default_vehicle_id uuid FK → vehicles ON DELETE SET NULL,
  default_days text[] NOT NULL DEFAULT '{}'  -- 'mon'…'sun', CHECKed by containment
    -- NOTE: display only. A visit is keyed to a WEEK, not a day, so there is no
    -- per-day field to schedule into. It labels the plan; it doesn't drive it.
  created_at, updated_at
)

-- A route group's regular crew. A join table, not a uuid[] — same reasoning as
-- visit_crew: Realtime can't filter array containment, arrays can't be
-- FK-joined, and they're awkward in RLS.
route_group_default_crew (
  route_group_id uuid FK → route_groups ON DELETE CASCADE,
  employee_id uuid FK → employees ON DELETE CASCADE,
  created_at,
  PRIMARY KEY (route_group_id, employee_id)
)
-- RLS: SELECT all staff (crew need to see a route's regulars); writes owner/lead.

-- The route sheet's group-header dispatch note: "no Ryan till Thurs",
-- "matts gone all week". About the WEEK and the ROUTE, read by everyone working
-- it — which is why it can't live on one visit's crew_instruction.
route_group_week_notes (
  id uuid PK,
  route_group_id uuid FK → route_groups ON DELETE CASCADE,
  week_start date NOT NULL,        -- always a Monday
  note text NOT NULL,
  created_at, updated_at,
  UNIQUE (route_group_id, week_start)  -- what makes the queued upsert replay-safe
)
-- RLS: SELECT all staff; writes owner/lead. Emptying the note DELETES the row
-- rather than storing a blank, or the band renders an empty ribbon all week.

-- Views: account_last_visit and property_last_visit — most recent COMPLETED
-- visit, per account and per property. Both security_invoker (without it a view
-- runs with its owner's rights and bypasses RLS on visits). Both keyed on
-- ended_at, so a SKIPPED visit correctly doesn't count as a visit: skipping
-- means the work didn't happen, which is exactly when it should come up due
-- again. planWeek() needs the property grain — an account with two properties
-- on different cadences would otherwise phase both off whichever was done last.

-- Assign properties to route groups
property_route_groups (
  property_id uuid FK → properties,
  route_group_id uuid FK → route_groups,
  sort_order integer DEFAULT 0,
  PRIMARY KEY (property_id, route_group_id)
)
```

### People & Equipment

```sql
employees (
  id uuid PK,
  user_id uuid FK → auth.users,  -- nullable (not all employees have app access)
  name text NOT NULL,
  phone text,
  sms_opt_out boolean DEFAULT false,  -- honor STOP; suppress schedule-change texts.
                                      -- Inert while SMS is deferred — keep it, don't drop.
  email text,
  role text NOT NULL    -- 'owner' | 'crew' | 'accountant' | 'lead'
    CHECK (role IN ('owner', 'crew', 'accountant', 'lead')),
  side text,            -- 'lawn' | 'garden' | 'both' (which service line)
  active boolean DEFAULT true,
  hourly_rate numeric(6,2),
  created_at, updated_at
)

vehicles (
  id uuid PK,
  name text NOT NULL,     -- e.g. "Blue F-150", "White Ram"
  type text DEFAULT 'truck',
  plate text,
  status text DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  notes text,
  created_at, updated_at
)

equipment (
  id uuid PK,
  name text NOT NULL,    -- e.g. "Mower #3", "Trimmer 2"
  type text NOT NULL,    -- 'mower' | 'trimmer' | 'blower' | 'edger' | 'other'
  status text DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  last_serviced date,
  notes text,
  created_at, updated_at
)
```

### Scheduling & Visits

```sql
-- Visits are the core operational record. One row per (property, week) — enforced
-- by a UNIQUE index on (property_id, week_start).
-- A visit starts as 'scheduled' and progresses through status.
visits (
  id uuid PK,
  account_id uuid FK → accounts,        -- denormalized
  property_id uuid FK → properties,
  week_start date NOT NULL,             -- always a Monday; the "column" in the old sheet
  
  -- Planning (set by owner/lead before the week)
  crew_instruction text,                -- the "orange cell" — visit-specific note for crew
  vehicle_id uuid FK → vehicles,
  -- crew assignment + completion are tracked in the visit_crew join table (below),
  -- NOT as uuid[] arrays — keeps RLS, Realtime filters, and joins relational
  
  -- Timing (set by crew via Start/Stop taps; editable by owner/lead in the detail sheet)
  started_at timestamptz,               -- when work began; NULL until crew taps Start
  ended_at timestamptz,                 -- when work finished; NULL while in progress or not started
  -- Derived in-progress: started_at IS NOT NULL AND ended_at IS NULL
  -- Do NOT add 'in_progress' to the status enum — it is always derived.
  -- Completion date is derived from ended_at (fallback: week_start); actual_date was dropped.

  -- Completion (set by crew in the field)
  status text DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'skipped')),
  service_types text[],                 -- ['mow', 'double_cut', 'trim', 'edge', 'leaf_mulch', 'other']
  completion_note text,                 -- freeform note from crew
  skip_reason text,                     -- if status = 'skipped'
  
  -- Billing
  -- Derived invoiced flag: invoice_id IS NOT NULL. Same convention as in-progress
  -- (started_at/ended_at) above — NOT a value of status. (migration 20260714120000
  -- collapsed the old invoiced_at + qbo_invoice_id columns into this FK.)
  invoice_id uuid FK → invoices,        -- the QBO invoice this visit was billed on
  -- (no per-line amount is stored — the invoice total lives on invoices.amount;
  --  the History tab derives a per_visit line as invoices.amount / visit count.)
  
  created_at, updated_at
)

-- Crew↔visit assignments and completions.
-- Replaces the old visits.assigned_crew[] and visits.completed_by[] arrays so that
-- RLS predicates, Realtime filters, and joins are all relational. One row per
-- (visit, employee, relation).
--   'assigned'  = planned onto this visit by owner/lead before the week
--   'completed' = actually performed the work, logged by crew in the field
visit_crew (
  visit_id uuid FK → visits ON DELETE CASCADE,
  employee_id uuid FK → employees,
  relation text NOT NULL                -- 'assigned' | 'completed'
    CHECK (relation IN ('assigned', 'completed')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (visit_id, employee_id, relation)
)
-- Index for "my stops" queries and Realtime subscriptions:
--   CREATE INDEX visit_crew_employee_idx ON visit_crew (employee_id, relation);

-- visit_sessions TABLE DROPPED (migration 20260629120000_collapse_visit_sessions).
-- started_at / ended_at now live directly on visits (see above).
-- Partial index on visits for "in progress" queries:
--   CREATE INDEX visits_in_progress_idx ON visits (id)
--     WHERE started_at IS NOT NULL AND ended_at IS NULL;

-- NOTE: payroll time tracking (the `time_entries` clock-in/clock-out table) was removed
-- (migration 20260723000000_drop_time_entries). The owners don't track employee
-- clock-in/clock-out or run timesheets in this app. Attendance ("who was at which
-- visit") is tracked by visit_crew; per-visit on-site time by visits.started_at /
-- visits.ended_at. employees.hourly_rate is retained for pay-rate reference only.
```

### Media & Integrations

```sql
-- Photos attached to properties or specific visits
photos (
  id uuid PK,
  property_id uuid FK → properties,    -- always set
  visit_id uuid FK → visits,            -- nullable (property how-to photos have no visit)
  storage_path text NOT NULL,           -- Supabase Storage path
  type text DEFAULT 'visit'             -- 'visit' | 'how_to' | 'customer_request' | 'before' | 'after'
    CHECK (type IN ('visit', 'how_to', 'customer_request', 'before', 'after')),
  caption text,
  uploaded_by uuid FK → employees,
  created_at
)

-- QuickBooks OAuth tokens (encrypted at rest)
integrations (
  id uuid PK,
  service text NOT NULL,                -- 'quickbooks'
  access_token text,
  refresh_token text,
  realm_id text,                        -- QBO company ID
  token_expires_at timestamptz,
  created_at, updated_at
)

-- The canonical record of every QBO invoice this app has created — ONE row per
-- QBO invoice, for every billing type. Replaced the old per-billing-type split
-- (per_visit lived only as visits.qbo_invoice_id; contract lived in a separate
-- contract_invoices table) in migration 20260714120000. visits.invoice_id FKs
-- here; visits.invoice_amount is the per-line snapshot, this table's `amount` is
-- the invoice total. `created_at` is the "invoiced/pushed to QBO" moment.
invoices (
  id uuid PK,
  qbo_invoice_id text NOT NULL UNIQUE,  -- the QBO Invoice.Id
  account_id uuid FK → accounts,
  billing_type text NOT NULL            -- denormalized snapshot: 'per_visit' | 'contract'
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
    -- 'as_needed' retired but still permitted by the CHECK (see accounts above);
    -- this is a point-in-time snapshot, so historical rows keep whatever was true.
  amount numeric(8,2) NOT NULL,         -- invoice total
  period_label text,                    -- contract only (period being billed)
  period_start date,                    -- contract only
  period_end date,                      -- contract only
  -- Real QBO lifecycle, synced BACK from QBO (the one narrow read exception to
  -- the otherwise one-way push — see External Integrations). NOT a visits.status.
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  qbo_balance numeric(8,2),             -- QBO Balance snapshot
  qbo_due_date date,                    -- QBO DueDate snapshot
  qbo_email_status text,                -- raw QBO EmailStatus, debugging only
  sent_at timestamptz,                  -- set once, first time status → sent/overdue
  paid_at timestamptz,                  -- set once, first time status → paid
  last_synced_at timestamptz,           -- null = never synced; drives sync ordering
  created_at, updated_at
)
-- RLS: select for owner/lead/accountant; insert for owner/lead; update for
-- owner/lead/accountant (the manual "Refresh now" status sync). The cron sync
-- (app/api/cron/sync-invoice-status) writes via the service client, bypassing RLS.
```

---

## Auth & Roles

Supabase Auth with **magic link** (email only — no passwords).

| Role | Access |
|------|--------|
| `owner` | Everything, plus the only role that can archive or manage the team |
| `lead` | Same as owner minus Team and archiving |
| `crew` | `/app/schedule` and `/app/stop/*` only — see the week, log their own work |
| `accountant` | Billing and reports; read-only on schedule, accounts and routes |

**One allowlist drives both the redirect gate and the nav** — `ROUTE_ACCESS` in
`lib/auth/access.ts`, imported by `proxy.ts` (Edge, so that module must stay dependency-free)
and by `components/app/nav-items.ts`. A destination cannot appear in one and not the other,
and an unmatched protected path *denies*, so a new route is inaccessible until it's listed.

`capabilitiesFor()` in the same file answers what a role may *do* — `useCan()` reads it in
components. **These are affordances only. RLS is the boundary**, and since crew and owner now
share `/app/schedule`, a capability bug is a data-exposure bug: verify the policy, never just
the flag.

Role is stored in `employees.role`. Check via:
```ts
// In Server Actions / Route Handlers
const { data: employee } = await supabase
  .from('employees')
  .select('role')
  .eq('user_id', session.user.id)
  .single()
```

RLS policies gate data by role. The `user_id` on `employees` links Supabase Auth
users to their employee record.

---

## Key Domain Concepts

### Billing Types
**Exactly two**, and they are fundamentally different — never conflate them:

- **`per_visit`** — residential, a set price for each completed visit. Each visit = one QBO
  invoice line. Price stored on `accounts.price_per_visit` and **required** by
  `accountFormSchema` — an account with no rate can't be invoiced by the queue.
  **Billing cadence:** the accountant invoices these **monthly**, sweeping the prior month's
  completed visits onto one invoice. Cadence is a property of the billing *workflow*, not of
  the billing type, so don't surface it in the account form's type captions.
- **`contract`** — commercial or large properties. Flat periodic rate regardless of how many
  visits occurred. Invoiced per period (monthly/seasonal), not per visit. Price stored on
  `accounts.contract_rate`. This is the one type not swept up monthly.

> **`as_needed` was retired as a billing type.** It described a *visit cadence*, not a billing
> arrangement — and that cadence already lives on `properties.frequency`, which keeps its own
> `'as_needed'` value. **These are different concepts; don't let a find-and-replace merge
> them.** `as_needed` accounts were also a dead end: the billing queue refused to invoice them.
> Removal was **code-only** — `BILLING_TYPES` in `types/app.ts` is the source of truth and now
> has two values, but no migration was run, so the DB CHECK still accepts the old value and
> read paths (`BillingTypeBadge`'s `.billing-unknown` fallback, the `pushInvoicesToQuickBooks`
> guard, `pushAccountInvoice`'s trailing `else`, the reports `.neq`) keep defensive fallbacks
> for a legacy row. Lead conversion prefills `per_visit`, so the owner must enter a price to
> convert.

### Archiving (deleting accounts & properties)
"Delete" in the UI is a **soft delete**: `accounts.is_archived` / `properties.is_archived`.
Never hard-DELETE either — `visits`, `invoices`, `photos` and `leads.converted_account_id`
all FK back with NO ACTION, so a real delete is either rejected by Postgres or takes billing
history with it. Archiving keeps the row so past visits and invoices still render their
account name and property address.
- Archiving an account archives **all of its properties** (`archiveAccount` in
  `app/app/(padded)/accounts/actions.ts`); a single property archives alone (`archiveProperty`
  in `property-actions.ts`). Both also delete the property's `property_route_groups` rows —
  that join table carries no history, and a leftover row under-counts the "unrouted" nav
  badge, which is `properties − property_route_groups`.
- **Owner-only**, narrower than editing (owner/lead). Enforced by the
  `enforce_owner_only_archive` BEFORE UPDATE trigger on both tables, not by RLS (RLS can't
  gate one column). `is_archived` is also in the `enforce_accountant_account_columns` guard
  list — **any new `accounts` column must be added there or accountants can write it.**
- **Where to filter:** *enumeration* points filter (`.eq('is_archived', false)`) — account
  list & detail, ⌘K palette, routes page, unrouted counts, schedule grid, crew week schedule,
  contract-billing overview, reports, and the dashboard (current week + in-progress, which
  are live ops, not history). *FK-embed lookups do NOT filter* — billing/invoice queries, the
  account detail visit history, `useStopDetail` — so historical records keep their labels.
  Uninvoiced completed visits deliberately **stay in the Billing Queue** after archiving, so
  final work still gets billed.
- `is_archived` is deliberately separate from `status` (`active|inactive|prospective`), which
  is a sales/lifecycle axis: a prospective account can be archived, and folding the two would
  destroy the prior status and expose "archived" as an unguarded value in the account form's
  status dropdown.
- No restore UI by design. Un-archive with SQL:
  `UPDATE properties SET is_archived = false WHERE account_id = '…';` then the account.

### Properties & Frequency
A `property` is the unit of scheduling — there is no sub-property work-area concept.
(`service_zones` — named work areas within a property with independent frequencies —
was eliminated in migration `20260630130000_drop_service_zones`; the multi-frequency-
per-area capability was intentionally dropped.) Each property carries a single
`frequency` (`'weekly' | 'biweekly' | 'monthly' | 'as_needed'`), shown via
`FrequencyBadge`. A formerly multi-zone property (e.g. a commercial site with a lawn on
one cadence and garden beds on another) is represented as one property at its most-
frequent cadence, with the per-area breakdown folded into `crew_notes` as freeform text.

### Visits
A `visit` is a (property × week) record — enforced by a UNIQUE index on
`(property_id, week_start)`. The `week_start` is always a Monday.
- Created by the owner when scheduling ("this property needs service week of June 8")
- May have a `crew_instruction` — a one-time note for this specific visit (distinct from property standing notes)
- Crew completes it in the field: sets `ended_at`, `service_types[]`, `completion_note`
- Completion date is derived from `ended_at` (fallback: `week_start`); display with `parseISO`
- `status` is `scheduled | completed | skipped` — never `invoiced`. Whether a visit has
  been billed is a *derived* flag (`invoice_id IS NOT NULL`), the same convention as the
  in-progress state below. Pushing to QBO (from the Billing Queue / Contracts tab) creates
  an `invoices` row and sets the visit's `invoice_id`. The *real* QBO lifecycle — whether
  QBO has actually sent it, been paid, or gone overdue — lives on `invoices.status`
  (`draft | sent | paid | overdue`), synced back from QBO (see External Integrations). To
  the owners, "invoiced" means QBO *sent* it (`invoices.status = 'sent'`), not merely that
  it was pushed.

### Job Start/Stop & In-Progress State
Start/stop timing lives directly on the visit row: `visits.started_at` and `visits.ended_at`.
(The separate `visit_sessions` table was dropped in migration `20260629120000`.)
- **Start** → crew app sets `visits.started_at = now()`, `ended_at = NULL` via the offline queue.
- **Stop** → crew app sets `visits.ended_at = now()` via the offline queue.
- A visit is **in progress** when `started_at IS NOT NULL AND ended_at IS NULL`. This is a
  *derived* state, NOT a value of `visits.status`. Do not add `in_progress` to the enum.
- **Stop ≠ completion.** Stopping only closes the on-site clock. Crew still log
  completion (`service_types[]`, photos) via the separate completion form (VisitLogger).
  When the Log Completion form is submitted, `ended_at` is always written (either from
  the Stop time they tapped, or prefilled to now if they never tapped Stop).
- `ended_at` on a completed visit is the authoritative completion date. Use it for display
  and sorting; never use `actual_date` (that column was dropped).
- Owners can manually edit `started_at`/`ended_at` via the management VisitDetailSheet.
- Because start/stop happen in the field, they go through the crew **offline queue** like
  completions — so live in-progress state is only as fresh as the crew member's connectivity.

### Service Types (multi-select on completion)
```
'mow' | 'double_cut' | 'trim' | 'edge' | 'leaf_mulch' | 'cleanup' | 'other'
```
A single visit can have multiple service types (e.g. `['mow', 'trim']`).

### The Week Model
The app thinks in weeks (Mon–Sun), matching the owner's spreadsheet. Use `date-fns`:
```ts
import { startOfWeek, addWeeks } from 'date-fns'
const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday
```

---

## UI Conventions

### Design System — "Field & Foliage"

Warm, natural, lightly editorial — the feel of a botanical field notebook (kraft paper, soil,
sage, terracotta), NOT corporate SaaS. Backgrounds are warm "paper," never stark white.
Materialized in `app/globals.css` (CSS variables) + Tailwind theme + `next/font` during task 1.1;
shadcn/ui consumes the variables. This block is the single source of truth for look-and-feel.

**Typography** (`next/font/google`):
- Display / headings / notable numbers → **Fraunces** (soft "old-style" serif, optical sizing;
  warm, organic). Weights 400–600.
- Body / UI / labels → **Hanken Grotesk** (humanist sans, highly legible in the field; friendly,
  not overused). Weights 400/500/600/700. This is the default `font-sans`.
- Numeric data (schedule, billing) → Hanken Grotesk with `tabular-nums`.
- Never use Inter / Roboto / Arial / system fonts.

**Color tokens** (light = the default; hex, mapped to shadcn variables):
```
--background          #F6F3EA   warm paper (app bg)
--foreground          #2B2A24   bark ink (primary text)
--card / --popover    #FCFAF4   surface
--primary             #4A7C59   brand sage/forest green
--primary-foreground  #F4F1E8
--secondary           #ECE8DF   warm stone
--secondary-foreground#4A3B2E   bark brown
--muted               #EDE9DF
--muted-foreground    #6E665A   warm taupe
--accent              #E3EDE4   soft sage tint (hover/active surfaces)
--accent-foreground   #3A6347
--destructive         #B0492F   earthy brick red
--border / --input    #E4DDCF   warm sand
--ring                #4A7C59   brand-green focus
--radius              0.75rem
```
Brand accents (beyond shadcn defaults): `--clay #C2683E` (terracotta — garden side + the live
"on-site" indicator), `--ochre #D9A441` (wheat/amber), `--bark #4A3B2E`, `--sap #6FA84B` (fresh green).
Dark theme ("soil at dusk", for dawn/dusk field use): `--background #1C1A15`, `--foreground #ECE7DA`,
`--card #24211B`, `--primary #6B9A78`, `--primary-foreground #15140F`, `--muted-foreground #A89E8C`,
`--border #353026`, `--ring #6B9A78` — same semantic mapping, lightened.

**Status colors** (visit-status badges — bg / text):
- scheduled → `#ECE8DF` / `#6E665A` (warm stone gray)
- completed → `#E3F1E7` / `#2F6E45` (leaf green)
- skipped → `#FBF0D6` / `#9A6B16` (ochre/amber)
- `.status-invoiced` → `#E4ECF2` / `#3F6E97` (denim — the one cool hue, marks the "billed"
  track). Not a visit-status badge (invoiced is a derived flag, not a `status` value) —
  this class is kept alive solely for the dashboard's "Uninvoiced" stat card.
- **on-site / in-progress (live)** → `--clay` terracotta with a pulsing dot + elapsed ("On site •
  0:42"); deliberately warm so it pops against the green UI and is never confused with
  completed-green or skipped-amber. Derived from `visit.started_at IS NOT NULL AND visit.ended_at IS NULL`,
  never a `visits.status` value. Use `isVisitInProgress(visit)` from `lib/utils/visits.ts`.

**Shape, spacing, depth:**
- Radius: base 0.75rem; cards `rounded-2xl` (organic), badges/pills full, buttons/inputs `rounded-lg`.
- Spacing: Tailwind 4px scale; crew tap targets ≥44px (`h-11`/`h-12`), comfortable `gap-3/4`, cards `p-4/5`.
- Shadow: soft, warm, low — `0 1px 2px rgba(43,42,36,.04), 0 6px 16px -4px rgba(43,42,36,.08)`. Never harsh/black.
- Texture (optional, subtle): faint paper grain on the app bg + organic line motifs in empty
  states/headers. Must never reduce legibility or hurt performance.

**Component intent:**
- Buttons: primary = filled brand green, Hanken 600; crew primary actions large & full-width
  (`h-12`). Secondary = outline on paper; destructive = brick; ghost = tertiary.
- Cards: warm surface, 1px sand border, soft shadow, `rounded-2xl`, generous padding. Crew stop
  cards are large and tappable with the address prominent (Fraunces).
- Badges: pill, tinted bg + darker text per status token, uppercase micro-label with
  letter-spacing, optional leading dot.
- Inputs: paper surface, sand border, 2px green focus ring; ≥16px font on crew (prevents zoom), `h-11`+.
- Nav: crew = bottom bar (paper, top hairline; active tab = green icon+label, ≥44px). Management =
  warm sidebar with right hairline (active = green left-border/pill) on desktop; hamburger/bottom on phone.

**Hero treatments (anchor screens):**
- Crew "Today's stops": warm paper bg (faint grain); header "Today · Tue Jun 11" (Fraunces) + route
  name; vertically stacked large stop cards (address in Fraunces, account muted, frequency badge,
  status chip); terracotta "On site" pulse when a session is open; orange crew-instruction ribbon
  across the card top when present; big bottom nav; botanical empty state.
- Management dashboard: paper bg; "Today at a glance" with large Fraunces stat numerals in tinted
  stat cards; a "Crews on site now" panel with terracotta live pulses + elapsed; "This week"
  summary; amber maintenance chips. Editorial and warm, comfortable density; stacks on a phone.

### The field app — `/app/*` (one surface, four roles)

`/crew/*` and the field management routes merged into one installable app at `/app/*`
(REDESIGN.md R1). There is no separate crew site: crew, lead, owner and accountant all load
the same `/app/schedule`, and role decides what they can *do*, not which site they're on.

- Phone-first everywhere, not just for crew. The owners run this from a truck.
- One bottom bar on phone, the same items as a sidebar from `lg` up — both from `NAV_ITEMS`
  in `components/app/nav-items.ts`. The bar holds what works offline; `More` holds what needs
  a connection. That is the same field/desk split as the data architecture below, which is
  what makes the overflow a real category rather than a junk drawer.
- Large tap targets (min 44px). `Button size="icon"` enforces this with
  `pointer-coarse:size-11` — a media-variant class **no `className` can merge away**, so opt
  out with a plain `<button>` when a control genuinely must be smaller.
- No horizontal-scrolling tables. Dense grids are a desktop affordance and must degrade to
  cards or stacked rows on a phone.
- Offline-tolerant: show stale cached data flagged with `CachedNotice`, never an error over
  data the owner can still act on.
- Colors & type: per the **Design System** above. Favor high contrast and large type for
  sunlight legibility in the field.

### The desk routes — `/management/*`

Billing, team, fleet, leads and reports kept their URLs. They render inside the same
`AppShell`, so there is one nav in the app, but they are still server-first (see Data
Architecture). Billing is the one genuinely laptop-first screen — the accountant — so it can
assume a wide screen and stay table-dense.

### Breakpoints

Two tiers, and only two. Pick from these rather than introducing a third:

| Breakpoint | What changes | Why |
|---|---|---|
| `md` (768px) | Table ↔ card for list screens: accounts, leads | The width a simple table needs before it has to scroll sideways |
| `lg` (1024px) | The nav (bottom bar → sidebar), and the 4-week schedule grid | The grid needs a sticky label column plus four week columns; below this it would scroll horizontally, which is forbidden above |

The routes page uses neither — it is cards at every width, which is the right answer when a
screen has no table to degrade.

**`ScheduleView` couples a JS media query to the CSS breakpoint** — `useMediaQuery('(min-width:
1024px)')` decides whether to fetch one week or four, while `hidden lg:block` / `lg:hidden`
decide which layout renders. If those two ever disagree, a phone either fetches three weeks it
never renders or renders a grid it never fetched.

### Shared Components
- Use shadcn/ui primitives as the base (Button, Card, Dialog, etc.)
- `service_types` multi-select: always rendered as a checkbox group, never a dropdown
- Visit status badges: use the **Design System** status colors (scheduled / completed /
  skipped) — pill shape, tinted bg + darker text
- **In-progress** = the `--clay` terracotta on-site indicator from the Design System (pulsing dot +
  elapsed), overlaid on the status badge — derived from `visit.started_at IS NOT NULL AND ended_at IS NULL`,
  never a `visits.status` value. Use `isVisitInProgress(visit)` from `lib/utils/visits.ts`
- All dates displayed as human-readable ("Mon Jun 8" not "2026-06-08")

---

## Data Architecture: Offline-Tolerant Everywhere Except the Desk

The owners confirmed (2026-08-18) that they run management **primarily from phones, on the
road, in limited service** — laptop use is now the minority. That triggered the escape hatch
this section used to describe, and the field-critical management routes were converted to the
client-first model across three phases (`8918429`, `c5a7760`, `a857567`, `655ba8d`, `ec01d9d`,
`fefd77a`, `2502e69`). The split is no longer crew-vs-management; it is **field vs desk**.

### Field routes — client-first + offline queue
Everything under `/app/*`: `/app/schedule` (which carries the dashboard as its `Today` view),
`/app/accounts`, `/app/accounts/[id]`, `/app/routes`, `/app/stop/[visitId]`.
- **Reads:** client components using **React Query** over the Supabase **browser** client,
  persisted to IndexedDB. Pages are a thin RSC shell that only reads the `rg-role` cookie
  and renders the client view. Show cached data flagged stale (`CachedNotice`), never an
  error over data the owner can still act on.
- **Writes:** the **offline mutation queue** (`lib/offline/mutation-queue.ts`) for
  field-critical mutations; Server Actions only for desk-shaped ones.
- Pattern to copy: `lib/schedule/fetch.ts` → `hooks/useManagementSchedule.ts` →
  `components/management/ScheduleView.tsx`.
- **Server Actions are still allowed here** for genuinely desk-shaped writes — route group
  CRUD, route defaults — but each one must call a `useRefresh*` hook on success (see below),
  and must say "needs a connection" rather than fail silently offline.

### Desk routes — still server-first
`/management/billing` (the accountant is laptop-first), `/management/team`,
`/management/fleet`, `/management/leads`, `/management/reports`. RSC reads + Server Actions,
as before. Don't convert these without a reason.

### Rules that bite if you forget them

- **Converting a page to client-first breaks every Server Action that feeds it.**
  `revalidatePath` then refreshes an RSC shell holding no data — the write lands in Postgres
  and the screen never changes. Every such page needs a `useRefresh*` hook invalidating its
  query keys, called from each action's success path. **This has caused five separate bugs**;
  it is the single most repeated mistake in this codebase.
- **Enumerate every cache the *feature* reads, not just the ones the page owns.** The same
  failure wearing different clothes: changing a property's route from the account page patched
  `routes-data` and `schedule-reference` and left `account-detail`, which is the map that page
  actually renders — so the write landed and the card never moved. Ask what reads this data,
  not what wrote it.
- **A batch of writes must own its optimistic state.** Per-row patch + per-row invalidation in
  a loop makes the UI visibly bounce: a mid-batch refetch returns the pre-batch state. Patch
  once up front, run each write `silent`, invalidate once at the end (see
  `useReorderRouteProperties`).
- **Queued mutations need `networkMode: 'always'`.** React Query's default *pauses* a
  mutation when offline: `onMutate` runs (so the UI looks saved) but `mutationFn` never
  does, so nothing is enqueued. Genuinely online-only mutations keep the default.
- **New query keys must be added to `PERSISTED_QUERY_KEYS`** (`components/providers.tsx`) or
  they won't survive a reload. It's an allowlist so account data doesn't land in IndexedDB
  by accident. Signed-URL keys stay off it — they expire in an hour.
- **Queue writes must be replay-safe.** `markMutationDone` runs *after* the Supabase call, so
  a crash between them replays the case. Inserts upsert with `ignoreDuplicates`.
- **Don't call `router.refresh()` on a client-first page.** Offline it's an RSC fetch that
  fails and takes the page down via the error boundary.
- **Realtime only covers `visits`, `visit_crew`, and `leads`** — those are the only tables in
  the `supabase_realtime` publication. A subscription on anything else silently never fires.
  Refresh from the write instead.
- **Offline behavior cannot be tested with `npm run dev`** — `defaultCache` degrades to a
  single `NetworkOnly` rule. Use `npm run build && npm start`.

### The offline queue, concretely
`lib/offline/mutation-queue.ts` + `lib/offline/idb.ts`, alongside `lib/offline/photo-blobs.ts`.
IndexedDB `rooted-crew`, stores `mutations`, `rq-cache`, `photo-blobs` — **the database and
store names are deliberately unchanged**: a crew phone may be holding unflushed field writes
across any deploy that renames them.

Queued types: `completion`, `photo`, `photo_caption`, `job_start`, `job_discard`, `skip`,
`create_visit`, `assign_crew`, `set_vehicle`, `crew_instruction`, `revert_status`,
`property_notes`, `route_week_note`, `assign_property_route`. Adding one means touching
`MutationType` (idb.ts), the payload interface + `MutationPayload` union, a `case` in the
flush switch, and `TYPE_LABELS` in `StuckChangesSheet` (compiler-enforced).

Parked after 5 attempts and surfaced in "Changes that didn't save". `OfflineBanner` and the
mount-flush are mounted once by `AppShell`, which wraps every signed-in surface.

**Deliberately still online-only:** plan photos (three unguarded steps, duplicates on replay),
`bulkAssignRoute` and `assignProperties` (both overwrite whatever was there, so a delayed
replay could undo an edit made in between), `setRouteGroupDefaults` (replaces a whole set of
join rows), and everything on the desk routes. These show a "needs a connection" message.

**Photo bytes:** `lib/offline/photo-blobs.ts` caches `how_to` / `customer_request` bytes keyed
by `storage_path` (100MB LRU). The `photos` bucket is private and its URLs rotate hourly, so a
URL-keyed cache can never hit — only the bytes can be cached.

### Realtime subscriptions
Because crew↔visit links live in `visit_crew` (not a `uuid[]`), subscriptions are relational
and filterable.

**Per-crew-member** (`useCrewRealtimeSync`, mounted by `AppShell` for whoever is signed in):
- **Their own assignments:** `visit_crew` filtered by `employee_id=eq.<my_employee_id>`. This
  is what raises the "Your schedule was updated" toast.
- **Content changes** (crew instruction edits, new stops in the week): subscribe to `visits`.
  Realtime cannot filter `visits` by the crew set, so subscribe to the current week and filter
  client-side against the visit ids on screen. At this company's scale (≤ a few hundred
  visits/week) that is cheap.

**Schedule-wide** (`ScheduleRealtime`) — owners need live in-progress state, so the schedule
subscribes to `visits` UPDATE and writes each `payload.new` **straight into the React Query
cache** via `applyVisitUpdate` (`hooks/useManagementSchedule.ts`). It is version-guarded on
`updated_at`, so a dropped or out-of-order message can't pin a stale value; an unguarded write
would beat fresher server data on every later render. There is no separate overlay store any
more — the `Map<visitId, VisitOverlay>` that `SessionsProvider` kept was folded into the cache
in R5.5, because the grid no longer reads server props and a third store only meant every
consumer had to remember to merge.

`CrewsOnSitePanel` (the schedule's `Today` view) fetches in-progress visits and subscribes to
`visits` UPDATE — and deliberately does **not** cache: offline it says it needs a connection
rather than showing a frozen list with a ticking timer. Don't "fix" that.

> **Known gap:** nothing subscribes to `visit_crew` for *other* people, so a crew change made
> elsewhere doesn't reach a screen until something refetches. That is why `bulkAssignRoute`
> needs `useRefreshSchedule()` — and why the vehicle appeared live while the crew avatars
> didn't, which read as a rendering glitch rather than a missing invalidation. Raised in
> REDESIGN.md under "Tabled".

Treat realtime as best-effort, never the source of truth. Owner start/stop alerts are
**in-app only** — no email / SMS / push (Phase 8.3). If an owner doesn't have the app open,
they catch up on next open. (Unaffected by the 8.2/8.3 SMS deferral — these were always
designed as in-app only, and they are built and working.)

> Why this matters: the old `assigned_crew uuid[]` design could not be filtered by
> Supabase Realtime (its `postgres_changes` filters don't support array containment),
> and arrays can't be FK-joined or cleanly used in RLS. `visit_crew` fixes all three.

---

## Development Conventions

- **TypeScript strict mode** — no `any` types
- **Mutations follow the *surface*, not the route group** (see Data Architecture above):
  `/app/*` uses the **offline mutation queue** for field-critical writes; `/management/*` uses
  **Server Actions**. A Server Action on an `/app/*` page is allowed only for genuinely
  desk-shaped work, and must both refresh the client cache and say "needs a connection".
- **React Query** for client-side data fetching and caching — required on every field
  route, optional on desk routes
- **Zod schemas** for all form validation — define schemas in `lib/validators/`
- **Never** import Supabase browser client in a Server Component
- **Never** import Supabase server client in a Client Component
- File naming: `PascalCase` for components, `camelCase` for utilities
- Server Components are still the default on **desk** routes; field routes are client-first
  behind a thin RSC shell — see Data Architecture above
- All Supabase queries go through typed client — run `supabase gen types typescript`
  after schema changes and commit `types/database.ts`
- **Two Supabase projects now exist**: dev `obbbvohmcaneehzxuuyo` (what `.env.local` points
  at) and prod `lrhjvbtqqgkwvinxqyec` (live at `rooted-gardens.vercel.app`). Vercel
  auto-deploys `main`, so **merging is deploying** — prod's schema must be migrated *before*
  schema-dependent code reaches `main`, and destructive changes invert that order
  (expand/contract). Full sequence: **"Making a schema change (dev → prod)" in
  `docs/DEPLOYMENT.md`**. Note `supabase link` is a file in the checkout
  (`supabase/.temp/project-ref`), shared by every terminal — always confirm which project
  you're pointed at before `db push --linked`.
- Keep schedule-related logic in `lib/utils/schedule.ts`
- Keep QBO sync logic in `lib/quickbooks/sync.ts` — never inline it
- **Check trio:** `npm run build` · `npm run typecheck` · `npm run lint` — use `npm run typecheck` (not `npx tsc --noEmit`) for type checking. `app/sw.ts` is excluded from the main typecheck (webworker lib) — run `npm run typecheck:sw` when touching it; `npm run build` also fails if it's broken, since `createSerwistRoute` compiles it at build time.
- **Migrations before 2026-08-07 are squashed.** `supabase/migrations/` starts at
  `20260807090000_baseline_schema.sql`, a single schema-only dump of the dev project (plus
  hand-carried Storage buckets/policies and `site_content`/`site_collection_items` seed
  rows) — this is what a fresh (prod) project is provisioned from. The 32 original
  incremental migration files are preserved, unmodified, at `supabase/migrations_archive/`
  purely as history — several are referenced by filename elsewhere in this doc (e.g.
  `20260630130000_drop_service_zones`, `20260723000000_drop_time_entries`). The dev
  project's own migration history was reconciled to match (`supabase migration repair
  --linked --status reverted <31 old versions>`) so `supabase migration list --linked`
  shows only the one baseline row on both sides.

---

## Environment Variables

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
QBO_SERVICE_ITEM_NAME=Services  # shared Product/Service every invoice line bills against

# Cron (invoice-status sync — app/api/cron/sync-invoice-status)
CRON_SECRET=                    # Vercel Cron sends this as `Authorization: Bearer <secret>`

# Twilio — DEFERRED 2026-07-25, none of these are set or needed right now.
# Listed for when SMS (PHASES.md 8.2/8.3) is picked back up. No email is used anywhere,
# ever — that's permanent, not deferred.
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_MESSAGING_SERVICE_SID= # use a Messaging Service, not a raw number

# App
NEXT_PUBLIC_APP_URL=            # https://yourapp.vercel.app
NEXT_PUBLIC_ENABLE_SW=          # '1' to register the service worker in dev (see
                                 # components/ServiceWorkerRegistration.tsx). Unset
                                 # in dev, the worker double-fetches every changing
                                 # Turbopack chunk via defaultCache's
                                 # StaleWhileRevalidate — found feeding a dev-server
                                 # CPU livelock. Always on in production regardless.
```

---

## Things to Avoid

- Do NOT build a customer-facing **portal** — i.e. no customer login or self-service
  account management (out of scope). NOTE: a **public marketing site + one-way inquiry /
  job-application form** (anonymous, no auth) is NOT a portal and IS in scope — see the
  `(public)` route group and the `leads` table (Phase 9).
- Do NOT build a native mobile app — PWA is sufficient
- Do NOT use Prisma or Drizzle — use Supabase client directly with generated types
- Do NOT pull data FROM QuickBooks — sync is one-way (app → QBO), with ONE narrow,
  intentional exception: reading an invoice's lifecycle **status** back (draft/sent/paid/
  overdue) via a daily cron + manual "Refresh now". That's status only — never customer/
  payment data, never edits made in QBO, and never anything that feeds back into invoice
  creation or pricing.
- Do NOT store Supabase service role key anywhere client-accessible
- Do NOT use `any` types — generate proper types from Supabase schema
- Do NOT build pricing tiers or pricing calculation logic — prices are stored flat per account
- Do NOT rebuild invoicing UI — QBO handles invoice presentation; we only push data to it
