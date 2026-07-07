# PHASES.md — Rooted Gardens Build Plan

This file tracks the phased build of the Rooted Gardens internal business app.
See `CLAUDE.md` for full context, tech stack, schema, and conventions.

> **Post-launch schema change (2026-06-30):** `service_zones` — referenced throughout
> Phases 1–4 below as the named-work-area layer between properties and visits — was
> eliminated in migration `20260630130000_drop_service_zones`. Frequency moved to
> `properties`; visits now anchor directly to a property (one visit per property per
> week); the multi-zone/multi-frequency-per-area capability described in tasks like 2.5,
> 3.6, and 3.11 was intentionally dropped. The task descriptions below are left as-is —
> they're a historical record of what was built at the time — but `service_zones` no
> longer exists. See `CLAUDE.md` for the current schema.
>
> **Post-launch schema change (2026-06-29):** `visit_sessions` — the per-employee job
> start/stop table referenced throughout Phase 3 (3.11) and Phase 4 (4.1, 4.10, 4.11) —
> was collapsed into `visits` in migration `20260629120000_collapse_visit_sessions.sql`.
> Start/stop timing now lives directly on `visits.started_at` / `visits.ended_at`;
> `visits.actual_date` was dropped (completion date is derived from `ended_at`, falling
> back to `week_start`). "In progress" is `started_at IS NOT NULL AND ended_at IS NULL` —
> a derived state, never a `visits.status` value. See `lib/utils/visits.ts`
> (`isVisitInProgress`). Task descriptions below are left as historical record.
>
> **Post-launch schema change (2026-06-30):** `'invoiced'` was removed as a `visits.status`
> value in migration `20260630140000_drop_invoiced_status.sql`. Billing state is now the
> derived flag `invoiced_at IS NOT NULL` — the same convention as the in-progress state
> above. `visits.status` is only ever `'scheduled' | 'completed' | 'skipped'`. Phases 3
> and 4 below describe the old `status='invoiced'` model as historical record; **Phase 5
> (Billing) has been corrected in place**, since it's still unbuilt.
>
> **Post-launch additions (2026-07-02 / 2026-07-03):** `photos.type` gained a `'plan'`
> value — owner/lead-managed reference photos on the Visit Plan, distinct from crew's
> `'visit'` completion photos — in `20260702150000_photos_add_plan_type.sql`.
> `property_route_groups` gained a uniqueness constraint — a property belongs to at most
> one route group at a time — in `20260703120000_property_route_groups_unique_property.sql`.
> Neither changes any task below; noted here for completeness.

Each task is written to be handed directly to Claude Code as a prompt. Phases are ordered
as a sensible default build sequence, but the authoritative dependency graph is the
`Depends on:` line under each task — tasks with disjoint dependencies can be built in
parallel or reordered freely. **Phase 0** holds external / lead-time setup to start on day
one. A few cross-phase dependencies are intentional and flagged inline (e.g. the management
in-progress view 3.11 consumes the crew start/stop producer 4.10; build it against seed data
1.9 and validate once 4.10 lands).

> **Per-phase verification:** each phase ends with a **"✅ Verifying Phase N"** section — a
> checklist to run *after* that phase's tasks are done, confirming they work together. These are
> gates for you (or the agent on request): they use plain bullets, never
> `- [ ]` checkboxes.

---

## Phase 0 — Start at Kickoff (parallel, lead-time items)

> These are not coding tasks — they're external setup with real lead time, so start them on
> day one, in parallel with Phase 1. Nothing here blocks *beginning* Phase 1 coding, but
> several later tasks block on them, so kicking them off late stalls the end of the build.

- [~] **0.1 — A2P 10DLC SMS registration** (blocks 8.2 → 8.3) <!-- blocked: needs human — Twilio account + TCR brand/campaign registration, carrier approval ~1-2 weeks -->
  *Depends on: — (start here)*
  Create the Twilio account and start brand + campaign registration with The Campaign
  Registry (brand = Tigertown Farm LLC, EIN / business details; campaign = operational
  schedule notifications). Carrier approval takes ~1–2 weeks and gates ALL SMS delivery, so
  begin immediately. A verified toll-free number is the fallback path.

- [x] **0.2 — Intuit developer app for QuickBooks**
  *Depends on: — (start here)*
  Create an Intuit Developer account and app to obtain `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`
  and configure the OAuth redirect URI. Production keys require Intuit app review — develop
  against sandbox now, request production review before Phase 5 ships.
  **Sandbox credentials are live**: real `QBO_CLIENT_ID`/`QBO_CLIENT_SECRET` are in
  `.env.local`, unblocking 5.2–5.4. Production app review (required before the real
  production QuickBooks company can be connected, as opposed to the sandbox company)
  is still outstanding — do before Phase 5 ships to real users.

- [~] **0.3 — Provision cloud accounts** (blocks Phase 1) <!-- blocked: needs human — Supabase project URL/keys, Vercel project, Twilio Messaging Service -->
  *Depends on: — (start here)*
  Create the Supabase project (URL + anon + service-role keys), the Vercel project, and the
  Twilio Messaging Service. Populate `.env.local`. This is the one Phase 0 item that actually
  blocks starting Phase 1 (1.2 needs the Supabase project).

### ✅ Verifying Phase 0 — Kickoff

External / human items (they stay `[~]` until a person finishes them). Confirm each is *started*:
- Twilio account exists and the A2P 10DLC brand + campaign are **submitted** to The Campaign Registry (0.1).
- ~~Intuit Developer app created; sandbox `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` + redirect URI in `.env.local`~~ — **done**: sandbox connect flow verified live end-to-end (0.2).
- Supabase + Vercel projects provisioned, keys in `.env.local`; Twilio Messaging Service created (0.3).
- Note: local dev needs none of these (local Supabase handles the database) — they gate production / live integrations only.

---

## Phase 1 — Project Foundation

> Goal: Working Next.js + Supabase project with auth, typed schema, PWA config, seed data,
> and the two layout shells (management desktop, crew mobile).

- [x] **1.1 — Init Next.js project**
  *Depends on: — (start here)*
  Scaffold a new Next.js 16 project with TypeScript, Tailwind CSS, and App Router
  (Turbopack is the default bundler — do not add a webpack config).
  Install core dependencies: `@supabase/supabase-js`, `@supabase/ssr`,
  `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, `lucide-react`.
  Initialize shadcn/ui. Set up `.env.local` with placeholder Supabase vars.
  Create the directory structure from `CLAUDE.md`.
  **Materialize the "Field & Foliage" design system now** (per CLAUDE.md → UI Conventions →
  Design System), so every later UI task inherits it: load **Fraunces** + **Hanken Grotesk** via
  `next/font/google` in `app/layout.tsx` (expose as `--font-display` / `--font-sans`); write all
  color tokens, `--radius`, the brand accents (`--clay`/`--ochre`/`--bark`/`--sap`), the warm
  shadow, and light + dark themes into `app/globals.css` as CSS variables; wire the Tailwind theme
  to those variables and set Hanken Grotesk as the default sans + Fraunces as the display family.
  Verify the dev server renders a warm-paper background with the sage-green primary before moving on.

- [x] **1.2 — Supabase project and full schema migration**
  *Depends on: 1.1, 0.3*
  Write a single SQL migration file at `supabase/migrations/001_initial_schema.sql`
  that creates all tables from `CLAUDE.md` exactly: `accounts`, `properties`,
  `service_zones`, `route_groups`, `property_route_groups`, `employees`,
  `vehicles`, `equipment`, `visits`, `visit_crew`, `visit_sessions`, `time_entries`,
  `photos`, `integrations`. Note: crew assignment/completion live in the `visit_crew`
  join table (with the `visit_crew_employee_idx` index), NOT as `uuid[]` columns on
  `visits`. `visit_sessions` (job start/stop, with its partial active-session index)
  is operational on-site time — distinct from `time_entries` payroll shift time.
  Include: UUID primary keys, all CHECK constraints, all FK relationships,
  `created_at` / `updated_at` columns, and an `updated_at` trigger function
  applied to all tables. Enable RLS on all tables (policies come in Phase 2).

- [x] **1.2.1 - Cloud supabase set up**
  1. Go to supabase.com → New project
  2. Once provisioned: Settings → API → copy the Project URL, anon key, and service_role key into .env.local
  3. Authentication → URL Configuration:
    - Site URL: http://localhost:3000
    - Add to Redirect URLs: http://localhost:3000/auth/callback
  4. Push your schema: run ! supabase db push (this applies your migration to the cloud project)

- [x] **1.3 — Supabase client utilities**
  *Depends on: 1.1*
  Create `lib/supabase/client.ts` (browser client singleton using `createBrowserClient`),
  `lib/supabase/server.ts` (server client using `createServerClient` with cookie
  handling for Server Components and Server Actions), and
  `lib/supabase/middleware.ts` (middleware client). Create a React Query provider
  wrapper in `components/providers.tsx` and add it to the root layout.
  (Comes before auth because the auth flow and the root `proxy.ts` use these clients.)

- [x] **1.4 — Supabase Auth with magic link**
  *Depends on: 1.1, 1.3*
  Configure Supabase Auth for magic link (email only). Create the login page at
  `app/(auth)/login/page.tsx` with an email input form that calls
  `supabase.auth.signInWithOtp()`. Show a "check your email" confirmation state
  after submit. Create an auth callback handler at
  `app/auth/callback/route.ts`. Add the root request proxy at `proxy.ts` (the Next 16
  rename of the old `middleware.ts` convention) that protects all `/management/*` and
  `/crew/*` routes and redirects unauthenticated users to `/login`. Use `@supabase/ssr`
  for cookie-based session handling.

- [x] **1.5 — Generate TypeScript types from schema**
  *Depends on: 1.2*
  Run `supabase gen types typescript --local > types/database.ts`. Create
  `types/app.ts` with higher-level app types built on top of DB types — e.g.
  `AccountWithProperty`, `VisitWithZone`, `VisitWithCrew` (visit joined to its
  `visit_crew` rows + employees), `EmployeeWithUser`. These joined types
  are what components actually consume.

- [x] **1.6 — Management layout shell (desktop)**
  *Depends on: 1.1, 1.4*
  Create `app/management/layout.tsx` with a fixed left sidebar and main content
  area. Sidebar contains: logo, nav links (Dashboard, Schedule, Accounts, Billing,
  Fleet, Team), and a bottom user/logout section. Use shadcn `Sheet` for a
  collapsible mobile sidebar fallback. Sidebar should show the active route.
  Desktop: sidebar always visible. Mobile: hamburger toggle. Apply green primary
  color (`#4a7c59`) as the brand accent throughout.

- [x] **1.7 — Crew layout shell (mobile PWA)**
  *Depends on: 1.1*
  Create `app/crew/layout.tsx` with a full-viewport mobile layout and a
  sticky bottom navigation bar with three tabs: Today (home icon), History
  (clock icon), Profile (user icon). Configure **Serwist** (`@serwist/next`) — wrap
  `next.config.ts` with `withSerwist` and add the service-worker entry (e.g.
  `app/sw.ts`) — with a manifest at `public/manifest.json` (app name "Rooted Crew", green
  theme color, standalone display mode). Add PWA meta tags to the root layout.
  The crew layout should have no sidebar — bottom nav only. Ensure the viewport
  meta tag prevents zoom on input focus.

- [x] **1.8 — Role-based routing proxy**
  *Depends on: 1.2, 1.4*
  Extend `proxy.ts` (Next 16's root proxy; formerly `middleware.ts`) to fetch the user's
  employee role after auth check.
  Redirect `accountant` role users away from `/crew/*`. Redirect `crew` role
  users away from `/management/*` (except allow them to reach `/crew/*`).
  Owners and leads can access both. Store role in a cookie after first fetch
  to avoid a DB call on every request.

- [x] **1.9 — Seed data for development**
  *Depends on: 1.2*
  Create `supabase/seed.sql` with a **small, lean** set of realistic but fictional dev data —
  enough to build and test every screen against, no more. **Hard caps (do not exceed):**
  - **5 accounts** (mix of per_visit and contract), **8 properties**, **12 service zones**
    (include one multi-zone contract property),
  - **5 employees** (1 owner, 3 crew, 1 accountant), **3 vehicles**, **4 equipment** items,
  - **3 weeks** of visit history with `visit_crew` assignment/completion rows,
  - **~6 `visit_sessions`**: a few completed (start + stop) and **at least one open** session
    (`ended_at = null`) so the in-progress UI (3.11) has live data.
  Runnable with `supabase db reset`. Do NOT use any real client data from the Excel spreadsheet.
  **Keep it cheap & apply once:** generate the seed at roughly the sizes above (this is a dev
  fixture, not a stress test — bigger costs a lot to generate for no benefit). Insert in
  FK-safe order (accounts → properties → service_zones → route_groups → employees → visits →
  visit_crew → visit_sessions). Run `supabase db reset` **once** to verify; if it errors, fix the
  **specific** offending statements in place — do NOT regenerate the whole file from scratch.
  (Moved up from Phase 8 — everything in Phases 2–4 is developed against this data.)

### ✅ Verifying Phase 1 — Foundation

**Automated (must pass):**
- `npm run build` · `npx tsc --noEmit` · `npm run lint`
- `supabase db reset` applies `001_initial_schema` + `seed.sql` with no errors.

**Functional:**
- `npm run dev` renders a warm-paper background, sage-green primary, Fraunces headings + Hanken body (1.1).
- All 14 tables exist (check the `db reset` output or `psql \dt`), including `visit_crew` and `visit_sessions` (1.2).
- `/login` sends a magic link and shows the "check your email" state (1.4).
- Signed out, `/management/*` and `/crew/*` redirect to `/login`; once signed in, role gating works (crew can't reach `/management`) (1.8).
- `types/database.ts` matches the schema with no drift (1.5).
- Seed contains ≥1 **open** `visit_session` (`ended_at IS NULL`) for the 3.11 UI (1.9).

---

## Phase 2 — Accounts & Properties

> Goal: Full CRUD for accounts, properties, and service zones. The CRM layer.
> This is the foundation everything else is built on.

- [x] **2.1 — RLS policies for accounts and properties**
  *Depends on: 1.2*
  Write RLS policies for `accounts`, `properties`, `service_zones`, and
  `route_groups`. Rules: `owner` and `lead` roles can SELECT/INSERT/UPDATE.
  `crew` role can SELECT only (they need property notes on their stops).
  `accountant` role can SELECT all and UPDATE `accounts.qbo_customer_id`.
  Use a helper function `get_my_role()` that reads from `employees` table
  to keep policies DRY.

- [x] **2.2 — Account list page**
  *Depends on: 1.6, 2.1, 1.9*
  Create `app/management/accounts/page.tsx`. Fetch all accounts server-side
  with property count and last visit date. Render a searchable, filterable table
  with columns: Name, Billing Type (badge), Status (badge), Price/Rate, Last Visit.
  Include a filter bar for status (`active` / `inactive` / `prospective`) and
  billing type. Add a "New Account" button that opens a slide-over sheet form.
  Use shadcn `Table`, `Badge`, `Sheet`.

- [x] **2.3 — New account form (slide-over)**
  *Depends on: 2.2*
  Create `components/management/AccountForm.tsx`. Fields: name (required),
  contact name, email, phone, billing type (radio: Per Visit / Contract / As Needed),
  price per visit (shown only when Per Visit selected), contract rate + period
  (shown only when Contract selected), status, notes. Validate with Zod.
  Submit via Server Action that inserts into `accounts`. On success, close sheet
  and revalidate account list. Show inline field errors.

- [x] **2.4 — Account detail page**
  *Depends on: 2.2*
  Create `app/management/accounts/[id]/page.tsx`. Show three sections:
  (1) Account info card with edit button, (2) Properties section listing all
  properties with their service zones, (3) Recent visits timeline (last 10 visits
  across all zones). Add "Add Property" button. Each property shows its address,
  zone list with frequency badges, and crew notes. Include a QBO customer ID
  field with a "Link to QuickBooks" status indicator.

- [x] **2.5 — Property and service zone management**
  *Depends on: 2.4*
  Create `components/management/PropertyForm.tsx` for adding/editing a property:
  address, parking notes, access notes, crew notes. Below the property form,
  show the service zones list. Allow adding zones (name, frequency, sort order,
  notes) and reordering them via drag-and-drop (use `@dnd-kit/sortable`).
  For simple accounts, auto-create one zone named "Full Property" on property
  creation. Zone sort order determines crew visit sequence.

- [x] **2.6 — Route group management**
  *Depends on: 2.4*
  Create a "Route Groups" section within `app/management/accounts/page.tsx`
  or as a sub-page. Display geographic clusters. Allow creating new route groups
  (name, sort order) and assigning properties to them via a multi-select. This
  is how the owner organizes the daily routes. Show a count of properties per group.

- [x] **2.7 — Account search and quick-lookup**
  *Depends on: 2.2*
  Add a global search command palette (shadcn `CommandDialog`, triggered by
  `Cmd+K`). Search across account names, contact names, and addresses.
  Results navigate to the account detail page. This is critical for the owner to
  quickly pull up a client record.

- [x] **2.8 — RLS policies for visits, sessions, time & media**
  *Depends on: 1.2 (independent of the rest of Phase 2 — can run in parallel with 2.1)*
  Write RLS policies for the operational tables not covered by 2.1: `visits`,
  `visit_crew`, `visit_sessions`, `time_entries`, `photos`, and `integrations`,
  reusing the `get_my_role()` helper from 2.1. Rules:
  - `visits` / `visit_crew`: `owner`/`lead` full write; `crew` SELECT rows they're
    linked to via `visit_crew` and UPDATE completion fields on their own visits;
    `accountant` SELECT + the invoicing fields.
  - `visit_sessions`: `crew` INSERT/UPDATE only their own (`employee_id = me`);
    `owner`/`lead` SELECT all, plus INSERT/UPDATE for `source = 'manual'` corrections.
  - `time_entries`: `crew` INSERT/UPDATE own; `owner`/`lead` SELECT all + approve.
  - `photos`: `crew` INSERT; all roles SELECT for properties they can see.
  - `integrations`: service-role / `owner` only — never exposed to `crew` or `accountant`.
  Do this before Phases 3/4 build against these tables.

### ✅ Verifying Phase 2 — Accounts & Properties

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass; `supabase db reset` clean.

**Functional (against seed data):**
- Account list loads with property counts + last-visit; status and billing-type filters work (2.2).
- New/edit account form validates (Zod) and persists; price/contract fields show conditionally (2.3).
- Account detail shows info + properties-with-zones + recent-visits timeline + QBO link indicator (2.4).
- Property + zone CRUD works; zone drag-reorder persists `sort_order`; a simple property auto-creates a "Full Property" zone (2.5).
- Route groups create + assign properties with per-group counts (2.6); Cmd+K search finds accounts / contacts / addresses (2.7).

**Security / RLS (2.1, 2.8) — switch `employees.role` or sign in per role:**
- `crew` = SELECT-only on accounts/properties; `accountant` can update only `accounts.qbo_customer_id`.
- `visit_sessions` / `time_entries` / `photos` policies enforced; `integrations` never readable by `crew` or `accountant`.

---

## Phase 3 — Schedule Grid

> Goal: The week-based schedule — the owner's primary management tool. This replaces the
> spreadsheet and is the most complex view in the app. The owner is **phone-primary**, so
> this ships as two responsive faces over one data layer: a dense multi-week grid on
> desktop (3.2) and a stacked single-week view on phone (3.10).

- [x] **3.1 — Schedule data layer**
  *Depends on: 1.5, 2.6, 2.8*
  Create `lib/utils/schedule.ts` with helpers: `getWeekStart(date)` → Monday,
  `getWeeksInRange(start, end)` → array of week-start dates,
  `isZoneDueThisWeek(zone, weekStart)` → boolean based on frequency and last
  visit. Create a Server Action `getScheduleForWeek(weekStart)` that returns
  all route groups → properties → service zones → visits for a given week,
  in route group sort order.

- [x] **3.2 — Schedule grid core component (desktop)**
  *Depends on: 3.1*
  Create `components/management/ScheduleGrid.tsx` — the **desktop / wide-screen**
  layout. Rows are service zones (grouped by route group, then property). Columns
  are the current week and 3 future weeks (4-week rolling view). Each cell represents
  a (zone × week) visit. Cell states: empty/unscheduled (gray), scheduled (light
  green), completed (green with date), skipped (yellow), invoiced (blue), and
  has-instruction (orange border — the "orange cell" from the spreadsheet).
  Make the grid horizontally scrollable for more weeks. Header row shows week
  dates. Left column shows zone name + property address. On phone this grid is
  replaced by the stacked view in 3.10 (responsive swap on viewport) — keep all
  data fetching in the shared layer (3.1) so the two views never fork logic.

- [x] **3.3 — Visit cell interactions**
  *Depends on: 3.2*
  Each visit cell is clickable. Clicking an empty cell creates a scheduled visit
  for that zone + week (Server Action). Clicking an existing visit opens a
  `VisitDetailSheet` (shadcn `Sheet`). The sheet shows: current status, crew
  instruction field (editable), assigned crew (multi-select), vehicle assignment,
  completion details if done. Owners can edit any field; crew can only view.
  Add keyboard shortcut: press `S` on a cell to quick-schedule.

- [x] **3.4 — Crew assignment on schedule**
  *Depends on: 3.3*
  Add a crew assignment panel to the `VisitDetailSheet`. Show a multi-select
  of active employees. Assignments are written to `visit_crew` rows with
  `relation = 'assigned'` (insert added, delete removed) — never a `uuid[]` on
  the visit. Display crew member names as small avatar chips on the
  schedule cell (abbreviated first name, truncated if more than 2). Crew
  assignment can be set at the route group level for the week (bulk assign)
  or per individual visit. Add a "Assign Route" button on route group headers
  that opens a dialog to bulk-assign crew + vehicle for all visits in that
  group for the week.

- [x] **3.5 — Week navigation and "active week" indicator**
  *Depends on: 3.2*
  Add previous/next week navigation arrows to the schedule grid header.
  Highlight the current week column. Add a "Jump to today" button. Persist
  the selected week in URL search params (`?week=2026-06-08`) so the URL
  is shareable. Add a mini calendar popover for jumping to any week.

- [x] **3.6 — Multi-zone property display**
  *Depends on: 3.2*
  Service zones for the same property should visually group together in the
  grid with a subtle left border and indentation. Show the property address
  as a group header row, then each zone indented below it. For multi-zone
  (contract) accounts, show a "CONTRACT" badge on the property header row.
  Per-visit accounts show their price on hover.

- [x] **3.7 — Crew instruction ("orange cell") workflow**
  *Depends on: 3.3 (crew-side banner also needs 4.3)*
  The `crew_instruction` field on a visit is a one-time note for crew for
  that specific visit. In the grid, cells with a crew instruction show an
  orange dot indicator. In the `VisitDetailSheet`, the crew instruction field
  is prominently placed at the top (above status). On the crew mobile stop
  view, if a crew instruction exists, show it in a highlighted orange banner
  at the very top of the stop detail, above everything else.

- [x] **3.8 — Skip visit workflow**
  *Depends on: 3.3*
  The status dropdown (moved to the top of `VisitDetailSheet` for prominence) is
  the single control for all status changes. Selecting `skipped` intercepts the
  change and opens a dialog for an optional skip reason; cancelling reverts the
  dropdown. On confirm, sets status to `skipped` and stores reason in `skip_reason`
  via a dedicated `skipVisit` server action. If a skip reason was provided, it is
  shown inline below the status dropdown. Changing status back to `scheduled` (or
  any other status) goes through the normal Save flow and automatically clears
  `skip_reason`. Skipped cells show in yellow in the grid via the existing
  `status-skipped` CSS class. Skipped visits are NOT invoiced.

- [x] **3.9 — Schedule dashboard page**
  *Depends on: 3.1*
  Create `app/management/dashboard/page.tsx`. Show:
  (1) "Today at a glance" — visits scheduled for today, crew assignments, any
  with orange instructions highlighted first.
  (2) "This week" summary — total scheduled, completed, skipped, uninvoiced.
  (3) Equipment status — any mowers/trucks flagged as maintenance.
  (4) Outstanding crew instructions that haven't been completed yet.
  This is the first thing the owner sees when they open the app.

- [x] **3.10 — Mobile-adapted schedule view (phone)**
  *Depends on: 3.2, 3.5, 3.6*
  Owners are phone-primary, so the 4-week desktop grid (3.2) must collapse to a usable
  phone layout — never a horizontally-scrolling spreadsheet on a phone. Create a
  responsive alternative (e.g. `components/management/ScheduleListMobile.tsx`) that
  renders a **single week at a time**, vertically stacked by route group → property →
  zone (reuse the grouping from 3.6). Each zone row is a large tap target that opens
  the same `VisitDetailSheet` from 3.3; render the cell-state colors (3.2) as
  status chips/badges instead of grid cells, and surface crew instructions as the
  orange indicator (3.7). Use the week navigation from 3.5 (prev/next, jump to today)
  to move between weeks since there are no columns. Switch between grid and list purely
  on viewport (CSS / responsive), sharing the same data layer (3.1) and Server Actions
  — do not fork the scheduling logic.

- [x] **3.11 — In-progress visit visibility (management)**
  *Depends on: 3.9, 4.10 (data producer) — buildable now against 1.9 seed, validate once 4.10 lands*
  Surface live "who's on site now" to owners off the `visit_sessions` table (job start/stop).
  The crew producer is task 4.10, so build this UI against seed data (1.9 includes an open
  session) and validate end-to-end once 4.10 lands. Three surfaces, all driven by one
  management Realtime subscription to `visit_sessions` (INSERT = start, UPDATE with
  `ended_at` = stop), treated as a best-effort live overlay:
  (1) Schedule grid (3.2) and mobile list (3.10): an in-progress cell/row shows a pulsing
  "On site" indicator with crew initials + running elapsed time, derived from open sessions
  (`ended_at IS NULL`), layered on top of the status badge — do NOT add a status value.
  (2) `VisitDetailSheet` (3.3): an "On site now" section listing each active crew member and
  elapsed time, plus a session history (start → stop, duration) for the visit. Owners can
  manually add/correct a session (`source = 'manual'`).
  (3) Dashboard (3.9): a "Crews on site now" panel listing every visit currently in progress
  across the company — property + crew + elapsed — updating live.
  Put the derived helpers (`isVisitInProgress`, `activeSessionsFor`, elapsed formatting) in
  `lib/utils/visits.ts`.

### ✅ Verifying Phase 3 — Schedule

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass.

**Functional (against seed data):**
- Desktop grid renders service zones × current+3 weeks with the correct cell-state colors (3.2).
- Clicking an empty cell creates a scheduled visit; clicking a visit opens `VisitDetailSheet` and edits persist (3.3).
- Crew assignment adds/removes `visit_crew` rows (`relation='assigned'`) and shows avatar chips; bulk "Assign Route" works (3.4).
- Prev/next week, "jump to today", `?week=` URL param, and mini-calendar all work (3.5).
- Same-property zones group with a CONTRACT badge on multi-zone accounts (3.6); crew-instruction cells show the orange dot/banner (3.7).
- Skip sets `skipped` + reason and undo reverts (3.8); dashboard shows today / this-week / equipment / outstanding instructions (3.9).
- Narrowing the viewport swaps the grid for the stacked single-week mobile list, same `VisitDetailSheet` (3.10).
- The seed's open session shows a live pulsing "On site" overlay on the grid + dashboard (3.11).

---

## Phase 4 — Crew Mobile Experience

> Goal: The PWA that crew members use in the field. Must be fast, simple, and work well on a
> phone with one hand. This is what replaces texting. The offline foundation (4.1) comes
> first because the crew side is offline-tolerant by design — every later task in this phase
> builds on it.

- [x] **4.1 — Offline foundation for crew PWA**
  *Depends on: 1.3, 1.7*
  Establish the offline-first substrate the rest of Phase 4 builds on (CLAUDE.md "Data
  Architecture" makes the crew side offline-tolerant by design — this is NOT end-of-project
  polish, which is why it moved out of Phase 8). Configure the service worker (via Serwist,
  set up in 1.7) to cache the crew routes and static assets. Persist the React Query cache to IndexedDB
  (`@tanstack/query-persist-client`) so crew see their last-fetched stops when offline, shown
  as stale. Build the **offline mutation queue** (IndexedDB): completions (4.4), photos (4.5),
  and job start/stop (4.10) enqueue locally with device timestamps, apply optimistically, and
  flush to Supabase when connectivity returns. Show a "You're offline" banner and a
  pending-sync indicator. Most crew stops are in rural Vermont — connectivity is not guaranteed.

- [x] **4.2 — Today's stops page (crew mobile)**
  *Depends on: 4.1, 1.2*
  Create `app/crew/today/page.tsx` as a **client** page using React Query over
  the Supabase browser client (this route must work from cache when offline — see
  CLAUDE.md "Data Architecture"). Show a vertical list of the current user's
  visits for today (join `visit_crew` on `employee_id = me AND relation = 'assigned'`),
  sorted by route group order (property stop sequence).
  Each stop card shows: property address (large, tappable to open Maps),
  account name, frequency badge, zone name(s) if multi-zone, and status chip.
  If a crew instruction exists, show an orange banner on the card. No tables,
  no dense data — cards only. Empty state: "No stops scheduled for today."

- [x] **4.3 — Stop detail page (crew mobile)**
  *Depends on: 4.2*
  Create `app/crew/stop/[visitId]/page.tsx`. Full-screen mobile view with:
  (1) Orange banner at top if `crew_instruction` is set — large, prominent.
  (2) Address with one-tap "Open in Maps" button.
  (3) Property notes (access notes, crew notes, parking notes) — collapsible.
  (4) For multi-zone stops: list of zones with frequency badges so crew knows
  what's due this visit.
  (5) "Log Completion" button (large, green, bottom of screen).
  (6) "Skip This Stop" button (small, secondary, below main button).

- [x] **4.4 — Visit completion logger (crew mobile)**
  *Depends on: 4.1, 4.3*
  Tapping "Log Completion" on the stop detail slides up a bottom sheet.
  Fields: actual date (date picker, defaults to today), service types
  (multi-select checkbox group: Mow, Double Cut, Trim, Edge, Leaf Mulch, Other),
  completion note (optional textarea), photo upload button. Large touch targets.
  Submit through the crew **offline mutation queue** (built in 4.1; NOT a Server Action — see
  CLAUDE.md "Data Architecture"): set status to `completed`, actual_date,
  service_types[], completion_note, and insert a `visit_crew` row for the current
  user with `relation = 'completed'`. The mutation is applied optimistically and
  flushed to Supabase when online. On success, return to today's list with the
  stop marked done (green check).

- [x] **4.5 — Photo capture on mobile**
  *Depends on: 4.4*
  Add a "Add Photo" button in the completion logger bottom sheet. On mobile,
  this triggers the device camera via `<input type="file" accept="image/*" capture="environment">`.
  Upload to Supabase Storage at path `photos/{property_id}/{visit_id}/{timestamp}.jpg`
  (queued via 4.1 when offline). Show thumbnail preview after capture. Allow up to 4
  photos per visit. Store photo record in `photos` table with `type = 'visit'`. Show
  photo thumbnails on the stop detail page for completed visits.

- [x] **4.6 — Skip stop workflow (crew mobile)**
  *Depends on: 4.3*
  Tapping "Skip This Stop" opens a simple bottom sheet with an optional
  text field for skip reason and a large "Confirm Skip" button. Sets visit
  status to `skipped`. Show skipped stops differently on the today list
  (grayed out, strikethrough) but keep them visible so crew has a record
  of what they passed on.

- [x] **4.7 — Clock in / clock out (crew mobile)**
  *Depends on: 4.1, 1.2*
  Add clock in/out to the crew Profile tab (`app/crew/profile/page.tsx`).
  Show current clock state (in or out) with elapsed time if clocked in.
  Large toggle button. Clock in creates a `time_entries` record with `clock_in`.
  Clock out updates the same record with `clock_out`. Show today's hours summary.
  If a crew member tries to log a visit completion without being clocked in,
  show a reminder (not a blocker).

- [x] **4.8 — Visit history (crew mobile)**
  *Depends on: 4.1, 1.2*
  Create `app/crew/history/page.tsx` (the History tab). Show the last 30
  completed visits for the current crew member (join `visit_crew` on
  `employee_id = me AND relation = 'completed'`), most recent first. Each row:
  date, property address, service types. Tapping a row shows the visit detail
  (read-only). This helps crew confirm what they did and when.

- [x] **4.9 — Realtime schedule updates**
  *Depends on: 4.2*
  Use Supabase Realtime to push schedule changes to crew phones without refresh.
  Two subscriptions (the old `assigned_crew @> [...]` array filter is not supported
  by Realtime — see CLAUDE.md "Realtime subscriptions"):
  (1) `visit_crew` filtered by `employee_id=eq.<my_id>` and `relation=eq.assigned`
  — fires when the owner assigns the crew member to a new/changed stop;
  (2) `visits` for the current week — fires on crew-instruction edits and new stops;
  filter client-side against the set of `visit_id`s the crew member is assigned to.
  On a relevant change, invalidate the React Query cache and show a subtle toast:
  "Your schedule was updated." This replaces the texting workflow entirely.

- [x] **4.10 — Job start/stop tracking (crew mobile)**
  *Depends on: 4.1, 4.3*
  **Shared session model** — one session per visit, not per employee. On the stop detail page
  (4.3), a large **Start Visit** button opens one `visit_sessions` row for the whole team
  (`started_at = device now`, `ended_at = null`, `source = 'crew_app'`). The button flips to a
  running **Stop** button (showing elapsed time). Any assigned crew member — not just the
  initiator — can tap Stop to set `ended_at = device now`. If the crew forgot to tap Start, a
  **"Set start time"** link opens a datetime picker (`SetStartTimeSheet`) that creates a session
  retroactively with `source = 'manual'` and the crew-chosen `started_at`.
  Both writes go through the **offline mutation queue** (`lib/crew/mutation-queue.ts`;
  NOT a Server Action — see CLAUDE.md "Data Architecture"), captured with device timestamps so
  they stay correct if logged offline and synced later; the button reflects local optimistic state
  immediately. Stopping does NOT change `visits.status` — after Stop, a non-blocking "Log
  completion now?" banner appears to chain into the 4.4 completion flow.
  **Attendance** (who was there) is tracked via `visit_crew.relation='completed'` rows written by
  the 4.4 completion logger, not by separate sessions. The session is a visit timer only.
  **RLS changes** (migration `20260628220414_visit_session_shared_model.sql`):
  - Partial unique index `visit_sessions_one_open_per_visit` enforces one open session per visit.
  - SELECT: crew can now see sessions for visits they're assigned to (not just their own `employee_id`).
  - INSERT: crew may now insert `source = 'manual'` for retroactive start time.
  - UPDATE: any crew member assigned to the visit can stop the session (not just the initiator).
  Highlight an in-progress stop on **both** the today list (4.2) and the crew schedule list
  (4.11) using `isVisitInProgress` / `formatElapsed` from `lib/utils/visits.ts`.
  `useWeekSchedule` (`hooks/crew/useWeekSchedule.ts`) fetches `visit_sessions` on the visits
  query; `ScheduleStopRow` (`components/crew/ScheduleStopRow.tsx`) renders the terracotta pulse.
  Realtime-enable the `visit_sessions` table so the management subscription in 3.11 receives
  start/stop events live.

- [x] **4.11 — Crew schedule view & self-reassignment (crew mobile)**
  *Depends on: 4.1, 4.2, 4.9*
  (Added during the build — not in the original plan.) Beyond their own assigned stops
  (Today, 4.2), crew can view the **full week's schedule** for all route groups and
  self-organize coverage. Adds a 4th crew nav tab (Today | **Schedule** | History | Profile,
  `CalendarRange` icon) in `app/crew/layout.tsx`. The page `app/crew/schedule/page.tsx` is a
  client page using `useWeekSchedule(week)` (`hooks/crew/useWeekSchedule.ts`) — the
  client-first analogue of the management `getScheduleForWeek` Server Action — with week
  navigation (prev/next + "This week"). Rows render via `components/crew/ScheduleStopRow.tsx`
  (address, account, zone, frequency + status badge, assigned crew first names), grouped by
  route group → property → zone (`buildScheduleWeek` in `lib/utils/schedule.ts`), and link
  into the same `/crew/stop/[visitId]` detail. `components/crew/CrewScheduleFilters.tsx`
  provides search + crew ("My stops" / by employee) + route-group filters. Crew can
  self-reassign via `components/crew/CrewAssignSheet.tsx` + `hooks/crew/useReassignCrew.ts`
  (writes `visit_crew` `relation='assigned'` rows; online-required, NOT offline-queued).
  RLS migration `supabase/migrations/20260628150000_crew_schedule_visibility.sql` lets crew
  SELECT all visits / visit_crew / the employee roster and INSERT/DELETE their own `assigned`
  rows. The page inherits the layout-level realtime sync (4.9) and the IndexedDB React Query
  cache (4.1) for free — no separate wiring. (In-progress "On site" indicators on the schedule
  rows are added by 4.10.)

### ✅ Verifying Phase 4 — Crew PWA

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass; the Serwist service worker registers with no build errors.

**Functional (mobile viewport / device):**
- **Offline (DevTools → Offline):** today's stops still render from cache; a completion / photo / start-stop queues locally and syncs on reconnect (4.1).
- App is installable ("Add to Home Screen"); manifest + service worker present.
- Today list shows assigned stops in route order; stop detail shows notes / maps / zones; history lists the last 30 completed (4.2 / 4.3 / 4.8).
- Completion writes `visit_crew` (`relation='completed'`) + status; photos upload to Storage + a `photos` row; skip works (4.4 / 4.5 / 4.6).
- Clock in/out writes/updates `time_entries`; a completion-without-clock-in shows the reminder (4.7).
- Editing a visit in management pushes a realtime toast to the crew view (4.9); Start/Stop writes `visit_sessions` and the 3.11 overlay updates live, and the in-progress "On site" pulse shows on **both** the today list and the crew schedule list (4.10).
- The Schedule tab shows the full week grouped by route group; prev/next + "This week" nav works; search / crew / route-group filters narrow the list; rows open the same stop detail; crew self-reassignment writes `visit_crew` `assigned` rows (4.11).

---

## Phase 5 — Billing & QuickBooks

> Goal: The accountant's workflow. Invoice queue for completed visits,
> one-click push to QuickBooks. Accountant works on laptop, desktop-first.
>
> **Scaffolding already exists — replace in place, don't create new files:**
> `app/management/billing/page.tsx`, `components/management/InvoiceQueue.tsx`,
> `lib/quickbooks/client.ts`, and `lib/quickbooks/sync.ts` are all literal stubs
> (`return null` / `export {}`); `app/api/quickbooks/connect/route.ts` and
> `app/api/quickbooks/callback/route.ts` return `501`. The "Billing" nav link already
> exists in `components/management/ManagementNav.tsx`.

- [x] **5.1 — Invoice queue page**
  *Depends on: 4.4, 2.4*
  Create `app/management/billing/page.tsx`. Show all visits that are
  `status = 'completed' AND invoiced_at IS NULL` (reuse the existing
  `visits_uninvoiced_idx` partial index — no new query logic needed), grouped by
  account. For `per_visit` accounts: each visit is one invoice line with the account's
  `price_per_visit`. For `contract` accounts: show completed visits as a
  summary (not individual lines) with the periodic contract rate.
  Include a date range filter (default: current month). Accountant can
  check/uncheck individual visits before pushing. Show running total.
  **Added beyond the original scope**: a "Mark N visits as invoiced" bulk action
  (`markVisitsInvoiced` in `app/management/billing/actions.ts`) that sets `invoiced_at`
  directly on the selected visits — a stopgap so the accountant gets real use out of
  this page before the QuickBooks push (5.4) exists, which is gated on OAuth setup
  (5.2/5.3) and Intuit's production review. Month nav via `?month=yyyy-MM`
  (`components/management/BillingMonthNav.tsx`, mirrors `ScheduleNav.tsx`'s pattern);
  grouping via `lib/utils/billing.ts` (`groupVisitsByAccount`, mirrors
  `lib/utils/schedule.ts`'s `groupRowsByAccount`).

- [x] **5.2 — QuickBooks OAuth setup**
  *Depends on: 1.2, 0.2*
  Create `app/api/quickbooks/connect/route.ts` that initiates the OAuth 2.0
  flow using `intuit-oauth`. Create `app/api/quickbooks/callback/route.ts`
  that handles the callback, stores access_token and refresh_token in the
  `integrations` table. Create `lib/quickbooks/client.ts` that returns an
  authenticated QBO client, automatically refreshing the token if expired.
  Add a "Connect QuickBooks" button on the billing page that shows connection
  status (connected / disconnected / token expired).
  **Implementation notes**: `proxy.ts` does not protect `/api/quickbooks/*` at
  all (its matcher only covers `/management/*` and `/crew/*`), so both route
  handlers do their own complete auth + owner-role check (`supabase.rpc('get_my_role')`)
  rather than relying on any upstream gating — RLS-backed, not just the UI-hint
  `rg-role` cookie the rest of the app reads. CSRF via a random `state` stored
  in a short-lived httpOnly cookie, verified on callback. Added
  `lib/supabase/service.ts` (`createServiceClient`) since `integrations` RLS is
  owner-only but 5.3/5.4 are accountant-facing — the token read/refresh path in
  `getQuickBooksClient` needs to work under any calling role; the OAuth
  callback's actual token write still goes through the normal RLS client as a
  defense-in-depth second gate. `types/quickbooks.d.ts` holds minimal ambient
  types for `intuit-oauth`/`node-quickbooks` (neither ships official types),
  verified against the installed packages' JS source rather than assumed.
  **Live-verified (2026-07-07)**: real sandbox `QBO_CLIENT_ID`/`QBO_CLIENT_SECRET`
  now exist (0.2 unblocked) — ran the full connect flow end-to-end and confirmed
  a genuine `integrations` row (real `realm_id`, `token_expires_at` ~1hr out,
  matching Intuit's actual access-token lifetime), queried directly via the
  service-role key to rule out placeholder/stale data.

- [x] **5.3 — QuickBooks customer sync**
  *Depends on: 5.2*
  Create `lib/quickbooks/sync.ts` with a `syncCustomer(accountId)` function.
  If `accounts.qbo_customer_id` is null, create a new QBO customer using
  `account.name` and contact details, then store the returned QBO ID.
  If it exists, fetch and verify the customer still exists in QBO.
  Show QBO link status on the account detail page with a "Link / Refresh" button.
  **Implementation notes**: `node-quickbooks` is callback-style (confirmed by
  reading its source), so `lib/quickbooks/client.ts` gained a shared
  `qboPromise` adapter (reused by 5.4's invoice push later) rather than each
  call site hand-rolling its own. QBO's "customer not found" comes back as an
  HTTP 400 with a `Fault` body (code `'610'`) in one of two shapes depending on
  the library's error path — `syncCustomer` detects both and transparently
  recreates the customer if the stored `qbo_customer_id` is stale, surfacing a
  distinct "reconnected" toast rather than a plain success. `contact_name` is
  deliberately not sent to QBO (single free-text field, no reliable mapping to
  QBO's `GivenName`/`FamilyName`/`CompanyName`). The write touches only the
  `qbo_customer_id` column via the normal RLS client — `accounts`' owner/lead
  UPDATE policy and the accountant column-guard trigger already permit exactly
  this. **Live-verified (2026-07-07)**: linked a real account ("Maple Ridge
  HOA") via the UI, then confirmed against the QuickBooks sandbox API directly
  (`GET /v3/company/{realmId}/customer/{id}`) — the returned `DisplayName`,
  `PrimaryEmailAddr`, and `PrimaryPhone` matched the account exactly, proving
  the full `createCustomer` round-trip works, not just the DB write. The
  610-not-found/recreate path is still unexercised (would need a customer
  manually deleted on the QBO side to trigger).

- [ ] **5.4 — Push invoices to QuickBooks**
  *Depends on: 5.1, 5.3*
  Add a "Push to QuickBooks" button on the billing invoice queue. For selected
  visits: (1) ensure account has a QBO customer ID (auto-create if not),
  (2) create a QBO Invoice with one line item per visit for `per_visit` accounts
  or one line per contract period for `contract` accounts, (3) set `invoiced_at`
  (`now()`) and `qbo_invoice_id` — **`status` stays `'completed'`; `'invoiced'` is not a
  `visits.status` value** (billing is the derived flag `invoiced_at IS NOT NULL`, same
  convention as the in-progress state). `hooks/crew/useSetVisitInvoiced.ts` already
  implements exactly this write, currently wired to a manual owner checkbox in
  `components/VisitDetailContent.tsx` as a placeholder — extend/reuse that mutation and
  trigger it automatically after a successful push rather than writing a new one.
  Show a progress indicator during push. Show success/failure per account.
  Wrap in a transaction: if QBO push fails, do not set `invoiced_at`.

- [ ] **5.5 — Invoiced visits view**
  *Depends on: 5.4*
  Add an "Invoiced" tab to the billing page showing visits where
  `invoiced_at IS NOT NULL`, grouped by month. Show QBO invoice ID as a link
  (link to `https://app.qbo.intuit.com/app/invoice?txnId={id}`).
  Show total invoiced per month. Allow filtering by account.
  This is the accountant's audit trail — equivalent to the red text in the
  old spreadsheet.

- [ ] **5.6 — Invoice amount snapshot**
  *Depends on: 5.4*
  When `invoiced_at` is set, snapshot the price into `visits.invoice_amount`.
  This preserves the amount even if the account's price changes later.
  Display the invoiced amount (not current price) in the invoiced history view.
  Add a simple revenue summary to the billing page: MTD invoiced, YTD invoiced,
  broken down by billing type (per-visit vs contract).

### ✅ Verifying Phase 5 — Billing & QuickBooks

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass.

**Functional:**
- Invoice queue lists visits where `status = 'completed' AND invoiced_at IS NULL`, grouped by account; `per_visit` = one line each, `contract` = periodic summary; date filter + running total (5.1).
- Invoiced tab lists visits where `invoiced_at IS NOT NULL`, by month, with QBO links; shows the `invoice_amount` snapshot (not live price); MTD/YTD revenue summary (5.5 / 5.6).

**Human-gated (needs Intuit sandbox creds — `live-untested` otherwise):**
- "Connect QuickBooks" OAuth round-trip stores tokens in `integrations` (5.2); `syncCustomer` creates/links a QBO customer (5.3).
- "Push to QuickBooks" creates a sandbox invoice and sets `invoiced_at` + `qbo_invoice_id` only on success (transactional); `status` remains `'completed'` (5.4).

---

## Phase 6 — Fleet & Equipment

> Goal: Track trucks and mowers. The owner assigns them to routes. Flag maintenance.
> Largely self-contained — only needs Phase 1; can run in parallel with Phases 3–5.
>
> **Scaffolding already exists — replace in place:** `app/management/fleet/page.tsx` is a
> literal stub (`return null`); the "Fleet" nav link already exists in
> `components/management/ManagementNav.tsx`. The `vehicles` table and some vehicle UI
> (assignment dropdown in `components/VisitDetailContent.tsx`, `useActiveVehicles`) already
> exist and are reusable — only the maintenance-log sub-feature (6.3) and this page are unbuilt.

- [ ] **6.1 — Fleet management page**
  *Depends on: 1.6, 1.2*
  Create `app/management/fleet/page.tsx` with two sections: Vehicles and
  Equipment. Each shows a card grid (not a table). Vehicle card: name, plate,
  status badge, current assignment if any, last maintenance note. Equipment card:
  name, type badge, status badge, last serviced date (flag red if overdue).
  Add "New Vehicle" and "New Equipment" buttons that open inline forms.

- [ ] **6.2 — Daily fleet assignment**
  *Depends on: 6.1, 3.9*
  On the schedule grid (Phase 3), vehicle assignment is per-visit. Add a
  "Fleet Status Today" panel to the dashboard that shows: which vehicles are
  assigned to which route groups today, and which equipment items are in use.
  If a vehicle or mower has `status = 'maintenance'`, show a warning icon
  and exclude it from assignment dropdowns.

- [ ] **6.3 — Maintenance logging**
  *Depends on: 6.1*
  On vehicle and equipment detail cards, add a "Log Maintenance" button.
  Opens a form: date, description of work, next service due date, cost (optional).
  Store in a `maintenance_logs` table (create migration). Show maintenance
  history as a timeline on the card. When next service date is within 2 weeks,
  show a yellow badge on the fleet page and dashboard.

### ✅ Verifying Phase 6 — Fleet & Equipment

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass; `supabase db reset` applies the new `maintenance_logs` migration.

**Functional (against seed data):**
- Fleet page shows vehicles + equipment as card grids with status badges; overdue service flagged red (6.1); new vehicle/equipment forms persist.
- "Log Maintenance" writes `maintenance_logs`, shows a timeline, and badges service due within 2 weeks (6.3).
- Dashboard "Fleet Status Today" panel shows assignments; `maintenance` vehicles/equipment are excluded from assignment dropdowns (6.2).

---

## Phase 7 — Team & Timesheets

> Goal: Employee profiles and basic hour tracking for payroll.
>
> **Scaffolding already exists — replace in place:** `app/management/team/page.tsx` is a
> literal stub (`return null`); the "Team" nav link already exists in
> `components/management/ManagementNav.tsx`.

- [ ] **7.1 — Team management page**
  *Depends on: 1.6, 1.4*
  Create `app/management/team/page.tsx`. Gate the entire page to `owner` role
  only (proxy redirect + RLS) — leads and crew cannot access team management.
  Show all employees as cards: name, role badge, side (lawn/garden), phone,
  active status. The "Add Employee" form (slide-over sheet) collects: name,
  phone, email, role (dropdown: Owner / Lead / Crew / Accountant), side
  (lawn / garden / both), and creates the employee record. Role is set at
  creation time — not at invite time — so there is no ambiguity about
  what access a new hire gets. After saving, an "Invite to App" button on
  the employee card sends the magic link via
  `supabase.auth.admin.inviteUserByEmail()` and links the returned auth UUID
  to `employees.user_id`. Show "Has app access" vs "No app access" indicator
  based on whether `employees.user_id` is set. Capture SMS consent here (used
  by 8.2) — a per-employee opt-in toggle backed by `sms_opt_out`.

- [ ] **7.2 — Timesheet management (management view)**
  *Depends on: 7.1, 4.7*
  Create a timesheet view under the team page. Show this week's time entries
  in a grid: employees as rows, days as columns, hours as cells. Allow owners
  to manually add/edit entries. Show daily and weekly totals. Add an "Approve
  Week" action that marks all entries for that week as `approved = true`.

- [ ] **7.3 — Hours export**
  *Depends on: 7.2*
  Add an "Export Timesheet" button that downloads a CSV of approved time entries
  for a selected date range. Columns: Employee Name, Date, Clock In, Clock Out,
  Break, Total Hours, Approved. This is what goes to payroll. Format dates/times
  in EST. Use a Server Action that streams the CSV response.

### ✅ Verifying Phase 7 — Team & Timesheets

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass.

**Functional:**
- Team page lists employees with role / side / active + "has app access" badges (7.1); "Invite to App" sends a magic link; the SMS-consent toggle persists to `sms_opt_out`.
- Timesheet grid shows the week's `time_entries` (employees × days) with daily/weekly totals; manual add/edit works; "Approve Week" sets `approved = true` (7.2).
- "Export Timesheet" downloads a CSV of approved entries for a date range, with times in EST (7.3).

---

## Phase 8 — Polish, Reporting & Edge Cases

> Goal: Make it production-ready. Notifications, reports, error states, edge cases.
> (The offline foundation and seed data that used to live here moved earlier — to 4.1
> and 1.9 respectively — because they're foundational, not polish.)

- [ ] **8.1 — Property photo gallery**
  *Depends on: 2.4, 4.5*
  On the account detail page, add a "Photos" tab. Show all photos for the
  property grouped by type: How-To Guide photos (permanent crew reference),
  Visit photos (chronological), Customer Requests (flagged areas). Owners
  can upload how-to photos from desktop (drag-and-drop). Photos display in
  a lightbox. Allow captioning photos. This replaces the informal photo
  sharing the owner currently uses for new employee onboarding.

- [ ] **8.2 — SMS delivery infrastructure (Twilio)**
  *Depends on: 1.2, 7.1, 0.1*
  Stand up outbound SMS so the 8.3 notifications can reach crew phones when the PWA is
  closed. This is the only notification channel besides in-app realtime — no email.
  - **Provider:** Twilio. Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
    `TWILIO_MESSAGING_SERVICE_SID` (use a Messaging Service, not a raw number, so the
    sender pool and opt-outs are managed) in Vercel env + Supabase secrets.
  - **Sender:** create a Supabase Edge Function `send-sms` that takes (employee_id, body),
    skips anyone with `employees.sms_opt_out = true` or no `phone`, and calls Twilio.
    All notification triggers (8.3) call this function — never call Twilio inline elsewhere.
  - **A2P 10DLC registration:** must already be in progress from 0.1 — US business SMS over a
    10-digit number requires a registered brand (Tigertown Farm LLC) + campaign with The
    Campaign Registry, and carrier approval (~1–2 weeks) gates all delivery. A verified
    toll-free number is the fallback path.
  - **Compliance:** honor STOP/HELP. Add an inbound webhook at
    `app/api/webhooks/twilio/route.ts` that sets `employees.sms_opt_out = true` on STOP and
    clears it on START/UNSTOP. Only text employees who have consented (consent captured on
    the Team page, 7.1).
  - **Delivery logging:** persist send attempts + Twilio status callbacks so a missed text
    is debuggable. Keep volume low — SMS is for schedule changes, not per-stop chatter.

- [ ] **8.3 — Notification system for schedule changes**
  *Depends on: 8.2, 4.9, 3.11*
  When the owner updates a crew instruction, changes crew assignment, or adds a new stop, send
  an **SMS** to affected crew members via the Twilio infrastructure in 8.2 (DB webhook /
  trigger → `send-sms` Edge Function). Message: "Rooted: your schedule for [day] changed —
  [N] stops. Open the app." Keep texts minimal — a nudge to open the PWA, not a full
  schedule — they directly replace the manual texting workflow the owner does today. **No email
  is used anywhere in the app.** In-app, the 4.9 realtime toast already covers crew who have
  the app open; SMS covers when it's closed.
  **Owner start/stop alerts:** the owners are notified of every job start/stop
  (4.10) **in-app only**, via the 3.11 Realtime overlay — live on-site indicators plus a
  subtle toast ("[Crew] started [Property]" / "[Crew] finished [Property] (1h 12m)").
  No email or push for these: start/stop is high-frequency and the owners live in the app.
  There is no separate durable channel for start/stop — if the app is closed they catch
  up on next open. (Coalesce duplicate events from a session that syncs already-ended.)

- [ ] **8.4 — Revenue and operations reporting**
  *Depends on: 5.6, 4.4*
  Add a Reports section to the management sidebar. Include:
  (1) Revenue by month (bar chart — invoiced amount, not scheduled)
  (2) Visits per crew member per week (who's doing the most work)
  (3) Per-account visit frequency vs scheduled frequency (is anyone being
  under-served?) Use shadcn charts or recharts. Keep it simple — 3 charts max.

- [ ] **8.5 — Error states and empty states**
  *Depends on: Phases 2–7 (audit pass over everything built)*
  Audit all pages for missing error boundaries, loading states, and empty states.
  Every list view needs an empty state with a helpful message and a CTA.
  Every async operation needs a loading indicator. Wrap the app in an
  `ErrorBoundary`. Add Supabase query error handling with user-friendly messages
  ("Could not load schedule — try refreshing"). No raw error strings shown to users.

- [ ] **8.6 — Mobile experience polish**
  *Depends on: Phase 4, 3.10*
  Audit the crew PWA and the phone-primary management views on real iOS and Android devices
  (or browser DevTools device emulation). Cover every crew surface, including the
  `/crew/schedule` page (4.11) — verify its week-nav buttons are easily tappable, the
  search/crew/route-group filter row doesn't cause horizontal scroll, and rows aren't hidden
  under the bottom nav. Check: tap target sizes (min 44px), no horizontal
  scroll, inputs don't zoom on focus (font-size ≥ 16px on inputs), bottom sheet doesn't get
  covered by keyboard, "Add to Home Screen" prompt works, back navigation works
  naturally. Fix any rough edges found.

### ✅ Verifying Phase 8 — Polish, Reporting & Notifications

**Automated:** `npm run build` · `tsc --noEmit` · `lint` pass; a final full `supabase db reset` is clean.

**Functional:**
- Property "Photos" tab groups how-to / visit / customer-request photos in a lightbox with captions (8.1).
- Reports render 3 charts from real invoiced/visit data: revenue by month, visits per crew, frequency vs scheduled (8.4).
- Audit: every list view has empty + loading + error states; the app is wrapped in an `ErrorBoundary`; no raw error strings reach users (8.5).
- Mobile audit: ≥44px tap targets, inputs ≥16px (no zoom-on-focus), no horizontal scroll, installable, natural back-nav (8.6).

**Human-gated (needs Twilio — `live-untested` otherwise):**
- `send-sms` Edge Function skips opted-out / no-phone employees; the STOP inbound webhook flips `sms_opt_out` (8.2).
- A schedule change (crew instruction / assignment / new stop) triggers the SMS to affected crew (8.3). In-app realtime owner start/stop alerts are already covered by the Phase 3/4 checks.

---

## Phase 9 — Public Marketing Site & Lead Intake (CRM-lite)

> Goal: the customer-facing "front door" the internal app has been missing — a public
> marketing site (home + a few sub-pages, modeled on myrootedgardens.com) and a lightweight
> lead pipeline so prospect inquiries flow straight into the app instead of off-channel
> phone/email. Captured in a new `leads` table, triaged in a management inbox, and converted
> into a `prospective` account. This is **not** a customer portal (no customer login / no
> self-service account management — that stays out of scope, see CLAUDE.md). The blog
> ("Gardening Notes") is **deferred** — link out to the existing site for now.
>
> Additive and depends on earlier phases: lead→account conversion reuses the Phase 2
> account/property forms + `get_my_role()` RLS helper; the new-lead SMS reuses the Twilio
> `send-sms` Edge Function (8.2); the Leads inbox lives in the management shell (1.6). The
> public marketing pages themselves only need the design system (1.1).

- [ ] **9.1 — `leads` table + RLS migration**
  *Depends on: 1.2, 2.1*
  New migration `supabase/migrations/0xx_leads.sql` creating `leads`:
  `id uuid PK`, `kind text CHECK (kind IN ('service_inquiry','job_application'))`,
  `status text DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost'))`,
  `name text NOT NULL`, `email text`, `phone text`, `address text`,
  `service_interest text CHECK (service_interest IN ('lawn','garden','both','other'))`,
  `message text`, `source text DEFAULT 'website'`,
  `details jsonb` (kind-specific extras — e.g. job position, resume storage path),
  `assigned_to uuid FK → employees`, `converted_account_id uuid FK → accounts`,
  `created_at` / `updated_at` + the shared `updated_at` trigger. Enable RLS + Realtime.
  RLS (reuse `get_my_role()` from 2.1): **anon role INSERT only** (the public form — no
  reads); `owner` / `lead` SELECT/UPDATE; `accountant` / `crew` no access. Update
  `types/database.ts` (`supabase gen types`) and add a `Lead` app type in `types/app.ts`.
  Add 2–3 seed leads to `supabase/seed.sql` (one per `kind`) so the inbox has data.

- [ ] **9.2 — Public route group, shared layout & proxy allowlist**
  *Depends on: 1.1*
  Create the `app/(public)/` route group with `layout.tsx` — public chrome (top nav: Lawn,
  Gardens, About, FAQ, Jobs, Contact; footer with both division contacts (Matt / lawn,
  Krystyna / garden) + socials; a small "Staff log in" link → `/login`). No management
  sidebar / crew bottom-nav. Move the landing page to `app/(public)/page.tsx` and **remove
  the `/login` redirect from root** `app/page.tsx` (keep the `?code=` → `/auth/callback`
  handling). Add the public paths (`/`, `/lawn`, `/gardens`, `/about`, `/faq`, `/jobs`,
  `/contact`) to the `proxy.ts` **public allowlist** so they're reachable signed-out; keep
  `/management/*` and `/crew/*` protected. Per-page `metadata` (title / description / Open
  Graph) for SEO. Field & Foliage styling throughout.

- [ ] **9.3 — Home / landing page**
  *Depends on: 9.2*
  `app/(public)/page.tsx`: hero + mission ("your yard becomes part of a connected network of
  regenerative landscapes"), two service-line cards (The Electric Lawn / Rooted Gardens
  design), the ELA partnership badge, a "Field Notes" teaser that **links out** to the
  existing blog (deferred), and a prominent "Get started" CTA → the inquiry form (9.5).
  Phone-first, responsive.

- [ ] **9.4 — Marketing sub-pages: Lawn, Gardens, About, FAQ**
  *Depends on: 9.2*
  Content pages mirroring the live site, Field & Foliage styled, each with a contextual
  inquiry CTA. Lawn / Gardens describe each division's services + its contact. FAQ uses a
  shadcn `accordion` (add via CLI). Keep copy centralized so owners can revise it easily.

- [ ] **9.5 — Public inquiry form + spam protection + Server Action**
  *Depends on: 9.2, 9.1*
  Zod schema in `lib/validators/lead.ts`; form component (react-hook-form) reachable at
  `/contact` and embedded as the home CTA. Fields: name, email, phone, address, service
  interest (lawn / garden — radio group), message. Spam protection: hidden **honeypot** field
  + lightweight **per-IP rate limit** (server-side; no external captcha unless abuse appears).
  Submit via a **Server Action** (online / management-side — Server Actions are correct here;
  the offline queue is crew-only) inserting a `leads` row (`kind='service_inquiry'`,
  `status='new'`). Show a warm success state. Fires the 9.7 notification.

- [ ] **9.6 — Careers (Jobs) page + application**
  *Depends on: 9.2, 9.1*
  `app/(public)/jobs/page.tsx`: hiring pitch + any openings. A simple application form (name,
  email, phone, position interest, message, optional **resume upload** → Supabase Storage)
  that inserts a `leads` row with `kind='job_application'` and the extras in `details`
  (position, resume path). Reuse the 9.5 spam protection + Server Action pattern.

- [ ] **9.7 — New-lead notification (in-app + SMS)**
  *Depends on: 9.5, 8.2*
  **In-app:** management subscribes to `leads` INSERT (Realtime) → toast + an unread badge on
  the new "Leads" sidebar item. **SMS:** route by `service_interest` to the owner whose
  `employees.side` matches (lawn → Matt, garden → Krystyna; `both` / `other` → both owners) via
  the `send-sms` Edge Function (8.2) — never call Twilio inline. Message is a minimal nudge
  ("New website inquiry from [name] — open the app"). No email.

- [ ] **9.8 — Management Leads inbox & pipeline**
  *Depends on: 9.1, 1.6*
  `app/management/leads/page.tsx`: list inquiries + job applications, filter by `kind` /
  `status`, advance status through the pipeline (new → contacted → qualified → won / lost) and
  assign to an owner — all via Server Actions. Add "Leads" to the management sidebar (1.6).
  Phone-responsive (cards on phone, table on desktop), per the management UI rules.

- [ ] **9.9 — Convert lead → account**
  *Depends on: 9.8, 2.3, 2.5*
  On a `service_inquiry` lead, a "Convert to Account" action creates an `accounts` row
  (`status='prospective'`, pre-filled name / contact / email / phone) **+ a `property`** from
  the lead's address, sets `leads.status='won'` and `leads.converted_account_id`, and links
  back. Reuse `AccountForm` (2.3) and `PropertyForm` (2.5) pre-filled from the lead rather
  than building new forms.

### ✅ Verifying Phase 9 — Public Site & Lead Intake

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass;
`supabase db reset` applies the new `leads` migration + seed cleanly.

**Functional (against seed data):**
- Signed out, `/`, `/lawn`, `/gardens`, `/about`, `/faq`, `/jobs`, `/contact` all load (public
  allowlist works); `/management/*` and `/crew/*` still redirect to `/login` (9.2).
- Home renders both service lines + the inquiry CTA; sub-pages render with the FAQ accordion (9.3 / 9.4).
- Submitting the inquiry form inserts a `leads` row (`kind='service_inquiry'`, `status='new'`)
  and shows the success state; the honeypot / rate-limit reject obvious bots (9.5).
- The careers form inserts `kind='job_application'` with the resume in Storage + `details` (9.6).
- A new lead pushes an in-app toast / badge to management and (with Twilio) SMS to the matching
  owner by `service_interest` (9.7).
- The Leads inbox lists / filters leads and advances status; "Convert to Account" creates a
  `prospective` account + property and marks the lead `won` (9.8 / 9.9).

**Security / RLS (9.1):**
- The anon / public role can INSERT into `leads` but cannot SELECT; `crew` / `accountant` have
  no `leads` access; `owner` / `lead` can read + update.

**Human-gated (needs Twilio — `live-untested` otherwise):**
- The new-lead SMS reaches the matching owner via the `send-sms` Edge Function (9.7).
