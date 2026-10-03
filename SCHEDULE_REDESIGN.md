# SCHEDULE_REDESIGN.md — From spreadsheet to dispatch board

A follow-on to `REDESIGN.md` (R1–R5, built). That redesign made the app work on a phone. This
one changes **what the schedule is organized around**. See `CLAUDE.md` for stack, schema and
conventions. It is the source of truth wherever this file is silent.

> **Status:** planned 2026-10-03. S0 done 2026-10-03 (prototype built; no walkthrough with Matt).
>
> - [x] **S0** — Clickable prototype for Matt
> - [ ] **S1** — Week overview + route drill-in
> - [ ] **S2** — "Needs you" and "From the field"
> - [ ] **S3** — Today, rebuilt around routes
> - [ ] **S4** — Property history in the stop sheet
> - [ ] **S5** — Desktop three-pane, retire the grid
>
> **One Claude Code session per phase.** Prompt: *"Implement phase S<n> of SCHEDULE_REDESIGN.md.
> Fill in its As-built section and tick its box when done."* Each phase lists what to read
> first, so a fresh session doesn't need this whole file in its head. Start with that phase's
> section, then read **Shared rules** below.

---

## Why

The schedule was built to replace the route sheet, and to give Matt "as much as he can see at
once." Both layouts ended up shaped like the **data** (property × week) rather than like his
**jobs**. The desktop grid shows four week columns, the phone shows one, but in both every
property gets a row and every row looks equally important. R1–R5 made that model good on a
phone. This redesign replaces the model itself.

### One screen, four jobs

| Matt's job | When | What he needs | What the schedule gives him today |
|---|---|---|---|
| **Plan** the week | Sunday / Monday morning | What's due, which route runs which day, who's out, which truck | Every property at once. Generate is the 2nd item in a `⋯` menu |
| **Run** today | All day, in the truck | Which crews are out, where, what's late, what broke | `Today` = the old dashboard (stat cards + on-site panel). `Week` = 100+ rows |
| **Coordinate** | All day | Tell a crew something; see what they reported | Notes live in 4 places (`crew_instruction`, week note, `crew_notes`, `completion_note`), and nothing collects what came back |
| **Answer** a client | When the phone rings | "When were you last at the Hendersons'?" | Scroll the grid sideways, or search → account → history |

### Findings (ranked)

| # | Finding | Severity | Principle | Fixed in |
|---|---|---|---|---|
| F1 | **Every row gets equal weight.** On a normal Tuesday ~90% of rows need nothing from Matt, and he has to scan all of them to find the rest. Finished rows fade, but they still take up the same space | 🔴 | Management by exception; signal-to-noise | S1, S2 |
| F2 | **What crews send back has no home.** Completion notes, skip reasons and photos only show once you open each stop. "Reviewing" means opening dozens of sheets | 🔴 | Visibility of system status; recognition over recall | S2 |
| F3 | **The desktop grid answers a question that's already automated.** The 4-week matrix was how you spotted cadence. `planWeek()` and `CadenceBadge` do that now. What's left is columns of finished history and empty future weeks | 🔴 | Form follows function | S4, S5 |
| F4 | **The screen's unit is the property, but Matt's unit is the route-day.** The sheet's group names (`Wilder - Mon/Tues`), `default_days` and week notes all say crews run routes on days. The screen makes the route a header and the property the subject | 🟡 | Match the user's mental model | S1, S3 |
| F5 | **Planning and running share one surface,** so neither gets its best layout | 🟡 | One primary task per screen | S1, S3 |
| F6 | **Generate is hidden.** The action that starts every week is buried in an overflow menu | 🟡 | Make the primary action visible | S1 |
| F7 | **Too many controls.** `Today/Week` + a sort switch + a sort switch on *every* route band + filters + `⋯` | 🟢 | Hick's law; progressive disclosure | S1 |
| F8 | **Select is a mode,** and the most common bulk change ("this route's crew this week") is already route-shaped | 🟢 | Avoid modes | S1 |

### Keep — these work
- **The stop row** in `ScheduleListMobile.renderStopRow`: status glyph + tint, finished work
  receding, crew instruction inline, `CadenceBadge` days-waiting. S1 reuses it as-is.
- **The route band pieces:** the progress bar as the divider, `RouteCrewTruck`, the week note
  ribbon.
- **Generate with preview**, confirming a number before anything is written.
- **Offline queue + Undo** on bulk actions. The ≤56px sticky chrome rule from R2.2.

---

## The new model

### Principles
1. **Overview first, zoom and filter, then details on demand** (Shneiderman): routes → stops → stop.
2. **Management by exception.** The first thing on screen is whatever needs a decision.
   Everything else is one tap away, and quiet.
3. **The route-day is the unit.** The screen lists routes; a property lives inside one.
4. **Split by job, not by screen size.** *Today* (run), *Week* (plan), *Stop* (detail + history).
   Phone and desktop share one structure; desktop shows more of it at once.
5. **Thumb zone first.** Primary actions sit in the bottom half. Still **no gestures** (ruled
   out in REDESIGN.md, since the repo has no gesture infrastructure).

### Structure — same URL, same data, same offline queue

```
/app/schedule
  Today   run the day          default once the current week has visits
  Week    plan the week        default when the week is empty
    └ Route  ?route=<id>       one route's stops in drive order
        └ Stop  ?visit=<id>    VisitDetailSheet, plus property history (S4)
```

**Crew are unchanged.** They have no `Today` (no `seeDashboard`), and their week is a handful of
their own stops. The flat list is already the right shape for them. The overview and drill-in
are for `seeDashboard` roles (owner, lead, accountant). The accountant gets them read-only, as now.

### Phone — Week (plan)
```
┌──────────────────────────────────────┐
│ ‹ Jun 8 – 14 ›   Today | Week   ⚲    │  sticky, ≤56px
├──────────────────────────────────────┤
│ [ Generate week · 64 due ]           │  primary CTA while due rows remain
│ Due, not scheduled · 5            ›  │
├──────────────────────────────────────┤
│ Wilder · Mon/Tue    RC JK  F-150   › │  one row per route: days, crew,
│   8 stops · ⚑ no Ryan till Thurs     │  truck, count, note, and
│ New Hampshire · Tue–Thu  3 crew    › │  progress once the week starts
│   11 stops · 2 without crew          │
│ Not on a route · 3                 › │
└──────────────────────────────────────┘
```

### Phone — Route (drill-in)
```
┌──────────────────────────────────────┐
│ ‹ Week    Wilder · Mon/Tue      5/8  │  sticky; back returns to the overview
│ ⚑ no Ryan till Thurs                 │
├──────────────────────────────────────┤
│ ✓ Tennis, Trash, Parking             │  existing stop rows, drive order
│ ◷ Pool House & Steep Hills    0:42   │
│ ○ Kerr Rd                            │
│   ✎ "back gate code changed"         │
├──────────────────────────────────────┤
│ [ Crew ] [ Truck ] [ Note ] [ ⋯ ]    │  route actions, in thumb reach
└──────────────────────────────────────┘
```

### Phone — Today (run)
```
┌──────────────────────────────────────┐
│ Tue Jun 11            Today | Week   │
├──────────────────────────────────────┤
│ Needs you · 3                        │  only when > 0
│  ⚠ Pool House: skipped, "gate lock"  │
│  ✎ Hendersons: crew note, 2 photos   │
│  ○ 4 stops on Wilder have no crew    │
├──────────────────────────────────────┤
│ Running today                        │
│ ┌──────────────────────────────────┐ │  routes whose default_days
│ │ Wilder        RC JK  Blue F-150  │ │  include today
│ │ ▓▓▓▓▓▓░░░░ 5/8    ● On site 0:42 │ │
│ │ Now Tennis Courts · Next Kerr Rd │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ From the field                       │  newest first
│  2:14  Christian finished Pool House │
│        "Back gate stuck" · 2 photos  │
│  1:50  Jack skipped Kerr: "flooded"  │
└──────────────────────────────────────┘
```

### Desktop (≥ lg) — three panes, no matrix
```
┌─────────────┬──────────────────────────┬────────────────────────┐
│ Today|Week  │ Wilder · Mon/Tue    5/8  │ Pool House & Steep     │
│ Needs you 3 │ ⚑ no Ryan till Thurs     │ Hills · on site 0:42   │
│ ─────────── │ ──────────────────────── │ crew · truck · note    │
│ Wilder    › │ ✓ Tennis, Trash, Parking │ photos · start/stop    │
│ NH        › │ ◷ Pool House      0:42   │ ────────────────────── │
│ Hanover   › │ ○ Kerr Rd                │ History                │
│ Not routed  │                          │ Jun 3   ✓ RC  "edges"  │
└─────────────┴──────────────────────────┴────────────────────────┘
```
List → route → stop, like a mail client. It's the phone's navigation shown all at once, so
each layout teaches the other.

### Ruled out
- **Keeping a 4-week matrix on desktop.** S5 retires it (F3). If Matt misses pattern-spotting
  after living with the new model, the follow-up is a **read-only** season heatmap
  (properties × ~12 weeks as dots), not the editable grid again.
- **A `planned_day` on visits.** The day already lives on the route (`default_days`), and
  that's enough to answer "what runs today." No schema change in any phase.
- **Gestures (swipe, long-press, drag).** Same as REDESIGN.md.

---

## Shared rules — every phase

These come from `CLAUDE.md` and have each caused real bugs. Read that file's **Data
Architecture → Rules that bite** before starting any phase.

- **Field route = client-first.** Reads go through React Query over the browser client. Writes
  go through the existing queued hooks (`useQueuedVisitMutation`, `useBulkScheduleActions`,
  `useGenerateWeek`, `useWeekNotes`'s save). **No new `MutationType` and no schema change are
  needed anywhere in this plan.** If a phase seems to need one, stop and record why in its
  As-built section.
- **View state lives in the URL without a router navigation.** `ScheduleView` mirrors state with
  `window.history.replaceState`, because a router round-trip breaks offline. New state
  (`?route=`) follows the same rule. Use `pushState` + a `popstate` listener where Back must work.
  Never `router.refresh()`.
- **`DeepLinkedVisitSheet` is mounted exactly once,** outside both layouts. `?visit=` must open
  from every view.
- **Breakpoints:** `lg` (1024px) only, coupled to `useMediaQuery('(min-width: 1024px)')` in
  `ScheduleView`. Don't add a third tier.
- **Onboarding:** `lib/onboarding/registry.ts` → `tour.schedule` (currently `version: 1`) points
  at `data-tour` anchors: `schedule.viewToggle`, `schedule.weekNav`, `schedule.routeBand`,
  `schedule.stop`, `schedule.actions`, `schedule.actionsMenu`, `schedule.select`,
  `schedule.filters`. Keep every anchor that still means something, move the rest, and **bump
  the version in the phase that changes the flow**. `npm run check:tours` must pass. Add a
  `NEWS` item (with `parentTour: 'tour.schedule'`) when users should notice the change.
- **Errors:** `toUserMessage` / `reportError`, never a bare `console.error`.
- **Comments:** 2–3 lines max per block.
- **Checks per phase:** `npm run build` · `npm run typecheck` · `npm run lint` ·
  `npm run check:tours`.
- **Functional checks** run under `npm run build && npm start` (offline can't be tested under
  `dev`), at 375×812. **Use `/admin/impersonate`** to switch between an owner, a crew member and
  the accountant without separate logins. See "Super-admin impersonation" in `docs/DEPLOYMENT.md`.

---

## S0 — Clickable prototype for Matt

**Goal.** Test the riskiest assumption before writing product code: that Matt will trade "see
every row" for "see what needs me." Half a day of work, and it can save weeks.

**Read first:** this file's "The new model". `components/management/ScheduleListMobile.tsx` and
`RouteGroupBand.tsx` for the visual language. `app/globals.css` for tokens (the Field & Foliage
system in `CLAUDE.md` → UI Conventions).

**Build.**
- One self-contained HTML page, published as a private Artifact: a phone frame with Today,
  Week, a Route drill-in, and a Stop sheet, clickable between them. Static data, no backend.
- Use the real visual system (Fraunces / Hanken Grotesk, the paper / sage / clay tokens) so
  Matt is judging the structure, not an unfamiliar look.
- Realistic content: route names in the sheet's style (`Wilder`, `New Hampshire`, `Hanover`),
  8–12 stops per route, a few skips with reasons, crew notes, an on-site timer, a week note.
  **Not real client data** — make up names and addresses.
- Add a desktop three-pane frame as a second tab of the page.

**Don't.** Touch the app's code. Spend time on polish beyond what a reaction needs.

**Verify.** You (Max) walk Matt through it. Write down what he reaches for that isn't there.

**Output.** Record his reactions in **As built**, and adjust S1–S5 *before* starting S1 if he
pushes back on the model.

### S0 as built — deviations
**Prototype:** https://claude.ai/artifact/QVR9yzSanXFdXRQEj8LfLz (private; share it from the
page's Share menu if Matt opens it himself). One HTML file, no app code touched. Fixture is
Tue Jun 9 2026, 2:30 pm: 5 routes (Wilder, New Hampshire, Hanover, Sharon, Hawk Pine Rd),
48 stops, 3 unrouted, 3 due-but-unscheduled. All names and addresses are invented.

What it covers, beyond the brief:
- **Today** shows Needs you → Running today → From the field (S2 + S3 together), so Matt sees
  the end state. Needs you derives the S2 kinds from the fixture: skipped, crew report,
  long on site (>4h, Ledyard Commons), no crew grouped per route, due-not-scheduled.
  Opening a skip or report marks it seen, so it leaves Needs you but stays in the feed.
- **Week** has ‹ › across three weeks: last week (all settled), this week (mid-week), next
  week (empty until you press `Generate week · N due`, which opens a preview first).
- **Route** drill-in with the sticky band, week-note ribbon and the bottom Crew / Truck / Note /
  ⋯ bar. Crew, Truck and Note really change the in-memory data, so "N without crew" on the
  overview and Needs you update. `⋯` items are stubs.
- **Stop** sheet has Start / Stop & log / Skip (with reasons) so the feed and Needs you can be
  seen reacting live, plus an "Earlier visits here" list (S4).
- **Desktop** tab: three panes beside the sidebar, ↑/↓/Enter/Esc work in the middle pane. A
  fake address bar shows `?route=` / `?visit=` changing, to make the shared-URL idea visible.
- A walkthrough column (things to try, questions to ask, notes saved in the browser).

Not in it: crew's flat list, the accountant's read-only view, search, offline, and the other
nav destinations (they toast "not in the prototype").

**Matt's reactions:** none collected. Max decided (2026-10-03) to skip the walkthrough, so the
riskiest assumption ("see what needs me" over "see every row") goes into S1 untested. S1–S5
stand as written.

---

## S1 — Week overview + route drill-in

**Goal.** Replace "every property, all at once" with a route-level overview you drill into.
Make Generate the visible primary action. Fixes F1, F4, F5 (plan side), F6, F7, F8.

**Read first:**
- `components/management/ScheduleView.tsx` — view mode, URL sync, `ScheduleStickyBar`,
  `useWeekPlan` wiring, and the `isWide` split.
- `components/management/ScheduleListMobile.tsx` — the row renderer to keep.
- `components/management/RouteGroupBand.tsx` — `RouteCrewTruck`, `RouteProgressBar`,
  `OnSiteDot`, `formatDays`, `RouteGroupMenu`.
- `components/management/ScheduleHeaderMobile.tsx`, `ScheduleBulkControls.tsx`.
- `hooks/useScheduleInteractions.ts`, `hooks/useGenerateWeek.ts` (`useWeekPlan` → `decisions:
  PlanDecision[]`, each with `due` and `reason`), `hooks/useWeekNotes.ts`.
- `lib/utils/schedule.ts` (`routeGroupStats`, `planWeek`, `PlanDecision`),
  `lib/utils/schedule-filters.ts` (`scheduleFilterParams`), `lib/utils/schedule-sort.ts`.
- `CLAUDE.md` → "The field app", "Data Architecture", "Onboarding".

**Depends on:** S0 (or a decision to skip it).

**Build.**
1. **`components/management/ScheduleWeekOverview.tsx`** (new). One tappable row per route
   group in the filtered week: name, `formatDays(default_days)`, `RouteCrewTruck`, stop count,
   week note (one line, clamped), `OnSiteDot`, and `RouteProgressBar` once any stop is settled.
   Add a **"N without crew"** line when scheduled visits have no crew. Last row: "Not on a
   route · N" (clay, as now). Row height ≥ 56px. Reuse `routeGroupStats`. Don't recompute it.
2. **Generate CTA.** At the top of the overview, a full-width primary button
   `Generate week · {n} due` when `useWeekPlan(...).decisions.filter(d => d.due).length > 0`,
   opening the existing `GenerateWeekSheet`. When the week is fully generated, collapse it to
   nothing. Keep `Generate week…` in the header `⋯` as well (the tour points at it).
3. **Route drill-in.** `ScheduleListMobile` takes an optional `routeGroupId` (or the sentinel
   `UNGROUPED_SORT_KEY` for "Not on a route") and renders that group alone. Its band becomes a
   sticky route header with a `‹ Week` back control.
4. **Route action bar.** On the route view, for `editSchedule`: a bottom bar (above the app's
   nav, the same anchoring as `/app/stop`'s action bar) with **Crew**, **Truck**, **Note** and
   `⋯` (Assign route…, Route defaults…, Select stops). Crew/Truck for the whole route reuse
   `RouteAssignDialog` (online-only `bulkAssignRoute`, which already says so offline). Note
   opens the `WeekNoteRibbon` editor.
5. **State.** `ScheduleView` gains `route: string | null`. Write it into the URL alongside the
   filters (extend `scheduleFilterParams` or append after it). Entering a route `pushState`s;
   back and the browser/OS back gesture `popstate` to the overview. A `?route=` on load opens
   that route directly. A route id that no longer exists falls back to the overview.
6. **Controls diet.** Remove the per-band `ScheduleSortToggle`. Move the schedule-wide sort
   switch into the route view header, where it applies. `sortState.byGroup` can stay in
   storage, unread; don't migrate it. Select mode is only offered on the route view.
7. **Desktop is untouched in S1.** The `lg` grid keeps rendering. S5 replaces it.
8. **Onboarding.** The `schedule.routeBand` anchor moves to the overview row, and
   `schedule.stop` lives in the route view. Rewrite the tour steps that walk the band and a stop
   so they first open a route ("do it" step, `advanceOn` a new `schedule.routeOpened` event
   emitted from the overview). Bump `tour.schedule` to `version: 2`.

**Don't.**
- Change the stop row's design. It's the "Keep" list.
- Give crew the overview. Gate it on `seeDashboard`. Crew keep the flat list.
- Turn Generate into a one-tap write. The preview + confirmed number stays.

**Verify.**
- Owner at 375px: the overview shows every route with correct counts. Tap a route → its
  stops in drive order → open a stop → close → back → overview, with scroll position kept.
- `?route=<id>` reload opens the route. `?route=<id>&visit=<id>` opens both. The OS back
  gesture leaves the route view rather than the app.
- **Offline (airplane mode):** overview → route → stop → back all work from cache. Change a
  stop's crew offline; the overview's "without crew" count updates immediately.
- On an empty week the CTA shows the same number the Generate preview confirms. After
  generating, the CTA disappears.
- Impersonating a crew member: no overview, the same flat list as before. As the accountant:
  overview + drill-in, no action bar.
- Chrome above the first overview row ≤ 124px (R2's measured number), ≤ 56px sticky.

### S1 as built — deviations
_(empty)_

---

## S2 — "Needs you" and "From the field"

**Goal.** Give exceptions and crew reports a home, so reviewing doesn't mean opening every
stop. Fixes F1 and F2.

**Read first:**
- `lib/utils/schedule.ts` (`buildScheduleWeek`, `planWeek`, `routeGroupStats`) and
  `lib/utils/visits.ts` (`isVisitInProgress`, `displayCrewFor`, `formatElapsed`).
- `types/app.ts` → `VisitWithCrew` (`completion_note`, `skip_reason`, `ended_at`,
  `photo_count`, `crew_instruction`).
- `components/management/ScheduleRealtime.tsx` and `applyVisitUpdate` in
  `hooks/useManagementSchedule.ts` — live updates already land in the cached week.
- S1's As-built notes.

**Depends on:** S1.

**Build.**
1. **Pure derivations** in `lib/utils/schedule.ts`, next to `routeGroupStats`, with no React:
   - `scheduleExceptions(week, decisions, now)` → a typed list, each item carrying its kind,
     visit/property id, route, and a one-line description:
     `skipped` (with `skip_reason`) · `crewReport` (completed with a `completion_note` or
     `photo_count > 0`) · `noCrew` (scheduled, no assigned crew; **group these per route**:
     "4 stops on Wilder have no crew") · `longOnSite` (in progress > 4h, a named constant) ·
     `dueUnscheduled` (from `decisions`, one aggregate item).
   - `fieldActivity(week)` → completed and skipped visits sorted by `ended_at` desc (fall back
     to `updated_at` for skips).
   Both derive from the **cached week**, with no new query, so they work offline and stay live
   through the existing realtime path.
2. **`components/management/NeedsYouList.tsx`** and **`FieldActivityList.tsx`** (new). Rows
   are ≥ 44px and open the existing `VisitDetailSheet` (via `useScheduleInteractions.openSheet`).
   Aggregate rows (`noCrew`, `dueUnscheduled`) open the route view / the Generate sheet.
3. **"Seen" state, per viewer.** Opening a `crewReport` or `skipped` item marks it seen.
   Store `{visitId: updated_at}` in localStorage under `rg-schedule-seen`, wrapped in try/catch.
   A later `updated_at` makes it unseen again. Seen items leave Needs you but stay in From the
   field. *Upgrade path if two owners need a shared "handled" state: rows in a table. Not now.*
4. **Placement.** S2 mounts both lists at the top of the **Week overview** (Needs you, collapsed
   to its count when empty; From the field, the latest 5 + "Show all"). S3 moves them into
   Today.

**Don't.**
- Query `audit_log` for the feed. It's desk-only, online, owner/lead, and noisier than needed.
- Notify (toast) on every new item. The crew schedule toast already exists; owners get the
  live list.

**Verify.**
- Unit-level sanity: run the derivations against a hand-built `ScheduleWeek` in a scratch
  script, or add tests if a test runner exists by then.
- Impersonate crew: skip a stop with a reason. Switch back to owner: it's in Needs you and at
  the top of From the field **without a reload** (realtime). Open it → it leaves Needs you.
- Offline: both lists render from cache. Opening an item works.
- An item marked seen comes back if the crew edits the note again.

### S2 as built — deviations
_(empty)_

---

## S3 — Today, rebuilt around routes

**Goal.** Make `Today` the live dispatch view (the routes running today, what's happening on
each, and what needs Matt) instead of the old dashboard's stat cards. Fixes F4 and F5
(run side).

**Read first:**
- `components/management/DashboardView.tsx`, `CrewsOnSitePanel.tsx`.
- `components/management/ScheduleView.tsx` → view-mode resolution (`VIEW_MODE_KEY`,
  `initialViewMode`, `seeDashboard`).
- `components/onboarding/GettingStartedCard.tsx` (rendered by the dashboard today; keep it
  somewhere sensible).
- S1 and S2 As-built notes.

**Depends on:** S2.

**Build.**
1. **`components/management/TodayView.tsx`** (new), replacing `DashboardView` in
   `ScheduleView`, in this order: Needs you (S2) → **Running today** → From the field (S2).
2. **Running today.** One card per route whose `default_days` includes today's weekday
   (`format(new Date(), 'EEE').toLowerCase()` against `'mon'…'sun'`). Each card: name, crew,
   truck, progress `done/total`, week note, **Now** (the in-progress stop, with elapsed via
   `formatElapsed`), and **Next** (the first scheduled stop in drive order, via the existing
   `orderRows`). Tap → that route's drill-in (S1). Routes with no `default_days` but with
   in-progress visits also appear, so nothing live is ever hidden. An "Other routes this week"
   link goes to Week.
3. **Live state.** The cached week already carries `started_at` / `ended_at` via
   `applyVisitUpdate`, so "Now" is live without `CrewsOnSitePanel`'s own query. **Offline,
   don't show a ticking timer over stale data:** when `useOfflineStatus`
   (`hooks/crew/useOfflineStatus.ts`) says offline, render "last seen on site at h:mm" instead of a running clock. This
   keeps `CrewsOnSitePanel`'s honest-offline principle without its uncached fetch. Delete
   `CrewsOnSitePanel` if nothing else uses it.
4. **What leaves Today:** the uninvoiced count and fleet-issue chips. They're desk information,
   so they move to their desk routes (Billing already shows uninvoiced; add a fleet-issue count
   to the Fleet nav badge only if it's cheap, otherwise just drop it from Today). Keep
   `GettingStartedCard` at the top of Today.
5. **Default view.** Resolution order stays tap → `?view=` → stored → *computed default*, where
   the computed default is `today` if the current week has any visits, else `week`.
6. **Onboarding.** `schedule.viewToggle` stays. If the tour's first step described the
   dashboard, rewrite its copy and bump `tour.schedule`'s version. Add a `NEWS` item:
   "Today now shows the routes running today, what needs you, and what crews reported."

**Don't.**
- Cache a live elapsed timer offline (see 3).
- Infer "today's routes" from visits alone. Visits are keyed to weeks, not days. `default_days`
  is the only day signal, and S3 is its first real use. Update the Days hint in
  `RouteDefaultsSheet.tsx`, which currently says it "labels the plan rather than scheduling to
  it." It now also decides what shows on Today.

**Verify.**
- On a Tuesday, only routes with `tue` in `default_days` (plus any with live visits) appear.
- Impersonate crew: Start a stop. As owner, its route card shows **Now** with a ticking timer.
  Stop it: **Next** advances and progress increments, with no reload.
- Airplane mode: Today renders from cache, the timer shows "last seen on site at …", and
  Needs you still works.
- `/app/dashboard` and `/management/dashboard` still redirect to `?view=today`.

### S3 as built — deviations
_(empty)_

---

## S4 — Property history in the stop sheet

**Goal.** Answer "when were we last there, and what happened?" from the stop itself. This is
the one thing the 4-week grid still did that nothing else does. Fixes F3, and is a
prerequisite for retiring the grid in S5.

**Read first:**
- `components/VisitDetailContent.tsx` (shared by `VisitDetailSheet` and `/app/stop/[visitId]`).
- `components/management/RecentVisitsList.tsx` and `lib/accounts/fetch.ts`. Recent visits
  today are **account-grained**, embedded in `account-detail`.
- `components/providers.tsx` → `PERSISTED_QUERY_KEYS`.
- `CLAUDE.md` → "Archiving" (FK lookups for history do **not** filter `is_archived`).

**Depends on:** none. Can run any time after S0, in parallel with S1–S3.

**Build.**
1. **`hooks/usePropertyHistory.ts`** (new): key `['property-history', propertyId]`, the last 8
   visits for one property (status, `ended_at`/`week_start`, crew via `visit_crew`,
   `completion_note`, `skip_reason`, `photo_count`), newest first, excluding the visit being
   viewed. Add `'property-history'` to `PERSISTED_QUERY_KEYS`.
2. **`components/management/PropertyHistoryStrip.tsx`** (new): compact rows (date ·
   status glyph · crew first names · note snippet · photo count), each opening that visit
   in the same sheet. Reuse `VisitStatusIcon`, `displayCrewFor`, `firstName`.
3. Mount it in `VisitDetailContent` for `seeDashboard` roles, below the current visit's
   details. Crew get it read-only if RLS lets them read past visits of a property they're on.
   **Verify the policy** rather than assuming either way, and record what you find.
4. Invalidate `['property-history', propertyId]` wherever a visit for that property completes
   or skips. Find the existing completion/skip success paths, and remember "enumerate every
   cache the feature reads."

**Don't.** Put the history in a new tab or page. It belongs on the sheet Matt already has open.

**Verify.**
- Open a stop with prior visits: history shows the right dates, crew and notes. Tap one →
  it opens.
- Complete a visit, reopen a different visit at the same property: the new one is at the top.
- Offline: previously viewed history renders from cache.
- As crew: matches whatever the RLS check concluded.

### S4 as built — deviations
_(empty)_

---

## S5 — Desktop three-pane, retire the grid

**Goal.** Give the laptop the same structure as the phone, shown all at once (list → route →
stop), and delete the property × week matrix. Fixes F3, and removes the one-vs-four-week fetch
coupling that `CLAUDE.md` warns about.

**Read first:**
- `components/management/ScheduleView.tsx` (`isWide`, `weekCount`, the `hidden lg:block` /
  `lg:hidden` pair), `ScheduleGrid.tsx` (to delete), `hooks/useScheduleInteractions.ts` (its
  cell-select path).
- `components/VisitDetailContent.tsx` — rendered inline as the third pane.
- `components/app/AppShell.tsx` — the `lg` sidebar width the panes have to share.
- `CLAUDE.md` → "Breakpoints". REDESIGN.md → R2.5 (superseded by this phase).
- S1–S4 As-built notes.

**Depends on:** S1, S3, S4.

**Build.**
1. **`components/management/ScheduleBoardDesktop.tsx`** (new), `lg` only:
   left (~280px) = Today/Week toggle, Needs you count, `ScheduleWeekOverview`; middle =
   the selected route's `ScheduleListMobile` (`routeGroupId`); right = inline
   `VisitDetailContent` for `?visit=`. In Today mode, the middle pane shows `TodayView`.
   Same URL state as the phone (`?route=`, `?visit=`), so a link opens the same thing on
   either device.
2. **Keyboard:** ↑/↓ moves through the middle pane's stops, Enter opens one in the right
   pane, Esc closes it. Keep `S` = schedule-without-opening for an unscheduled row (the grid's
   fast path).
3. **`ScheduleView.tsx`:** `weekCount` is always 1. Drop the 4-week branch, and keep neighbor
   prefetch. `useMediaQuery` now only picks which layout renders, not what's fetched.
   `DeepLinkedVisitSheet` still mounts once. On desktop it must not open a sheet on top of the
   right pane, so check for that.
4. **Delete** `ScheduleGrid.tsx`, the cell-key selection in `useScheduleInteractions`, and
   anything only it imported (`npm run lint` + typecheck will show the orphans).
5. **Docs:** update `CLAUDE.md` (Repository Structure: drop `ScheduleGrid.tsx`, add the new
   components; Breakpoints: the `lg` row becomes "nav → sidebar, schedule → three panes"; the
   `ScheduleView` coupling note). Mark REDESIGN.md R2.5 superseded.
6. **Onboarding:** run `npm run check:tours`. Anchors must resolve in the desktop board too
   (the runner uses the first *visible* match). Add a `NEWS` item for desktop users.

**Don't.**
- Add a horizontal scroll anywhere. At 1024px the three panes must fit beside the sidebar.
  Collapse the left pane to icons/initials before scrolling.
- Bring back multi-week columns in any form. See "Ruled out".

**Verify.**
- 1024px and 1440px: three panes, no horizontal scroll. Every action reachable by keyboard.
- Click route → stop → edit crew → the middle row updates in place. `?route=&visit=` reload
  restores both panes.
- A phone-shared link (`?route=…&visit=…`) opens identically on desktop, and the reverse.
- Accountant: read-only in every pane. Crew at desktop width: the flat list, as on the phone.
- Network tab: one week fetched (plus prefetched neighbors), not four.

### S5 as built — deviations
_(empty)_
