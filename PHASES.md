# PHASES.md — Rooted Gardens Build Plan

This file tracks the phased build of the Rooted Gardens internal business app.
See `CLAUDE.md` for full context, tech stack, schema, and conventions.

Each task is written to be handed directly to Claude Code as a prompt. Phases are ordered
as a sensible default build sequence, but the authoritative dependency graph is the
`Depends on:` line under each task — tasks with disjoint dependencies can be built in
parallel or reordered freely. **Phase 0** holds external / lead-time setup to start on day
one. A few cross-phase dependencies are intentional and flagged inline (e.g. the management
in-progress view 3.11 consumes the crew start/stop producer 4.10; build it against seed data
1.9 and validate once 4.10 lands).

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

- [~] **0.2 — Intuit developer app for QuickBooks** (blocks 5.2–5.4) <!-- blocked: needs human — Intuit Developer account + QBO_CLIENT_ID/SECRET, production review required -->
  *Depends on: — (start here)*
  Create an Intuit Developer account and app to obtain `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`
  and configure the OAuth redirect URI. Production keys require Intuit app review — develop
  against sandbox now, request production review before Phase 5 ships.

- [~] **0.3 — Provision cloud accounts** (blocks Phase 1) <!-- blocked: needs human — Supabase project URL/keys, Vercel project, Twilio Messaging Service -->
  *Depends on: — (start here)*
  Create the Supabase project (URL + anon + service-role keys), the Vercel project, and the
  Twilio Messaging Service. Populate `.env.local`. This is the one Phase 0 item that actually
  blocks starting Phase 1 (1.2 needs the Supabase project).

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

- [x] **1.3 — Supabase client utilities**
  *Depends on: 1.1*
  Create `lib/supabase/client.ts` (browser client singleton using `createBrowserClient`),
  `lib/supabase/server.ts` (server client using `createServerClient` with cookie
  handling for Server Components and Server Actions), and
  `lib/supabase/middleware.ts` (middleware client). Create a React Query provider
  wrapper in `components/providers.tsx` and add it to the root layout.
  (Comes before auth because the auth flow and middleware use these clients.)

- [x] **1.4 — Supabase Auth with magic link**
  *Depends on: 1.1, 1.3*
  Configure Supabase Auth for magic link (email only). Create the login page at
  `app/(auth)/login/page.tsx` with an email input form that calls
  `supabase.auth.signInWithOtp()`. Show a "check your email" confirmation state
  after submit. Create an auth callback handler at
  `app/auth/callback/route.ts`. Add middleware at `middleware.ts` that protects
  all `/management/*` and `/crew/*` routes and redirects unauthenticated users
  to `/login`. Use `@supabase/ssr` for cookie-based session handling.

- [x] **1.5 — Generate TypeScript types from schema**
  *Depends on: 1.2*
  Run `supabase gen types typescript --local > types/database.ts`. Create
  `types/app.ts` with higher-level app types built on top of DB types — e.g.
  `AccountWithProperty`, `VisitWithZone`, `VisitWithCrew` (visit joined to its
  `visit_crew` rows + employees), `EmployeeWithUser`. These joined types
  are what components actually consume.

- [x] **1.6 — Management layout shell (desktop)**
  *Depends on: 1.1, 1.4*
  Create `app/(management)/layout.tsx` with a fixed left sidebar and main content
  area. Sidebar contains: logo, nav links (Dashboard, Schedule, Accounts, Billing,
  Fleet, Team), and a bottom user/logout section. Use shadcn `Sheet` for a
  collapsible mobile sidebar fallback. Sidebar should show the active route.
  Desktop: sidebar always visible. Mobile: hamburger toggle. Apply green primary
  color (`#4a7c59`) as the brand accent throughout.

- [x] **1.7 — Crew layout shell (mobile PWA)**
  *Depends on: 1.1*
  Create `app/(crew)/layout.tsx` with a full-viewport mobile layout and a
  sticky bottom navigation bar with three tabs: Today (home icon), History
  (clock icon), Profile (user icon). Configure **Serwist** (`@serwist/next`) — wrap
  `next.config.ts` with `withSerwist` and add the service-worker entry (e.g.
  `app/sw.ts`) — with a manifest at `public/manifest.json` (app name "Rooted Crew", green
  theme color, standalone display mode). Add PWA meta tags to the root layout.
  The crew layout should have no sidebar — bottom nav only. Ensure the viewport
  meta tag prevents zoom on input focus.

- [x] **1.8 — Role-based routing middleware**
  *Depends on: 1.2, 1.4*
  Extend `middleware.ts` to fetch the user's employee role after auth check.
  Redirect `accountant` role users away from `/crew/*`. Redirect `crew` role
  users away from `/management/*` (except allow them to reach `/crew/*`).
  Owners and leads can access both. Store role in a cookie after first fetch
  to avoid a DB call on every request.

- [ ] **1.9 — Seed data for development**
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

---

## Phase 2 — Accounts & Properties

> Goal: Full CRUD for accounts, properties, and service zones. The CRM layer.
> This is the foundation everything else is built on.

- [ ] **2.1 — RLS policies for accounts and properties**
  *Depends on: 1.2*
  Write RLS policies for `accounts`, `properties`, `service_zones`, and
  `route_groups`. Rules: `owner` and `lead` roles can SELECT/INSERT/UPDATE.
  `crew` role can SELECT only (they need property notes on their stops).
  `accountant` role can SELECT all and UPDATE `accounts.qbo_customer_id`.
  Use a helper function `get_my_role()` that reads from `employees` table
  to keep policies DRY.

- [ ] **2.2 — Account list page**
  *Depends on: 1.6, 2.1, 1.9*
  Create `app/(management)/accounts/page.tsx`. Fetch all accounts server-side
  with property count and last visit date. Render a searchable, filterable table
  with columns: Name, Billing Type (badge), Status (badge), Price/Rate, Last Visit.
  Include a filter bar for status (`active` / `inactive` / `prospective`) and
  billing type. Add a "New Account" button that opens a slide-over sheet form.
  Use shadcn `Table`, `Badge`, `Sheet`.

- [ ] **2.3 — New account form (slide-over)**
  *Depends on: 2.2*
  Create `components/management/AccountForm.tsx`. Fields: name (required),
  contact name, email, phone, billing type (radio: Per Visit / Contract / As Needed),
  price per visit (shown only when Per Visit selected), contract rate + period
  (shown only when Contract selected), status, notes. Validate with Zod.
  Submit via Server Action that inserts into `accounts`. On success, close sheet
  and revalidate account list. Show inline field errors.

- [ ] **2.4 — Account detail page**
  *Depends on: 2.2*
  Create `app/(management)/accounts/[id]/page.tsx`. Show three sections:
  (1) Account info card with edit button, (2) Properties section listing all
  properties with their service zones, (3) Recent visits timeline (last 10 visits
  across all zones). Add "Add Property" button. Each property shows its address,
  zone list with frequency badges, and crew notes. Include a QBO customer ID
  field with a "Link to QuickBooks" status indicator.

- [ ] **2.5 — Property and service zone management**
  *Depends on: 2.4*
  Create `components/management/PropertyForm.tsx` for adding/editing a property:
  address, parking notes, access notes, crew notes. Below the property form,
  show the service zones list. Allow adding zones (name, frequency, sort order,
  notes) and reordering them via drag-and-drop (use `@dnd-kit/sortable`).
  For simple accounts, auto-create one zone named "Full Property" on property
  creation. Zone sort order determines crew visit sequence.

- [ ] **2.6 — Route group management**
  *Depends on: 2.4*
  Create a "Route Groups" section within `app/(management)/accounts/page.tsx`
  or as a sub-page. Display geographic clusters. Allow creating new route groups
  (name, sort order) and assigning properties to them via a multi-select. This
  is how the owner organizes the daily routes. Show a count of properties per group.

- [ ] **2.7 — Account search and quick-lookup**
  *Depends on: 2.2*
  Add a global search command palette (shadcn `CommandDialog`, triggered by
  `Cmd+K`). Search across account names, contact names, and addresses.
  Results navigate to the account detail page. This is critical for the owner to
  quickly pull up a client record.

- [ ] **2.8 — RLS policies for visits, sessions, time & media**
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

---

## Phase 3 — Schedule Grid

> Goal: The week-based schedule — the owner's primary management tool. This replaces the
> spreadsheet and is the most complex view in the app. The owner is **phone-primary**, so
> this ships as two responsive faces over one data layer: a dense multi-week grid on
> desktop (3.2) and a stacked single-week view on phone (3.10).

- [ ] **3.1 — Schedule data layer**
  *Depends on: 1.5, 2.6, 2.8*
  Create `lib/utils/schedule.ts` with helpers: `getWeekStart(date)` → Monday,
  `getWeeksInRange(start, end)` → array of week-start dates,
  `isZoneDueThisWeek(zone, weekStart)` → boolean based on frequency and last
  visit. Create a Server Action `getScheduleForWeek(weekStart)` that returns
  all route groups → properties → service zones → visits for a given week,
  in route group sort order.

- [ ] **3.2 — Schedule grid core component (desktop)**
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

- [ ] **3.3 — Visit cell interactions**
  *Depends on: 3.2*
  Each visit cell is clickable. Clicking an empty cell creates a scheduled visit
  for that zone + week (Server Action). Clicking an existing visit opens a
  `VisitDetailSheet` (shadcn `Sheet`). The sheet shows: current status, crew
  instruction field (editable), assigned crew (multi-select), vehicle assignment,
  completion details if done. Owners can edit any field; crew can only view.
  Add keyboard shortcut: press `S` on a cell to quick-schedule.

- [ ] **3.4 — Crew assignment on schedule**
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

- [ ] **3.5 — Week navigation and "active week" indicator**
  *Depends on: 3.2*
  Add previous/next week navigation arrows to the schedule grid header.
  Highlight the current week column. Add a "Jump to today" button. Persist
  the selected week in URL search params (`?week=2026-06-08`) so the URL
  is shareable. Add a mini calendar popover for jumping to any week.

- [ ] **3.6 — Multi-zone property display**
  *Depends on: 3.2*
  Service zones for the same property should visually group together in the
  grid with a subtle left border and indentation. Show the property address
  as a group header row, then each zone indented below it. For multi-zone
  (contract) accounts, show a "CONTRACT" badge on the property header row.
  Per-visit accounts show their price on hover.

- [ ] **3.7 — Crew instruction ("orange cell") workflow**
  *Depends on: 3.3 (crew-side banner also needs 4.3)*
  The `crew_instruction` field on a visit is a one-time note for crew for
  that specific visit. In the grid, cells with a crew instruction show an
  orange dot indicator. In the `VisitDetailSheet`, the crew instruction field
  is prominently placed at the top (above status). On the crew mobile stop
  view, if a crew instruction exists, show it in a highlighted orange banner
  at the very top of the stop detail, above everything else.

- [ ] **3.8 — Skip visit workflow**
  *Depends on: 3.3*
  In `VisitDetailSheet`, add a "Skip This Visit" button (destructive secondary
  style). Opens a dialog asking for a skip reason (optional freetext). Sets
  status to `skipped`, stores reason in `skip_reason`. Skipped cells show in
  yellow in the grid. Skipped visits are NOT invoiced. Add an "Undo skip"
  action that reverts to `scheduled`.

- [ ] **3.9 — Schedule dashboard page**
  *Depends on: 3.1*
  Create `app/(management)/dashboard/page.tsx`. Show:
  (1) "Today at a glance" — visits scheduled for today, crew assignments, any
  with orange instructions highlighted first.
  (2) "This week" summary — total scheduled, completed, skipped, uninvoiced.
  (3) Equipment status — any mowers/trucks flagged as maintenance.
  (4) Outstanding crew instructions that haven't been completed yet.
  This is the first thing the owner sees when they open the app.

- [ ] **3.10 — Mobile-adapted schedule view (phone)**
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

- [ ] **3.11 — In-progress visit visibility (management)**
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

---

## Phase 4 — Crew Mobile Experience

> Goal: The PWA that crew members use in the field. Must be fast, simple, and work well on a
> phone with one hand. This is what replaces texting. The offline foundation (4.1) comes
> first because the crew side is offline-tolerant by design — every later task in this phase
> builds on it.

- [ ] **4.1 — Offline foundation for crew PWA**
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

- [ ] **4.2 — Today's stops page (crew mobile)**
  *Depends on: 4.1, 1.2*
  Create `app/(crew)/today/page.tsx` as a **client** page using React Query over
  the Supabase browser client (this route must work from cache when offline — see
  CLAUDE.md "Data Architecture"). Show a vertical list of the current user's
  visits for today (join `visit_crew` on `employee_id = me AND relation = 'assigned'`),
  sorted by route group order (property stop sequence).
  Each stop card shows: property address (large, tappable to open Maps),
  account name, frequency badge, zone name(s) if multi-zone, and status chip.
  If a crew instruction exists, show an orange banner on the card. No tables,
  no dense data — cards only. Empty state: "No stops scheduled for today."

- [ ] **4.3 — Stop detail page (crew mobile)**
  *Depends on: 4.2*
  Create `app/(crew)/stop/[visitId]/page.tsx`. Full-screen mobile view with:
  (1) Orange banner at top if `crew_instruction` is set — large, prominent.
  (2) Address with one-tap "Open in Maps" button.
  (3) Property notes (access notes, crew notes, parking notes) — collapsible.
  (4) For multi-zone stops: list of zones with frequency badges so crew knows
  what's due this visit.
  (5) "Log Completion" button (large, green, bottom of screen).
  (6) "Skip This Stop" button (small, secondary, below main button).

- [ ] **4.4 — Visit completion logger (crew mobile)**
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

- [ ] **4.5 — Photo capture on mobile**
  *Depends on: 4.4*
  Add a "Add Photo" button in the completion logger bottom sheet. On mobile,
  this triggers the device camera via `<input type="file" accept="image/*" capture="environment">`.
  Upload to Supabase Storage at path `photos/{property_id}/{visit_id}/{timestamp}.jpg`
  (queued via 4.1 when offline). Show thumbnail preview after capture. Allow up to 4
  photos per visit. Store photo record in `photos` table with `type = 'visit'`. Show
  photo thumbnails on the stop detail page for completed visits.

- [ ] **4.6 — Skip stop workflow (crew mobile)**
  *Depends on: 4.3*
  Tapping "Skip This Stop" opens a simple bottom sheet with an optional
  text field for skip reason and a large "Confirm Skip" button. Sets visit
  status to `skipped`. Show skipped stops differently on the today list
  (grayed out, strikethrough) but keep them visible so crew has a record
  of what they passed on.

- [ ] **4.7 — Clock in / clock out (crew mobile)**
  *Depends on: 4.1, 1.2*
  Add clock in/out to the crew Profile tab (`app/(crew)/profile/page.tsx`).
  Show current clock state (in or out) with elapsed time if clocked in.
  Large toggle button. Clock in creates a `time_entries` record with `clock_in`.
  Clock out updates the same record with `clock_out`. Show today's hours summary.
  If a crew member tries to log a visit completion without being clocked in,
  show a reminder (not a blocker).

- [ ] **4.8 — Visit history (crew mobile)**
  *Depends on: 4.1, 1.2*
  Create `app/(crew)/history/page.tsx` (the History tab). Show the last 30
  completed visits for the current crew member (join `visit_crew` on
  `employee_id = me AND relation = 'completed'`), most recent first. Each row:
  date, property address, service types. Tapping a row shows the visit detail
  (read-only). This helps crew confirm what they did and when.

- [ ] **4.9 — Realtime schedule updates**
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

- [ ] **4.10 — Job start/stop tracking (crew mobile)**
  *Depends on: 4.1, 4.3*
  On the stop detail page (4.3), add a large **Start** button. Tapping it opens a
  `visit_sessions` row (`started_at = device now`, `ended_at = null`, `source = 'crew_app'`)
  and flips the button to a running **Stop** button showing elapsed time. Tapping Stop sets
  `ended_at = device now`. Both writes go through the **offline mutation queue** (built in 4.1;
  NOT a Server Action — see CLAUDE.md "Data Architecture"), captured with device timestamps so
  they stay correct if logged offline and synced later; the button reflects local state
  optimistically. Stopping does NOT change `visits.status` — after Stop, prompt
  (non-blocking) "Log completion now?" to chain into the 4.4 completion flow. Allow multiple
  crew to each run their own session on the same visit (concurrent sessions). Highlight an
  in-progress stop on the today list (4.2). RLS for sessions is defined in 2.8. If the crew
  member isn't clocked in (4.7), show the same non-blocking reminder. Realtime-enable the
  `visit_sessions` table so the management subscription in 3.11 receives start/stop events.

---

## Phase 5 — Billing & QuickBooks

> Goal: The accountant's workflow. Invoice queue for completed visits,
> one-click push to QuickBooks. Accountant works on laptop, desktop-first.

- [ ] **5.1 — Invoice queue page**
  *Depends on: 4.4, 2.4*
  Create `app/(management)/billing/page.tsx`. Show all visits with
  `status = 'completed'` (not yet invoiced), grouped by account.
  For `per_visit` accounts: each visit is one invoice line with the account's
  `price_per_visit`. For `contract` accounts: show completed visits as a
  summary (not individual lines) with the periodic contract rate.
  Include a date range filter (default: current month). Accountant can
  check/uncheck individual visits before pushing. Show running total.

- [ ] **5.2 — QuickBooks OAuth setup**
  *Depends on: 1.2, 0.2*
  Create `app/api/quickbooks/connect/route.ts` that initiates the OAuth 2.0
  flow using `intuit-oauth`. Create `app/api/quickbooks/callback/route.ts`
  that handles the callback, stores access_token and refresh_token in the
  `integrations` table. Create `lib/quickbooks/client.ts` that returns an
  authenticated QBO client, automatically refreshing the token if expired.
  Add a "Connect QuickBooks" button on the billing page that shows connection
  status (connected / disconnected / token expired).

- [ ] **5.3 — QuickBooks customer sync**
  *Depends on: 5.2*
  Create `lib/quickbooks/sync.ts` with a `syncCustomer(accountId)` function.
  If `accounts.qbo_customer_id` is null, create a new QBO customer using
  `account.name` and contact details, then store the returned QBO ID.
  If it exists, fetch and verify the customer still exists in QBO.
  Show QBO link status on the account detail page with a "Link / Refresh" button.

- [ ] **5.4 — Push invoices to QuickBooks**
  *Depends on: 5.1, 5.3*
  Add a "Push to QuickBooks" button on the billing invoice queue. For selected
  visits: (1) ensure account has a QBO customer ID (auto-create if not),
  (2) create a QBO Invoice with one line item per visit for `per_visit` accounts
  or one line per contract period for `contract` accounts, (3) update visit
  `status` to `invoiced`, set `invoiced_at` and `qbo_invoice_id`.
  Show a progress indicator during push. Show success/failure per account.
  Wrap in a transaction: if QBO push fails, do not update visit status.

- [ ] **5.5 — Invoiced visits view**
  *Depends on: 5.4*
  Add an "Invoiced" tab to the billing page showing visits with
  `status = 'invoiced'`, grouped by month. Show QBO invoice ID as a link
  (link to `https://app.qbo.intuit.com/app/invoice?txnId={id}`).
  Show total invoiced per month. Allow filtering by account.
  This is the accountant's audit trail — equivalent to the red text in the
  old spreadsheet.

- [ ] **5.6 — Invoice amount snapshot**
  *Depends on: 5.4*
  When a visit is marked invoiced, snapshot the price into `visits.invoice_amount`.
  This preserves the amount even if the account's price changes later.
  Display the invoiced amount (not current price) in the invoiced history view.
  Add a simple revenue summary to the billing page: MTD invoiced, YTD invoiced,
  broken down by billing type (per-visit vs contract).

---

## Phase 6 — Fleet & Equipment

> Goal: Track trucks and mowers. The owner assigns them to routes. Flag maintenance.
> Largely self-contained — only needs Phase 1; can run in parallel with Phases 3–5.

- [ ] **6.1 — Fleet management page**
  *Depends on: 1.6, 1.2*
  Create `app/(management)/fleet/page.tsx` with two sections: Vehicles and
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

---

## Phase 7 — Team & Timesheets

> Goal: Employee profiles and basic hour tracking for payroll.

- [ ] **7.1 — Team management page**
  *Depends on: 1.6, 1.4*
  Create `app/(management)/team/page.tsx`. Show all employees as cards:
  name, role badge, side (lawn/garden), phone, active status. Owners can
  add employees (create employee record + invite to Supabase Auth via
  `supabase.auth.admin.inviteUserByEmail()`). Include an "Invite to App"
  button that sends the magic link. Show "Has app access" vs "No app access"
  indicator based on whether `employees.user_id` is set. Capture SMS consent
  here (used by 8.2) — a per-employee opt-in toggle backed by `sms_opt_out`.

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
  (or browser DevTools device emulation). Check: tap target sizes (min 44px), no horizontal
  scroll, inputs don't zoom on focus (font-size ≥ 16px on inputs), bottom sheet doesn't get
  covered by keyboard, "Add to Home Screen" prompt works, back navigation works
  naturally. Fix any rough edges found.
