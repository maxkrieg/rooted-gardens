# REDESIGN.md — Rooted Gardens Field-First Redesign

This file tracks the phased redesign that merges the crew PWA and the field-critical
management routes into one app. It is a **sibling to `PHASES.md`**, not a replacement —
`PHASES.md` remains the historical record of the original build. See `CLAUDE.md` for stack,
schema, and conventions.

> **Status:** R1 and R2 built 2026-08-26 (branch `redesign/r1-app-merge`). R3–R5 planned.

---

## Why

The app was built on a split that no longer matches how this company works: `/crew/*` was the
mobile PWA, `/management/*` was "desktop management." But the owner (Matt, lawn side) runs
management **~99% from his phone, on the go** — creating accounts, moving properties between
routes, and dispatching crew from a truck. He bounces between Schedule, Accounts, and Routes
all day, and those three pages carry his entire operation.

The August 2026 offline conversion (`8918429` → `c5a7760` → `a857567` → `655ba8d` → `ec01d9d`
→ `fefd77a` → `2502e69`) fixed the **data** side of this — those routes are client-first,
cached, and queue their writes. The **interaction** side is still shaped for a laptop.

### The benchmark: the actual spreadsheet

The crew still run off `Copy of Route Sheet '26`, tab `3/2026` — one row per property, one
column per week, and Matt colors cells to mark "these get visited this week." Reading the real
sheet is what makes the gap concrete:

- **Route groups already encode crew and days.** The groups are literally named
  `Wilder - Mon/Tues` and `New Hampshire - Tues/Wed/thurs`. There is **no crew column and no
  equipment column anywhere on the tab** — dispatch lives in the group name.
- **Group header rows carry per-week dispatch notes**: *"matts gone all week … no Ryan till
  Thurs. & no Christian Monday or Tuesday"*, *"maybe Jack on vacation?"*, *"plz don't skip any
  borderline decisions this week"*. We have per-visit `crew_instruction` but nothing at the
  route-group × week level.
- **Row order is drive order.** `property_route_groups.sort_order` exists and is fetched
  (`lib/schedule/fetch.ts`) but is always written as `0` and never read.
- **The weekly gesture is coloring a block of cells** — not filling in a form. Everything Matt
  does weekly is *marking the default*, then noting exceptions.

The goal is one installable app that Matt and his crew both live in, where the week arrives
mostly pre-filled, exceptions are one tap, and the chrome gets out of the way. **Not a
spreadsheet clone** — if a spreadsheet were the right answer, he should keep the spreadsheet.

### Decisions locked before planning

| Decision | Choice |
|---|---|
| Merge shape | One shared field app at `/app/*`; `/crew/*` and the four field management routes become redirects |
| Weekly mass-scheduling | Auto-generate visits from `properties.frequency`, then review exceptions |
| Routes page | Kept as its own page, rebuilt mobile-first, **plus** route assignment from the account/property screen |
| Crew History + Profile | Deleted; sign-out and SMS opt-out move into the `More` sheet |
| Equipment assignment | **Out of scope** — crew + vehicle only, no schema change |
| Route group defaults | **Yes** — default crew, vehicle, and days on `route_groups` |
| Sheet gaps to close | Week-level route notes; stop order within a route |
| Frequency enum | **Unchanged** — the sheet's `triweekly` / `once a year` are not being added |
| Dashboard | **Not a destination** — folds into Schedule as a `Today` view |

---

## Navigation model

The organizing rule: **the bar holds what works offline; `More` holds what needs a
connection.** That is not arbitrary — it is exactly the field/desk split already described in
`CLAUDE.md`'s Data Architecture section. It makes the overflow a real category instead of a
junk drawer, and gives crew a rule they can learn: *if it's in the bar, it works in the truck.*

```
crew         Schedule                                    You
lead/owner   Schedule    Routes    Accounts             More ●
accountant   Billing     Reports                        More
```

`More` and `You` are the same component — an avatar-initial button with an aggregate badge dot
— opening a sheet:

```
┌─ More ──────────────────────────────┐
│  MK   Matt Krieg · Owner            │
├─────────────────────────────────────┤
│  Search accounts & stops       ⌘K   │
├─────────────────────────────────────┤
│  Leads                          3   │   ← desk routes:
│  Billing                            │     online-only,
│  Reports                            │     occasional
│  Fleet                              │
│  Team                               │
├─────────────────────────────────────┤
│  Text alerts                   On   │   ← rescued from the
│  Install app                        │     deleted Profile page
│  Changes that didn't save       2   │
│  Sign out                           │
└─────────────────────────────────────┘
```

Why this shape:

- **The current mobile management nav is a top-left hamburger** (`ManagementNav.tsx`) — the
  hardest target to reach one-handed, tapped dozens of times a day. A bottom bar is the
  cheapest ergonomic win in the whole redesign.
- **It absorbs the deleted Profile page.** Sign-out and the SMS opt-out toggle need a home;
  they don't need a *page*. Crew get a two-tab bar, which is honest — they have one job.
- **The aggregate badge already exists.** `ManagementNav.tsx` already collapses every nav badge
  into one alert dot for the closed hamburger; that logic moves to the `More` tab unchanged.
- **Desktop is the same IA, differently rendered.** The `lg:` sidebar keeps field items on top,
  desk items below a hairline, avatar in the footer — all from one `NAV_ITEMS` array.
  `ManagementNav.tsx` already reuses `NavLinks` between the sidebar and the mobile drawer, so
  this is a rendering change, not an information-architecture change.

---

## What already exists — do NOT rebuild

The merge is far more advanced than the route tree suggests. Verified before planning:

- **`components/VisitDetailContent.tsx`** (~500 lines) is *already shared* by
  `app/crew/stop/[visitId]/page.tsx` and `components/management/VisitDetailSheet.tsx`.
  `VisitDetailSheet.normalizeRow()` reshapes a management grid row into the crew hook's
  `StopDetail` so both containers share **one** `['stop-detail', visitId]` cache entry.
- **`components/management/ManagementShell.tsx`** (25 lines) already imports `OfflineBanner`
  and `InstallPrompt` from `components/crew/` and calls `flushMutationQueue()` on mount —
  functionally identical to `CrewShell`.
- **8 of 13 offline-queue `MutationType`s already fire from both surfaces.**
  `job_start` / `job_discard` are crew-only, `create_visit` / `property_notes`
  management-only, and **`job_stop` is dead** — no call site anywhere.
- **Four hooks under `hooks/crew/`** — `useReassignCrew`, `useUpdateVisitVehicle`,
  `useUpdateCrewInstruction`, `useRevertVisitToScheduled` — are already used by both surfaces.
- **PWA scope already covers everything.** Both manifests declare `scope: "/"`, the worker
  registers at `scope: '/'` with `Service-Worker-Allowed: /`, and `app/sw.ts` already carries
  `/management` NetworkFirst runtime rules.
- **`components/management/UnroutedPanel.tsx` is the only mobile bulk-select precedent** in the
  codebase (per-row `Checkbox` + Select all/Clear + `sticky bottom-4` bar + Undo toast).
  Generalize it rather than inventing a pattern — there is **zero** gesture infrastructure in
  the repo (no dnd-kit, no framer-motion, no touch handlers).

### The measured problem

On a 375px phone, `/management/schedule` spends **~300px** before the first stop row: 56px
fixed header + 16px padding + 44px `<h1>` + ~148–200px sticky filter/nav bar + ~36px
duplicated week-range link. Roughly 200px of that is fixed or sticky and never scrolls away.

**Target: ≤120px, of which ≤56px is sticky.**

---

## Phase R1 — One app, one shell

> Goal: `/app/*` exists and is the only place field work happens. **No visual or interaction
> redesign in this phase** — components move and get rewired, nothing gets restyled. That
> keeps the diff reviewable and means any regression is a wiring bug, never a design question.

- [x] **R1.1 — Role context, replacing prop-threading**
  There is no `useRole` hook and no role context today; role arrives either from
  `parseRoleCookie(cookies.get('rg-role'))` in an RSC shell (`app/management/schedule/page.tsx`,
  `accounts/[id]/page.tsx`) or from `hooks/crew/useCurrentEmployee.ts`. Add
  `components/app/RoleProvider.tsx`, seeded by the shell's cookie read and reconciled against
  `useCurrentEmployee`, exposing `useRole()` and a capability helper `useCan()` →
  `{ editAccounts, editRoutes, editSchedule, seeBilling, … }`. Consolidate the
  `canManage` / `canEdit` / `canReassign` / `canEditCompletion` checks currently scattered
  across `VisitDetailContent.tsx`, `ScheduleView.tsx`, `AccountDetailView.tsx`, and both
  schedule pages.
  **Capabilities are UI affordance only — RLS remains the real boundary.** The existing
  policies already contemplate crew writes: `visits_update` permits crew on their own visit,
  `visit_crew_insert` permits crew to insert both relations.

- [x] **R1.2 — `AppShell`, replacing `CrewShell` + `ManagementShell` + `ManagementNav`**
  *Depends on: R1.1*
  One shell at `components/app/AppShell.tsx` implementing the **Navigation model** above. It
  mounts `OfflineBanner`, `InstallPrompt`, `flushMutationQueue()` on mount,
  `useCrewRealtimeSync`, `SessionNotice`, the ⌘K palette, and the leads realtime toast — all
  of which exist today, split across the two shells.
  One `NAV_ITEMS` array, role-filtered exactly as `ManagementNav.tsx` already does, with a
  `placement: 'bar' | 'more'` field deciding where each item renders. Bottom bar on phone,
  `lg:` sidebar on desktop, both from that one array.
  Reuse the active-state rule already duplicated verbatim in `CrewShell.tsx` and
  `ManagementNav.tsx` — and fix that `/crew/stop/*` currently highlights no tab at all
  (`/app/stop/*` must light up Schedule).
  The `More` sheet absorbs `updateMyProfile` (`app/crew/profile/actions.ts`) for the SMS
  opt-out, plus the single surviving sign-out. There are two sign-out implementations today
  (`app/crew/profile/page.tsx` and `ManagementNav.tsx`); keep the management one, which also
  clears client state via `router.refresh()`.

- [x] **R1.3 — Move the five field routes into `app/app/`**
  *Depends on: R1.2*
  Pure file moves, imports rewired, **components unchanged**:
  `/app/schedule` ← `management/schedule` · `/app/stop/[visitId]` ← `crew/stop/[visitId]` ·
  `/app/accounts` + `/app/accounts/[id]` · `/app/routes` · `/app/dashboard`.
  `app/crew/schedule` is **deleted, not moved** — `/app/schedule` serves crew via R1.1
  capabilities. Delete `app/crew/history`, `app/crew/profile`, and the dead
  `components/management/RouteGroup.tsx` stub.
  `/app/dashboard` moves as a real route here and is linked from `More`; folding it into
  Schedule is a redesign and belongs in **R2.6**. Keeping R1 a pure move is what makes it
  reviewable.

- [x] **R1.4 — Re-gate `proxy.ts` for a merged namespace**
  *Depends on: R1.3*
  Path-prefix gating (`MANAGEMENT_ROLES` / `CREW_ROLES`) stops working when one route serves
  four roles. Replace with an explicit per-route allowlist for `/app/*`, keeping the existing
  sub-route gates for `/management/team` (owner) and `/management/leads` (owner/lead).
  Leave `authUnreachable` untouched — it is what keeps field users signed in on weak signal.
  Fix the branch that hardcodes `/management/dashboard` for an authenticated user hitting
  `/login`: it makes a crew member double-hop through a redirect they aren't allowed to see.
  Use `ROLE_HOME` with `crew → /app/schedule`.

- [x] **R1.5 — Redirects for every old URL**
  *Depends on: R1.4*
  Permanent redirects in `next.config.ts`: `/crew/schedule` → `/app/schedule`,
  `/crew/stop/:id` → `/app/stop/:id`, `/crew/history|profile` → `/app/schedule`, and
  `/management/{schedule,accounts,routes,dashboard}` → `/app/*` — **preserving query strings**.
  `?week=`, `?visit=`, and `?routeGroup=` appear in real deep links and in the cross-surface
  links currently in `ScheduleGrid.tsx`, `VisitDetailSheet.tsx`, and `app/crew/schedule/page.tsx`.
  Phones have these bookmarked and installed.

- [x] **R1.6 — Collapse the two manifests**
  *Depends on: R1.5*
  `public/manifest.json` becomes the only manifest: `name: "Rooted Gardens"`,
  `start_url: "/app/schedule"`, `id: "/app/schedule"`, keeping `scope: "/"` and
  `orientation: "portrait"`. Delete `public/manifest-management.json` and the
  `MANAGEMENT_DISMISSED_KEY` fork in `InstallPrompt.tsx`.
  **Already-installed phones keep their old `start_url` until reinstall** — R1.5's redirects
  are what make that survivable, so R1.5 must land first and must never be removed.
  Update `app/sw.ts`, whose `management-rsc` / `management-pages` NetworkFirst rules would
  otherwise match dead paths — point them at `/app`.

- [x] **R1.7 — Move `lib/crew/` → `lib/offline/`**
  *Depends on: R1.3*
  Already flagged as a misnomer in `CLAUDE.md`; with no crew surface left, the name is simply
  wrong. Move `mutation-queue.ts` and `idb.ts` alongside the existing
  `lib/offline/photo-blobs.ts`, and move the four dual-surface hooks out of `hooks/crew/`.
  Delete the dead `job_stop` `MutationType` and its flush case.
  **Do not change the IndexedDB database name or store names** — `rooted-crew` v3 holds
  unsynced field writes on real phones.

### R1 as built — deviations from the plan above

- **`app/app/`, not `app/(app)/`.** A parenthesized folder is a Next.js *route
  group* and is stripped from the URL, so `app/(app)/schedule` would have served
  `/schedule`. The plan was wrong; the directory is the literal `app/app/`.
- **A `(padded)` route group was added** at `app/app/(padded)/` holding schedule,
  accounts, routes, and dashboard. Those came from the management shell, which
  supplied `p-4 lg:p-6` from its layout; `/app/stop/[visitId]` came from the crew
  shell and owns its own chrome (a sticky header at `top-0` and a fixed action bar
  anchored to the 3.5rem bottom bar), which layout padding would break. Server
  action imports carry the group in their path, e.g.
  `@/app/app/(padded)/accounts/actions`.
- **The desk routes adopted AppShell too.** `app/management/layout.tsx` renders the
  same shell rather than keeping its own sidebar, so there is one nav in the app.
- **`ROLE_HOME` for owner/lead stays `/app/dashboard`.** Only the crew entry
  changed. Landing owners on the schedule is R2.6's job, once the dashboard folds
  into it — moving it here would have made R1 more than a move.
- **The install prompt stayed a banner**, and "Changes that didn't save" stayed on
  the `OfflineBanner` tap target, rather than becoming rows in `More` as sketched.
  Both already work and surface themselves; converting them is cosmetic and was
  out of scope for a behaviour-preserving phase.
- **R1.1 went further than the shell.** The `role` prop chain was fully removed:
  `VisitDetailContent`, `VisitDetailSheet`, `DeepLinkedVisitSheet`,
  `RecentVisitsList`, `InvoicedHistory`, `ScheduleView`, `ScheduleGrid`,
  `ScheduleListMobile`, and `AccountDetailView` now read `useCan()`, and the
  schedule and account-detail page shells no longer read the role cookie at all.
- **One pre-existing lint error is untouched** — `components/crew/VisitLogger.tsx:174`
  (`react-hooks/set-state-in-effect`). It fails on the pre-change baseline too.

### ✅ Verifying Phase R1 — One app, one shell

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass.

**Functional — must be run against `npm run build && npm start`.** Offline behavior cannot be
tested under `npm run dev`; Serwist's `defaultCache` degrades to a single `NetworkOnly` rule.

- Crew sign-in lands on `/app/schedule`, shows only own stops, a two-tab bar, no Accounts (R1.1–R1.3).
- Owner sign-in shows four tabs plus the full `More` sheet; accountant gets `Billing · Reports · More` (R1.2, R1.4).
- Sign out and the SMS opt-out toggle both work from `More` now that Profile is gone (R1.2).
- Every old `/crew/*` and `/management/{schedule,accounts,routes,dashboard}` URL redirects with its query string intact (R1.5).
- Install to home screen, go airplane mode, log a completion, return online — it syncs (R1.6, R1.7).
- `/app/stop/*` highlights the Schedule tab (it highlighted nothing before) (R1.2).

**Security / RLS (R1.1, R1.4):**
- Crew on `/app/schedule` cannot reach `/app/accounts` or `/app/routes` — verify both the nav
  affordance is absent **and** direct URL entry is refused.
- Confirm capability helpers are cosmetic: with a capability forced on in devtools, the write
  still fails at RLS.

---

## Phase R2 — Make the schedule a phone screen

> Goal: cut chrome from ~300px to ≤120px and make the week readable at a glance. This is where
> the "all-in-one view" feeling gets replicated — density and immediacy, not a grid.

- [x] **R2.1 — Collapse the two week-schedule hooks into one**
  *Depends on: R1.3*
  `hooks/crew/useWeekSchedule.ts` (key `['crew-week-schedule', week]`) and
  `hooks/useManagementSchedule.ts` (keys `['schedule-reference']` + `['schedule-visits', week]`)
  produce the same `ScheduleWeek` from the same `buildScheduleWeek`, differing only in
  ungrouped properties, the invoice embed, and archive filtering. Keep the **management** keys
  and shape — they already support a multi-week window via `useQueries` + `combine` — and
  delete the crew hook, passing `withInvoices` / `includeUngrouped` as options.
  Remove `['crew-week-schedule']` from `PERSISTED_QUERY_KEYS` (`components/providers.tsx`) in
  the same commit and let orphaned entries age out. **Do not rename `['schedule-visits']`** —
  that would orphan the cache the owner actually relies on offline.
  Verify `patchScheduleVisit`, `SessionsProvider`'s overlay, and the shared
  `['stop-detail', visitId]` entry all still hit.

- [x] **R2.2 — Compact sticky header**
  *Depends on: R2.1*
  Delete the `<h1>Schedule</h1>` (the nav tab already says Schedule) and the duplicated
  week-range `Link` at the top of `ScheduleListMobile.tsx`. Collapse to one 48px sticky row:

  ```
  ┌──────────────────────────────────────────────┐
  │  ‹   Jun 8 – 14   ›              ⚲ 2   ⋯     │   48px, sticky
  └──────────────────────────────────────────────┘
  ```

  The four `ScheduleFilterBar` dropdowns move into a filter **sheet** behind `⚲`, with an
  active-count badge; the week label itself opens the existing calendar popover. `⋯` holds
  Generate week / Assign route / Select.
  Keep `--schedule-sticky-h` (already published via `ResizeObserver` by `ScheduleStickyBar.tsx`)
  and start consuming it in the mobile list, which ignores it today.

- [x] **R2.3 — Route-group band, redesigned**
  *Depends on: R2.2*
  The group header is the highest-value real estate on the screen and currently holds a name
  and one ghost button. Make it carry the dispatch state Matt reads first:

  ```
  ┌──────────────────────────────────────────────┐
  │ WILDER · MON/TUE          ●●  Blue F-150  ⋯  │
  │ ▓▓▓▓▓▓▓▓▓░░░░░  5/8                          │
  │ ⚑ no Ryan till Thurs                         │  ← week note (R3.3)
  ├──────────────────────────────────────────────┤
  │ Tennis, Trash, Parking      biweekly    ✓    │
  │ Pool House & Steep Hills    weekly   ◷ 0:42  │
  └──────────────────────────────────────────────┘
  ```

  Crew initials and truck come from the group's defaults (R3.1), overridden per-visit. The
  progress bar is the at-a-glance signal the colored spreadsheet block used to give him.
  Keep the existing row renderer in `ScheduleListMobile.tsx` — it is already good.

- [x] **R2.4 — Select mode + bulk action bar**
  *Depends on: R2.3*
  Generalize `UnroutedPanel`'s proven pattern (`Set` state + Select all/Clear +
  `sticky bottom-4` bar + Undo toast) into `components/app/SelectionBar.tsx`. On the schedule,
  `⋯ → Select` turns rows into checkboxes; the bar applies **crew**, **truck**, **schedule**,
  or **skip** to the selection.
  **No long-press, no swipe** — the repo has zero gesture infrastructure, and adding a gesture
  library for this would be its first such dependency.
  Each bulk apply enqueues the existing per-visit mutations (`assign_crew`, `set_vehicle`,
  `create_visit`, `skip`) in a loop, so it works offline for free and needs **no new
  `MutationType`**.

- [x] **R2.5 — Desktop grid stays, demoted**
  *Depends on: R2.3*
  `ScheduleGrid.tsx` (the 4-week `<table>`, `hidden lg:block`) keeps working for the rare
  laptop session. Do not invest further in it. Fix only the touch-dead `Tooltip`s and the bare
  `<FilePen>` icon in `ScheduleListMobile.tsx` that signals a crew instruction exists while
  giving no way to read it.

- [x] **R2.6 — Fold the Dashboard into Schedule as a `Today` view**
  *Depends on: R2.2*
  Schedule gets a `Today | Week` segmented control under the compact header. `Today` reuses
  `DashboardView.tsx` and `CrewsOnSitePanel.tsx` as-is; `Week` is the route list. This removes
  a destination rather than adding a tab, and puts the snapshot on screen the moment he opens
  the app — zero navigation.
  Retire `/app/dashboard` (moved in R1.3) with a redirect to `/app/schedule?view=today`, and
  drop Dashboard from `More`. Persist the last-used view so his default is whichever he
  actually uses.
  **Offline behavior must stay honest.** `CrewsOnSitePanel` deliberately does *not* cache — it
  says it needs a connection rather than showing a frozen list with a ticking timer. Preserve
  that: `Week` works offline, `Today`'s live panel degrades to its existing message. Do not
  "fix" this by caching it.

### ✅ Verifying Phase R2 — Phone-first schedule

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass.

**Functional (375×812 viewport, `npm run build && npm start`):**
- Measure it: chrome above the first stop row is ≤120px, of which ≤56px is sticky (R2.2).
- Filter state survives a week change and a full reload; the `⚲` badge shows the active count (R2.2).
- Route-group band shows crew, truck, and a completed/total progress bar (R2.3).
- Select 6 stops across two route groups, assign a crew member **offline** — the queue holds 6
  mutations and all six sync on reconnect (R2.4).
- `Today` offline says it needs a connection while `Week` still renders cached stops (R2.6).
- `/app/dashboard` redirects to `/app/schedule?view=today` (R2.6).
- The `?visit=<id>` deep link still opens the sheet — `DeepLinkedVisitSheet` is mounted once
  precisely because both layouts are always mounted; that constraint survives (R2.1).

### R2 as built — deviations from the plan above

- **R2.1 was a deletion, not a merge.** R1 removed the crew schedule page, which was
  `useWeekSchedule`'s only consumer, so there was no second hook left to parametrize with
  `withInvoices` / `includeUngrouped` — the hook was simply deleted and its 12 orphaned
  `['crew-week-schedule']` invalidations rewired. Five of them already invalidated
  `['schedule-visits']` alongside and just lost a dead line; the other seven were substituted.
  `['crew-today-stops']` and `['crew-history-stops']` turned out to be dead too and went with them.
  The `fetch.ts` comment claiming crew RLS can't read `invoices` is **false** — the baseline
  grants SELECT to `authenticated` and RLS filters rows, so the embed returns empty rather than
  erroring. That false premise is what kept the second hook alive; the comment is corrected.

- **No dropdown-menu primitive exists in the repo.** Both `⋯` menus (the header's and the route
  group band's) use the installed Popover rather than adding `@radix-ui/react-dropdown-menu`
  for two menus.

- **R2.3's crew and truck come from the visits, not from group defaults.** Route group defaults
  are R3.1 and aren't built, so the band aggregates the crew and vehicles actually on the
  group's visits this week. When R3.1 lands, defaults become the fallback for a visit that has
  no assignment yet.

- **The route group band is sticky**, pinned under the header via `--schedule-sticky-h` — that's
  the "start consuming it in the mobile list" R2.2 called for. It required dropping
  `overflow-hidden` from the group card (a clipping ancestor kills `position: sticky`); the rows
  keep their own clipping wrapper for the bottom corners.

- **The `Today` view is gated on a new `seeDashboard` capability** (owner/lead/accountant).
  Crew never had a dashboard and it carries company-wide stats and uninvoiced counts, so they
  get neither the toggle nor the 44px of chrome it costs.

- **`/app/dashboard` redirects with `permanent: false`.** It's an internal retirement of a route
  that shipped days ago, not a public URL being retired forever — a 308 would be cached by
  browsers indefinitely. `/management/dashboard` keeps its 308 and now points straight at
  `/app/schedule?view=today` rather than chaining through the dead route.

- **`ROLE_HOME` for owner/lead moved to `/app/schedule`**, which R1 deliberately deferred to
  here. There is no dashboard to land on any more.

- **Measured result** (375px, owner): 16px page padding + 56px sticky header + 8px + 36px
  `Today | Week` + 8px = **124px** above the first route band, of which **56px is sticky**.
  Crew, with no view toggle, get **80px**. The ≤120px target was written before R2.6 added the
  toggle, and the toggle is the 44px over. Was ~300px.

---

## Phase R3 — The week arrives pre-filled

> Goal: replace "color a block of cells" with "review a generated week." This is the phase that
> actually removes work from Matt's Sunday night.

- [ ] **R3.1 — Migration: route group defaults**
  Add to `route_groups`: `default_vehicle_id uuid FK → vehicles` and `default_days text[]`
  (`'mon'…'sun'`). Add `route_group_default_crew (route_group_id, employee_id)` — a join table,
  **not** a `uuid[]` column, matching the `visit_crew` precedent and `CLAUDE.md`'s stated
  reasoning about arrays and RLS. RLS: SELECT for all staff, writes for owner/lead.
  This is what `Wilder - Mon/Tues` has been encoding in a *string* all along.
  Follow **"Making a schema change (dev → prod)" in `docs/DEPLOYMENT.md`** — prod must be
  migrated before schema-dependent code reaches `main`, because merging is deploying.

- [ ] **R3.2 — Migration: route group week notes**
  *Depends on: R3.1*
  `route_group_week_notes (id, route_group_id, week_start date, note text, created_at,
  updated_at)` with `UNIQUE (route_group_id, week_start)`. This is the spreadsheet's
  group-header dispatch note (*"matts gone all week … no Ryan till Thurs"*) — currently
  homeless, and read by the whole crew rather than attached to one visit.

- [ ] **R3.3 — Week note UI**
  *Depends on: R3.2, R2.3*
  Editable inline on the route-group band for owner/lead; a read-only ribbon for crew.
  New offline `MutationType: 'route_week_note'` — which means touching `MutationType`
  (`idb.ts`), the payload interface + `MutationPayload` union, a `case` in the flush switch,
  and `TYPE_LABELS` in `StuckChangesSheet`. The compiler enforces all four.

- [ ] **R3.4 — `planWeek()` — the generate rule**
  *Depends on: R1.3*
  A pure function in `lib/utils/schedule.ts` beside `buildScheduleWeek`, so it stays testable
  and reusable. Given a week, the route groups with their properties, and each property's most
  recent visit, it returns the properties due:
  - `weekly` → every week.
  - `biweekly` → **phase from the property's most recent visit**, not from a fixed calendar
    parity. The spreadsheet's own biweekly rows drift constantly (`5/12`, `5/18`, skip,
    `6/10`), so anchoring to parity would fight reality. Treat as due when there is no prior visit.
  - `monthly` → due when there's been no visit in the prior 4 weeks.
  - `as_needed` → **never** auto-generated; those get scheduled by hand.
  - Skips archived properties, and skips any property that already has a visit that week — the
    `UNIQUE (property_id, week_start)` index makes this idempotent regardless.

- [ ] **R3.5 — Generate week, with preview**
  *Depends on: R3.4, R3.1, R2.4*
  `⋯ → Generate week` opens a preview sheet grouped by route, showing exactly what will be
  created and what will be skipped, with per-row opt-out. Matt confirms a **number** before
  anything is written, so he can never accidentally mint 60 visits.
  Confirming enqueues one `create_visit` per property — already client-minted-UUID and
  upsert-safe with `onConflict: 'property_id,week_start'` (`hooks/useCreateVisit.ts`) — plus
  `assign_crew` and `set_vehicle` from the group defaults. **Re-runnable and offline-capable by
  construction**: no new mutation type, no online-only gate.
  Contrast `bulkAssignRoute` (`app/management/schedule/actions.ts`), which is a Server Action,
  online-only, and only touches visits that already exist. It stays as-is for the "reassign an
  existing week" case.

### ✅ Verifying Phase R3 — Generated weeks

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass; migrations apply
cleanly to a fresh project from the baseline.

**Functional:**
- Set defaults on a route group; generate an empty week — every visit lands with crew and truck
  pre-filled (R3.1, R3.5).
- Generate the same week twice: the second run reports zero created and nothing duplicates (R3.4, R3.5).
- Generate **offline**: every mutation queues and syncs on reconnect (R3.5).
- A biweekly property skipped last week comes up due; an `as_needed` property never appears (R3.4).
- A week note saves offline, appears on the crew's band for that week only, and is read-only for crew (R3.3).

**Security / RLS (R3.1, R3.2):**
- `route_group_default_crew` and `route_group_week_notes` are readable by all staff roles and
  writable only by owner/lead; crew writes are refused.

---

## Phase R4 — Routes without a round trip

> Goal: Matt organizes routes from wherever he already is. Today the account detail page can
> only *display* a property's route group and links out to `/management/routes` **carrying no
> property context** — the single worst workflow gap found.

- [ ] **R4.1 — Assign a route from the property card**
  *Depends on: R1.3*
  Replace the "Manage" / "Put on a route" link on the account detail property card with an
  inline `RoutePicker` (`components/management/RoutePicker.tsx` already exists and is a
  searchable combobox). Put the same control on the schedule's "Not on a route" band,
  replacing its link-out.

- [ ] **R4.2 — Convert routes writes to the offline queue**
  *Depends on: R4.1*
  `/management/routes` is 100% Server Actions today (`app/management/routes/actions.ts`, seven
  of them) — it is the one field route that **does not work offline for writes**, which is
  indefensible once it's a phone-first page used from a truck. Add
  `MutationType: 'assign_property_route'` for the common case: assign, move, or unassign one
  property. Group create/rename/reorder/delete stay Server Actions — rare and genuinely
  desk-shaped.
  Keep `assignProperties` online-only and say so in the UI: it is a delete-then-insert that
  clobbers concurrent edits, the same reason `bulkAssignRoute` is gated.
  **Watch the RSC-shell trap** (see Risks): each converted action needs `useRefreshRoutes()` on
  its success path, not `revalidatePath`.

- [ ] **R4.3 — Routes page, mobile-first**
  *Depends on: R4.2*
  There are currently three breakpoint usages in the entire page, and a five-target action row
  crammed next to a truncating title in `RouteGroupCard.tsx`. Rebuild: group cards with a
  single `⋯` overflow, the R3.1 defaults (crew / truck / days) shown as an editable summary
  line, and reordering via the existing `moveRouteGroup` chevrons — **no drag-and-drop**,
  consistent with R2.4.

- [ ] **R4.4 — Stop order within a route**
  *Depends on: R4.3*
  `property_route_groups.sort_order` already exists, is already fetched (`lib/schedule/fetch.ts`),
  and `buildScheduleWeek` **already sorts by it** — it is simply always written as `0`. Make
  the assign actions write a real value and add ↑/↓ reordering inside the route group card.
  Crew then see stops in drive order, which is what the spreadsheet's row order has always
  meant. The read side needs no change.

### ✅ Verifying Phase R4 — Routes

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass.

**Functional:**
- Assign a property to a route from the account page without navigating away; the schedule and
  the nav "unrouted" badge both update — `useRefreshRoutes` invalidates `routes-data`,
  `schedule-reference`, and `nav-unrouted-count` (R4.1, R4.2).
- Do that same assignment **offline**; it queues and syncs (R4.2).
- Reorder stops within a group; the new order shows on `/app/schedule` for a crew account (R4.4).
- Archiving a property still clears its `property_route_groups` row, so the unrouted badge
  doesn't under-count (regression check — see `CLAUDE.md` "Archiving").

---

## Phase R5 — Consolidation

> Goal: pay off the duplication the merge exposes. Nothing user-visible — do it while the
> reasoning is fresh, not "later."

- [ ] **R5.1 — One filter bar.** Delete `components/crew/CrewScheduleFilters.tsx`; keep
  `ScheduleFilterBar` + `lib/utils/schedule-filters.ts`, which already has URL serialization.
- [ ] **R5.2 — One stop row.** Delete `components/crew/ScheduleStopRow.tsx` in favor of the
  schedule list's renderer; both already import the same badges and `isVisitInProgress`.
- [ ] **R5.3 — One `SERVICE_TYPE_LABELS`.** The copy in the deleted crew History page goes;
  `types/app.ts` is the source of truth.
- [ ] **R5.4 — Consistent breakpoints.** Schedule splits at `lg` (1024px), Accounts at `md`
  (768px), Routes not at all. Pick one and document it here.
- [ ] **R5.5 — Fold the realtime overlay into React Query.** `SessionsProvider`'s
  `Map<visitId, VisitOverlay>` is a third store on top of React Query, kept because the grid
  used to read server props. It no longer does. Fold it into `setQueryData`, preserving the
  `updated_at` version guard in `mergeVisitOverlay`.
- [ ] **R5.6 — Update `CLAUDE.md`.** Repository Structure, the Data Architecture field/desk
  split (the field list becomes `/app/*`), the Realtime section, and the `lib/crew/` misnomer
  note all describe a layout that no longer exists after R1.

### ✅ Verifying Phase R5 — Consolidation

**Automated:** `npm run build` · `npm run typecheck` · `npm run lint` pass; no unused exports
remain for the deleted components.

**Functional:** the full R1–R4 verification passes unchanged — this phase must be behavior-preserving.

---

## Sequencing

**R1 gates everything** and should land as one reviewable, behavior-preserving change.
R2 / R3 / R4 are independent of each other afterward and can ship in any order.

- Fastest relief: **R2.2 alone** (compact header) is roughly a one-day win.
- Biggest weekly time saved: **R3**.
- Biggest single workflow fix: **R4.1**.

## Risks

1. **Installed phones.** An installed PWA keeps its old `start_url` until reinstall. R1.5's
   redirects are load-bearing and permanent, not a migration convenience.
2. **Persisted query cache.** Dropping `['crew-week-schedule']` from `PERSISTED_QUERY_KEYS`
   orphans IndexedDB entries on real phones. That's acceptable; renaming `['schedule-visits']`
   would not be.
3. **Unsynced writes during cutover.** Do not rename the `rooted-crew` IndexedDB database or
   its stores — a crew phone may be holding unflushed field writes across the deploy.
4. **The RSC-shell trap.** Documented in `CLAUDE.md` as having caused three separate bugs:
   any Server Action feeding a client-first page needs a `useRefresh*` hook, because
   `revalidatePath` refreshes a shell that holds no data. R4.2 walks straight into this.
5. **One route, four roles.** Once crew and owner share `/app/schedule`, a UI capability bug
   becomes a data-exposure bug. RLS must be *verified* as the boundary, not assumed.
6. **Prod schema ordering.** R3.1 and R3.2 are schema changes, and merging is deploying — prod
   must be migrated first, per `docs/DEPLOYMENT.md`.
