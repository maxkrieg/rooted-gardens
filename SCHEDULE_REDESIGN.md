# SCHEDULE_REDESIGN.md — From spreadsheet to dispatch board

A follow-on to `REDESIGN.md` (R1–R5, built). That redesign made the app work on a phone. This
one changes **what the schedule is organized around**. See `CLAUDE.md` for stack, schema and
conventions. It is the source of truth wherever this file is silent.

> **Status:** planned 2026-10-03. S0 done 2026-10-03 (prototype built; no walkthrough with Matt).
> S1 done 2026-10-03 (static checks pass; the functional checks under Verify are still to run).
> S2 done 2026-10-03 (same: static checks pass, functional checks not yet run).
>
> - [x] **S0** — Clickable prototype for Matt
> - [x] **S1** — Week overview + route drill-in
> - [x] **S2** — "Needs you" and "From the field"
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
**Shipped as specified:** `ScheduleWeekOverview.tsx` (new), the Generate CTA, `?route=` drill-in
in `ScheduleListMobile` (`routeGroupId` prop), the route action bar, per-band sort switches
removed, Select only on the route view, desktop grid untouched, `tour.schedule` → `version: 2`.
No new `MutationType`, no schema change.

Deviations and decisions:
- **`routeGroupStats` gained two fields,** `unscheduled` and `withoutCrew`, computed in the same
  loop. "Reuse, don't recompute" meant not re-walking the visits in the overview, so the counts
  went into the shared function. S2's `noCrew` exception should read `withoutCrew` from here.
  "Without crew" = a `scheduled` visit whose `displayCrewFor()` is empty.
- **Overview row:** the stop count is every property on the route this week, with
  "· N not scheduled" / "· none scheduled" when some have no visit yet. On an ungenerated week
  that reads "8 stops · none scheduled", which is more honest than "8 stops".
  `RouteDoneCount` and the progress bar appear once `done > 0`.
- **No "Due, not scheduled · N" row.** The mockup has one, but the Build list doesn't, and the
  CTA already carries the number. It's S2's `dueUnscheduled` item.
- **The CTA is hidden while the plan is loading or errored** (`useWeekPlan().isError`), and for
  anyone without `editSchedule`. That way it can never show a number the preview would disagree with.
- **Route header:** a new `RouteViewHeader` in `RouteGroupBand.tsx`, not the band itself. The
  band was ~60px+ with its plan line and note, over the ≤56px sticky rule. So only the 48px title
  row (`‹ Week`, name over the week's dates, `OnSiteDot`, done/total) + the 3px progress bar
  sticks. The plan line (now `RoutePlanLine`, shared with the band) and the note ribbon scroll
  under it. The schedule's own sticky header collapses to nothing on the route view
  (`ScheduleStickyBar collapsedOnPhone`), so the route header sticks at the top.
- **Sort switch:** on the route view's plan line, right-aligned, as the per-band one was. The
  phone passes `setAllSortMode(sortState.all)` to the list, so `byGroup` is stored but unread
  there. The desktop grid still reads and writes it (untouched). **Crew keep the top-of-page
  "Every route" switch,** since they have no route view. It's hidden below `lg` only for
  `seeDashboard` roles.
- **Action bar:** Crew and Truck both open `RouteAssignDialog`, which sets either one. The Note
  button reads "Add note" when there isn't one, opens the ribbon editor and scrolls to the top
  to show it. The bar hides while the keyboard is up (`useKeyboardOpen`), like the nav, and while
  select mode's `SelectionBar` is showing. "Not on a route" gets a reduced bar: ⋯ → Select stops.
  Its "Route all N" picker sits under its header.
- **History:** `openRoute` `pushState`s, and `‹ Week` calls `history.back()` when it pushed, so
  the button and the OS gesture are the same action. A `?route=` load slips an overview entry
  underneath once the week loads (replace → push), so Back from a deep link lands on the overview,
  not off the app. A deep link also forces Week, so you don't back out into a stored `Today`.
  Next 16 patches `pushState` to copy its `__NA` tree, so popstate restores from the router cache
  with no RSC fetch (checked in `node_modules/next/dist/client/components/app-router.js`).
  Overview scroll is saved on entry and restored in a layout effect on the way back.
- **A route that doesn't exist** is checked against the *unfiltered* week. A filter that empties a
  real route shows the empty state with a `‹ Week` button rather than kicking you out.
  "Not on a route" counts as gone once it's empty, e.g. after "Route all".
- **Tour v2 (mobile):** `band` is now a "do it" step (`advanceOn: 'schedule.routeOpened'`).
  `open-stop` requires `band` or `band-desktop` (the old band copy, kept for the grid). New steps:
  `route-actions` (anchor `schedule.routeActions`) and `route-back` (anchor
  `schedule.routeBack`, `advanceOn` a second new event, `schedule.routeClosed`), so the tour gets
  back to the overview for the ⋯ → Generate steps. `select-mobile` is gone (folded into
  `route-actions`). No step points at the CTA: it vanishes once a week is generated, and a
  missing anchor costs a 2.5s wait before the step is skipped. `actions-mobile` mentions it instead.
  `NEWS` item `news.scheduleRoutes` (owner, lead, accountant), anchored on the first overview row.
- **Chrome budget:** sticky header 48 + 16px padding/margin, then the Today|Week row 44 + 8 =
  ~116px above the first overview row. The Generate CTA (60px) sits above it while stops are due,
  which is deliberate: it's the primary action, not chrome.

**Checks:** `npm run build` ✓ · `npm run typecheck` ✓ · `npm run check:tours` ✓ (30 anchors) ·
`npm run lint`: the only error is the pre-existing `react-hooks/set-state-in-effect` in
`components/crew/VisitLogger.tsx`, a file this phase didn't touch.

**Not yet run: the functional checks under Verify** (375px under `build && start`, airplane mode,
impersonating crew and the accountant). Run them before relying on this phase. The riskiest parts
are the history entries (OS back from a deep link) and the scroll restore.

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
**Shipped as specified:** `scheduleExceptions` and `fieldActivity` in `lib/utils/schedule.ts`
(pure, from the cached week, no new query), `NeedsYouList.tsx` and `FieldActivityList.tsx` (new),
per-viewer seen state under `rg-schedule-seen`, both lists at the top of the phone Week overview.
No new `MutationType`, no schema change, no toast.

Deviations and decisions:
- **Signature:** `scheduleExceptions(week, decisions, now)`. It imports `UNGROUPED_SORT_KEY` for the
  "Not on a route" bucket's `routeKey`. Visit items carry the whole `row` + `visit`, not just ids,
  because `openSheet` needs the row. Order: skipped → longOnSite → crewReport → noCrew →
  dueUnscheduled. Skips and reports are newest first within their kind.
- **`noCrew` counts in its own loop** instead of reading `routeGroupStats().withoutCrew` (the S1 note
  suggested reusing it). That function needs `vehicles`, which a pure exceptions function shouldn't
  take. The definition is the same: a `scheduled` visit whose `displayCrewFor()` is empty. Items say
  "4 stops on Wilder have no crew" and open the route. Ungrouped says "… not on a route …".
- **`longOnSite`** is > `LONG_ON_SITE_HOURS` (4) since `started_at`. It's live state, so opening it
  doesn't mark it seen. The overview's `useScheduleInteractions` 30s tick keeps it current.
- **`dueUnscheduled` isn't shown on the Week overview:** the overview passes `decisions = []`,
  because the Generate CTA right above already carries that number. The derivation supports it, so
  S3's Today should pass `plan.decisions` (gated on `editSchedule` and a loaded, non-errored plan,
  like `dueCount`). The item opens the Generate sheet.
- **Seen is keyed on content, not `updated_at`.** The stored value is
  `status|skip_reason|completion_note|photo_count`. Pushing an invoice, or an office crew/vehicle
  edit, bumps `updated_at` too, and that would have resurfaced every report already read. Editing the
  note (or the skip reason, or reverting and re-completing) changes the signature, so it comes back,
  which is what Verify asks for. Capped at the latest 500 entries. `useScheduleSeen` reads storage in
  its `useState` initializer, which is safe because `ScheduleView` gates on hydration.
- **The sheet:** the overview calls `useScheduleInteractions` just for its sheet state and renders
  its own `VisitDetailSheet`, the same way `ScheduleListMobile` does. The two never mount together
  (overview ↔ route view), so there is never a second sheet. `?visit=` still syncs via `openSheet`.
- **Filtered week:** both lists derive from the *filtered* week, the same one the route rows below
  use. That way a route filter narrows everything on screen together.
- **From the field** is hidden while it's empty. Each row is time (today: `2:14 PM`, earlier:
  `Tue 2:14 PM`), "Christian finished **Account**", then the note/photo summary or the skip reason,
  plus the status glyph. Completed-over-assigned crew, first names. "Show all N" expands in place.
  Opening a row also marks it seen, so reading a report from the feed clears it from Needs you.
- **Needs you · 0** collapses to one 44px all-clear line rather than vanishing. That keeps the
  `schedule.needsYou` anchor stable. A small "Routes" label now separates the lists from the route rows.
- **Photo count freshness:** `photo_count` is only computed at fetch (completed visits, `type =
  'visit'`). Realtime `UPDATE`s preserve it (`{ ...v, ...incoming }`), but `photos` isn't in the
  realtime publication. So a crew completion arriving live shows its note right away, but its photo
  count only after the next refetch (focus, week change, reload). A follow-up could invalidate
  `schedule-visits` when a live update flips a visit to `completed`.
- **Onboarding:** no tour version bump, since the flow is unchanged. New anchor `schedule.needsYou`
  and `NEWS` item `news.scheduleNeedsYou` (owner, lead, accountant). It has **no `parentTour`**:
  the tour doesn't teach the lists, so finishing it shouldn't mark the news seen.
- **Accountant:** sees both lists. Rows open the read-only sheet. `noCrew` opens the route
  (read-only, no action bar).
- **Chrome budget:** the lists sit between the CTA and the first route row, so the routes start
  lower than S1's ~116px. That's deliberate (principle 2: what needs a decision comes first).

**Checks:** `npm run build` ✓ · `npm run typecheck` ✓ · `npm run check:tours` ✓ (31 anchors) ·
`npm run lint`: the only error is still the pre-existing one in `components/crew/VisitLogger.tsx`.
The phase's files lint clean. The derivations were run in a scratch script (jiti) against a hand-built
week: kinds, order, per-route grouping, ungrouped wording, `ended_at`→`updated_at` fallback and
mixed-offset sorting all came out as intended.

**Not yet run: the functional checks under Verify** (realtime skip → Needs you without reload,
offline render, seen → re-edit resurfaces). Run them under `build && start` with impersonation.

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


### S6 - Follow-ups on anything that came up in S1–S5
**Goal.** Fix anything that came up in S1–S5 that didn't have a clear owner or a clear fix. This is the "catch-all" phase for anything that was discovered during the previous phases that needs to be addressed before the redesign is considered complete.