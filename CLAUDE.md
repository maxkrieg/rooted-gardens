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
  (installable from browser, no app store), mobile-first for all `/crew/*` routes.
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
- **Serwist** (`@serwist/next`) — PWA manifest and service worker for crew mobile install.
  Replaces `next-pwa` (unmaintained and webpack-based — incompatible with Turbopack/Next 16)
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
- **Twilio** — outbound SMS for crew schedule-change notifications. This is the only
  notification channel besides in-app realtime — **no email anywhere in the app**.
  - Sent from a Supabase Edge Function (`send-sms`), never inline
  - Requires US **A2P 10DLC** brand + campaign registration — start early, ~1–2 week
    carrier approval gates all delivery
  - STOP/HELP handled via inbound webhook → `employees.sms_opt_out`

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
│   ├── management/              ← desktop management UI
│   │   ├── layout.tsx           ← sidebar nav, desktop shell
│   │   ├── dashboard/page.tsx
│   │   ├── schedule/page.tsx    ← the main schedule grid
│   │   ├── accounts/
│   │   │   ├── page.tsx         ← account list
│   │   │   └── [id]/page.tsx    ← account detail
│   │   ├── billing/page.tsx     ← invoice queue
│   │   ├── fleet/page.tsx
│   │   └── team/page.tsx
│   ├── crew/                    ← mobile crew UI (PWA)
│   │   ├── layout.tsx           ← bottom nav, mobile shell
│   │   ├── today/page.tsx       ← today's stops
│   │   └── stop/[visitId]/
│   │       └── page.tsx         ← individual stop detail + log
│   └── api/
│       ├── quickbooks/
│       │   ├── connect/route.ts ← OAuth initiation
│       │   └── callback/route.ts← OAuth callback
│       └── webhooks/
│           ├── supabase/route.ts
│           └── twilio/route.ts   ← inbound STOP/HELP (SMS opt-out)
├── components/
│   ├── ui/                      ← shadcn components (auto-generated, don't edit)
│   ├── management/              ← desktop-specific components
│   │   ├── ScheduleGrid.tsx     ← the week grid (core component)
│   │   ├── AccountCard.tsx
│   │   ├── RouteGroup.tsx
│   │   └── InvoiceQueue.tsx
│   └── crew/                    ← mobile-specific components
│       ├── StopCard.tsx
│       ├── VisitLogger.tsx
│       └── ServiceTypeSelector.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            ← browser client
│   │   ├── server.ts            ← server client (Server Actions / RSC)
│   │   └── middleware.ts
│   ├── quickbooks/
│   │   ├── client.ts
│   │   └── sync.ts              ← push visits to QBO
│   └── utils/
│       ├── dates.ts             ← week helpers (getWeekStart, etc.)
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
  billing_type text NOT NULL   -- 'per_visit' | 'contract' | 'as_needed'
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
  price_per_visit numeric(8,2), -- only for per_visit accounts
  contract_rate numeric(8,2),   -- only for contract accounts
  contract_period text,         -- 'monthly' | 'seasonal' (for contract accounts)
  status text DEFAULT 'active'  -- 'active' | 'inactive' | 'prospective'
    CHECK (status IN ('active', 'inactive', 'prospective')),
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
  service_interest text         -- 'lawn' | 'garden' | 'both' | 'other' (routes the SMS)
    CHECK (service_interest IN ('lawn', 'garden', 'both', 'other')),
  message text,
  source text DEFAULT 'website',
  details jsonb,                -- kind-specific extras (e.g. job position, resume path)
  assigned_to uuid FK → employees,
  converted_account_id uuid FK → accounts,  -- set when a lead becomes an account
  created_at, updated_at
)
-- RLS: anon role INSERT only (public form, no reads); owner/lead SELECT+UPDATE;
-- crew/accountant no access. Realtime-enabled for the management new-lead toast.

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
  created_at, updated_at
)

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
  sms_opt_out boolean DEFAULT false,  -- honor STOP; suppress schedule-change texts
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

-- Time tracking — payroll shift clock (one shift per employee per day, approved for
-- payroll). Distinct from visits.started_at/ended_at (per-job on-site time); this is
-- the daily clock-in/out. They are not auto-derived from each other.
time_entries (
  id uuid PK,
  employee_id uuid FK → employees,
  visit_id uuid FK → visits,            -- nullable (some time not tied to a visit)
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer DEFAULT 0,
  approved boolean DEFAULT false,
  approved_by uuid FK → employees,
  notes text,
  created_at, updated_at
)
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
  billing_type text NOT NULL            -- denormalized snapshot: 'per_visit' | 'contract' | 'as_needed'
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
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
| `owner` | Full access to all management and crew views |
| `lead` | Schedule read + crew views + visit logging |
| `crew` | Crew views only (`/crew/*`) — today's stops, log completion |
| `accountant` | Billing views only + account read |

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
Two fundamentally different account types — never conflate them:

- **`per_visit`** — residential, one price per completed visit. Each visit = one QBO invoice line. Price stored on `accounts.price_per_visit`.
- **`contract`** — commercial or large properties. Flat periodic rate regardless of how many visits occurred. Invoice is periodic (monthly/seasonal), not per-visit. Price stored on `accounts.contract_rate`.
- **`as_needed`** — quoted per engagement, no set schedule.

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
- Numeric data (schedule, billing, timesheets) → Hanken Grotesk with `tabular-nums`.
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

### Mobile (Crew) — `/crew/*`
- Full-height viewport, touch-optimized
- Bottom navigation bar (Today | History | Profile)
- Large tap targets (min 44px)
- Minimal text, icon-forward
- No tables, no dense layouts
- Offline-tolerant: use Supabase Realtime + local state, show stale data gracefully
- Colors & type: per the **Design System** above (warm paper bg, sage-green primary, Fraunces +
  Hanken Grotesk). Favor high contrast and large type for sunlight legibility in the field.

### Management — `/management/*` (phone-primary, responsive)
- Owners use these routes **mostly on a phone**, occasionally on a laptop — design
  mobile-first, then enhance for desktop. Do NOT build desktop-only layouts.
- Navigation: bottom bar / hamburger on phone; collapsible left sidebar on desktop.
- Data-dense tables, grids, and multi-column layouts are fine on desktop but must
  degrade to card / stacked layouts on phone — no horizontal-scrolling tables for owners.
- The schedule grid is the core view and the hardest to fit on a phone. Provide a
  **mobile-adapted view** (e.g. single week, vertically stacked by route group) that
  collapses the 4-week desktop grid. Spreadsheet-like density is a desktop affordance.
- Billing (`/management/billing/*`) is the exception — the accountant is laptop-first,
  so it can assume a wide screen and stay table/grid-dense.
- Colors & type: per the **Design System** above; lean on the warm neutrals for dense data and
  use `tabular-nums` for numeric columns (schedule, billing, timesheets).

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

## Data Architecture: Online Management vs. Offline-Tolerant Crew

The two halves of this app have **different data-fetching models** because they run in
different environments. Do not apply one pattern uniformly — pick the model by route group.

### `/management/*` — phone-primary, online → Server-first
Owners use these routes mostly on a phone (occasionally a laptop); the accountant's
billing views are laptop. Unlike `/crew/*`, these flows **assume a working connection**
— they are not built to be offline-tolerant.
- **Reads:** React Server Components fetch directly with the Supabase **server** client.
- **Writes:** **Server Actions** (form submits, status changes, scheduling, QBO push).
- React Query is optional here — only for client-side interactivity that needs caching
  (e.g. the schedule grid's optimistic cell updates). Default to RSC + Server Actions.
- **Field-use caveat:** because owners are phone-primary, an owner may schedule from the
  field on weak signal. Server-first is still the default — do NOT build a management
  offline queue speculatively. If field connectivity becomes a real pain point, extend
  the crew offline-queue pattern (below) to the specific management mutations that hurt.

### `/crew/*` — mobile PWA, rural VT, intermittent connectivity → Client-first + offline queue
Crew work in areas with no guaranteed signal. Server Components and Server Actions are
network round-trips and **do not work offline**, so the crew side cannot depend on them
for its core loop (view stops → log completion → upload photo).
- **Reads:** **client components** using **React Query** over the Supabase **browser**
  client. React Query's cache (persisted to IndexedDB via
  `@tanstack/query-persist-client`) is what crew see when offline — show it as stale,
  don't block on the network.
- **Writes:** go through an **offline mutation queue** (IndexedDB), NOT Server Actions.
  A completion, photo, or **job start/stop** logged offline is enqueued locally with a
  device-captured timestamp, the UI updates optimistically, and the queue flushes to
  Supabase when connectivity returns. The queue itself is built in Phase 4 / task 4.1.
- **Realtime:** subscribe with the browser client (see below). Treat realtime as a
  best-effort enhancement on top of the cache, never the source of truth.

### Realtime subscriptions
**Crew** (`/crew/*`) — because crew↔visit links now live in `visit_crew` (not a `uuid[]`),
subscriptions are relational and filterable:
- **New / changed assignments:** subscribe to `visit_crew` filtered by
  `employee_id=eq.<my_employee_id>` and `relation=eq.assigned`.
- **Content changes** (crew instruction edits, new stops in the week): subscribe to
  `visits`. Realtime cannot filter `visits` by the crew set, so subscribe to the current
  week and filter client-side against the `visit_id`s the crew member is assigned to.
  At this company's scale (≤ a few hundred visits/week) this is cheap.

**Management** (`/management/*`) — owners need live in-progress state, so the schedule and
dashboard subscribe to `visits` UPDATE events. `SessionsProvider` (schedule page) tracks a
`Map<visitId, { started_at, ended_at }>` overlay updated by realtime; the schedule grid and
mobile list merge this with server-fetched visit data. `CrewsOnSitePanel` (dashboard) queries
visits where `started_at IS NOT NULL AND ended_at IS NULL` on mount, then subscribes to
`visits` UPDATE to add/remove entries live. Treat realtime as a best-effort live overlay on
top of server-rendered data, never the source of truth. Owner start/stop alerts are
**in-app only** — no email / SMS / push (Phase 8.3). If an owner doesn't have the app open,
they simply catch up on next open.

> Why this matters: the old `assigned_crew uuid[]` design could not be filtered by
> Supabase Realtime (its `postgres_changes` filters don't support array containment),
> and arrays can't be FK-joined or cleanly used in RLS. `visit_crew` fixes all three.

---

## Development Conventions

- **TypeScript strict mode** — no `any` types
- **Mutations follow the route group** (see Data Architecture above): `/management/*`
  uses **Server Actions**; `/crew/*` uses the **offline mutation queue**, never Server
  Actions, so completions/photos survive loss of signal
- **React Query** for client-side data fetching and caching (required on `/crew/*`,
  optional on `/management/*`)
- **Zod schemas** for all form validation — define schemas in `lib/validators/`
- **Never** import Supabase browser client in a Server Component
- **Never** import Supabase server client in a Client Component
- File naming: `PascalCase` for components, `camelCase` for utilities
- Prefer Server Components by default on `/management/*`; add `'use client'` only when
  needed (event handlers, hooks, browser APIs). `/crew/*` is client-first by design
  (offline support) — see Data Architecture above
- All Supabase queries go through typed client — run `supabase gen types typescript`
  after schema changes and commit `types/database.ts`
- Keep schedule-related logic in `lib/utils/schedule.ts`
- Keep QBO sync logic in `lib/quickbooks/sync.ts` — never inline it
- **Check trio:** `npm run build` · `npm run typecheck` · `npm run lint` — use `npm run typecheck` (not `npx tsc --noEmit`) for type checking

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

# Twilio (SMS notifications — no email is used anywhere in the app)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=   # use a Messaging Service, not a raw number

# App
NEXT_PUBLIC_APP_URL=            # https://yourapp.vercel.app
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
