# DAY_PLANNING.md — Which day each stop runs

A follow-on to `SCHEDULE_REDESIGN.md` (S0–S6, built). See `CLAUDE.md` for stack, schema and
conventions; it is the source of truth wherever this file is silent.

> **Status:** planned 2026-10-14. **All phases built locally 2026-10-15; prod migration and push pending.** D0 done 2026-10-14 (static checks pass; dev migrated and
> DB checks run; prod not migrated yet; the offline-flush check is still to run).
> D1 done 2026-10-14 (static checks pass; the functional checks under Verify are still to run).
> D2 done 2026-10-15 (static checks pass; logic checked with a scratch script; the in-app checks are still to run).
> D3 done 2026-10-15 (static checks pass; the functional checks under Verify are still to run).
> D4 done 2026-10-15 (static checks pass; the day rule checked with a scratch script; generating a real week is still to try).
>
> - [x] **D0** — Schema, queue type, pure helpers
> - [x] **D1** — Day lanes in the route view
> - [x] **D2** — Today runs on the day
> - [x] **D3** — "Plan tomorrow" sheet
> - [x] **D4** — Generate pre-fills days
>
> **One Claude Code session per phase.** Prompt: *"Implement phase D<n> of DAY_PLANNING.md.
> Fill in its As-built section and tick its box when done."* Read **Shared rules** first.

---

## Why

The schedule is keyed to the **week**: a visit is (property × `week_start`). The only day signal
is `route_groups.default_days`, which `routesRunningToday()` (`lib/utils/schedule.ts`) uses to
put routes under "Running today". That is fine for a one-day route. It breaks on the routes Matt
actually runs: `Wilder · Mon/Tue`, `New Hampshire · Tue/Wed/Thu`. On Monday Wilder shows all 8
stops, on Tuesday all 8 again, and nothing records which 4 are Monday's. The `route` / `priority`
sorts (`lib/utils/schedule-sort.ts`) order stops; neither splits them by day.

SCHEDULE_REDESIGN.md ruled out "a `planned_day` on visits" on the grounds that the day lives on
the route. Multi-day routes are the case that ruling missed. This file reverses it — for the
visit only; the route keeps its `default_days` as the standing plan.

## The model

- **`visits.planned_date date NULL`** — the day this stop is planned for, inside its week.
  `NULL` = "any day this week", which is the honest state of every visit that exists today.
- It is a **plan, not a constraint.** Crew can still do a Tuesday stop on Monday; nothing blocks,
  and completion keeps using `ended_at`.
- **Carryover is derived, never written.** A `scheduled` visit whose `planned_date` is before
  today, and which hasn't started, reads as "Carried over from Mon". No cron, no write on open.
- **Two ways to set it, one column:** weekly (day lanes in the route view, D1; pre-filled by
  Generate, D4) and daily (the "Plan tomorrow" sheet on Today, D3), for when weather or who
  showed up reshuffles things.

### Phone — Route (drill-in), multi-day route
```
┌──────────────────────────────────────┐
│ ‹ Week    Wilder · Mon/Tue      5/8  │
│ ⚑ no Ryan till Thurs                 │
├──────────────────────────────────────┤
│ MON · 4                      3/4     │  day lane header (route's days, in order)
│ ✓ Tennis, Trash, Parking      [Mon]  │
│ ◷ Pool House         0:42     [Mon]  │
│ ○ Kerr Rd                     [Mon]  │
│ TUE · 3                              │
│ ○ Hendersons                  [Tue]  │
│ ANY DAY · 1                          │  unplanned last
│ ○ Old Mill                   [+ day] │
├──────────────────────────────────────┤
│ [ Crew ] [ Truck ] [ Day ] [ ⋯ ]     │
└──────────────────────────────────────┘
```
Day chip → `DayPickerSheet`: one row of the route's days (large), the other weekdays (muted),
`Any day` last. Every target ≥ 44px.

### Phone — Today, with days
```
│ Running today                        │
│ ┌──────────────────────────────────┐ │
│ │ Wilder        RC JK  Blue F-150  │ │
│ │ ▓▓▓▓▓░░░ 2/4 today  ● On site    │ │  counts today's + any-day + carried
│ │ ↻ Carried over · 1 (Kerr Rd)     │ │
│ │ Now Pool House · Next Hendersons │ │
│ └──────────────────────────────────┘ │
│ [ Plan tomorrow ]                    │  D3
```

### Ruled out
- **Auto-moving unfinished stops** to the next route day. Derived carryover is offline-safe and
  leaves the decision with Matt.
- **A weekday key (`'mon'`) instead of a date.** A date makes "today" a plain comparison and the
  CHECK against `week_start` exact.
- **Day-first Week view** (tabs Mon–Sat replacing route rows). Revisit only if Matt turns out to
  think day-first after living with D1–D3.
- **Gestures / drag between lanes.** Same as REDESIGN.md.

---

## Shared rules — every phase

Read `CLAUDE.md` → **Data Architecture → Rules that bite** first. The ones that apply here:

- **Field route = client-first.** Reads via React Query; writes through the offline queue.
  Queued mutations need `networkMode: 'always'` (`useQueuedVisitMutation` handles it).
- **A batch owns its optimistic state:** patch once, write each row `silent`, invalidate once
  (`useReorderRouteProperties` in `RouteGroupCard.tsx`). Day changes on N stops are a batch.
- **No `router.refresh()`.** View state lives in the URL via `replaceState`, as `ScheduleView` does.
- **Breakpoints:** `lg` only. The day lanes render in both the phone drill-in and the board's
  middle pane because both are `ScheduleListMobile`.
- **Capabilities are affordances, RLS is the boundary.** Note: `visits_update` already lets crew
  update *any column* of a visit they're assigned to (there is no column guard on `visits`), so
  `planned_date` has the same exposure as `crew_instruction`. Don't add a guard in this plan;
  hide the control from crew with `useCan`.
- **Onboarding:** `tour.schedule` anchors must keep matching; `npm run check:tours` must pass.
- **Errors:** `toUserMessage` / `reportError`. **Comments:** 2–3 lines max.
- **Check trio (+1):** `npm run build` · `npm run typecheck` · `npm run lint` · `npm run check:tours`.

---

## D0 — Schema, queue type, pure helpers

**Goal:** the column exists in dev and prod, flows through the schedule fetch, has a queued
write, and the day logic is pure functions. No UI.

**Read first:** `supabase/migrations/20260930120000_audit_log.sql` (the `visits` CASE),
`docs/DEPLOYMENT.md` → "Making a schema change (dev → prod)", `lib/schedule/fetch.ts`,
`lib/offline/idb.ts`, `lib/offline/mutation-queue.ts` (`set_vehicle` is the closest case),
`components/crew/StuckChangesSheet.tsx`, `hooks/useManagementSchedule.ts`
(`useQueuedVisitMutation`), `lib/utils/schedule.ts` (`weekdayKey`, `routesRunningToday`).

**Build:**
1. Migration `supabase/migrations/<ts>_visits_planned_date.sql`:
   - `ALTER TABLE visits ADD COLUMN planned_date date;`
   - `CHECK (planned_date IS NULL OR planned_date BETWEEN week_start AND week_start + 6)`.
   - `CREATE OR REPLACE FUNCTION audit_row_change()` with one new branch,
     `WHEN 'planned_date' = ANY (v_changed) THEN 'visit.day_planned'`, placed after
     `vehicle_changed`. Copy the whole function from the audit migration; change only that line.
2. Apply to **dev** (`supabase db push --linked`, confirm `supabase/.temp/project-ref` first).
   Additive → prod can be migrated before the code merges. Regenerate `types/database.ts`.
3. `lib/audit/actions.ts`: `'visit.day_planned': { label: 'Day planned', group: 'Visits' }`.
4. `lib/schedule/fetch.ts`: include `planned_date` in the visit select.
5. Queue type `set_planned_date` — payload `{ visitId, plannedDate: string | null }`. Touch
   `MutationType` (idb.ts), the payload interface + union, the flush `case` (a plain `update`,
   replay-safe), and `TYPE_LABELS` ("Planned day").
6. Hooks in `hooks/useManagementSchedule.ts` (or a sibling `useSetPlannedDate.ts`):
   `useSetPlannedDate()` on top of `useQueuedVisitMutation`, and `useSetPlannedDates()` for a
   batch, following the batch rule above. Both call `useRefreshSchedule` semantics on settle.
7. Pure helpers in `lib/utils/schedule.ts`:
   - `stopsByDay(rows, routeDays, weekStart)` → `Array<{ date: string | null; rows }>`: one lane
     per route day in Mon→Sun order, plus a lane for any off-route day a stop is planned on, plus
     `null` (Any day) last. Empty route-day lanes are kept (they're drop targets for the picker's
     meaning, and "TUE · 0" is information).
   - `isCarriedOver(visit, today)` — scheduled, not started, `planned_date < today`.
   - `defaultPlannedDate(lastEndedAt, routeDays, weekStart)` — the date in this week with the
     same weekday as `lastEndedAt`, if that weekday is in `routeDays`; else `null`.

**Don't:** add `planned_date` to `PERSISTED_QUERY_KEYS` (it rides in existing keys); write a
day anywhere yet; add a visits column guard.

**Verify:** the CHECK rejects a date outside the week (SQL in the dev SQL editor); an UPDATE of
`planned_date` lands in `audit_log` as `visit.day_planned`; queue a `set_planned_date` offline
(prod build) and see it flush; trio passes.

**As built — deviations:**
- Migration `20261014120000_visits_planned_date.sql`, pushed to **dev only**. Run
  `supabase db push` against prod before D1 merges. The audit function was copied from
  `20261002020029_impersonation.sql`, the latest definition, not from the audit migration.
- `lib/schedule/fetch.ts` needed no change, because it already selects `*`.
- **One write path, not two hooks.** `useBulkScheduleActions().setPlannedDay(targets, day)` sets
  the day for one stop or many, mirroring `setVehicle`. It patches every visit up front, flushes
  once, and returns Undo that restores each visit's previous date. It takes a **weekday key**
  (`'tue'`), not a date, so targets in different weeks each get their own date and can't trip
  the CHECK. Rows with no visit yet get one first, the same as Crew/Truck. D1's chip should call
  it with a single target.
- `useCreateVisit`'s optimistic visit gains `planned_date: null`. It is cast, so typecheck
  can't catch a missing column there.
- Helpers in `lib/utils/schedule.ts`: `DAY_KEYS`, `plannedDateFor`, `DayLane`, `stopsByDay`,
  `isCarriedOver`, `defaultPlannedDate`. `RouteGroupBand`'s private `DAY_ORDER` duplicates
  `DAY_KEYS`; D1 can fold it in.
- Verified on dev, inside transactions that rolled back: the UPDATE logged
  `visit.day_planned` with `{planned_date: [null, date]}`, and `week_start + 7` was rejected by
  `visits_planned_date_in_week`. The offline-queue flush check hasn't been run yet (it needs a
  browser on a prod build).

---

## D1 — Day lanes in the route view

**Goal:** inside a multi-day route, stops sit under their day; Matt can set a stop's day in two
taps and a selection's day in three.

**Read first:** `components/management/ScheduleListMobile.tsx` (`renderStopRow`, `renderRows`,
`RouteActionBar`), `components/management/ScheduleBulkControls.tsx`,
`components/management/RouteGroupBand.tsx` (`DAY_ORDER`), `lib/onboarding/registry.ts`
(`tour.schedule`, `NEWS`), D0's helpers.

**Build:**
1. In the route drill-in only (not the Week overview), when the route has ≥ 2 `default_days`
   **or** any stop has a `planned_date`, render `stopsByDay(...)` lanes. Each lane: a sticky-free
   header `MON · 4` + `3/4` done on the right, then the existing rows in the current sort. A
   route with 0–1 days and no planned stops keeps the flat list unchanged.
2. Day chip on each stop row's meta line (`Mon`, or `+ day` when null). The row is a `<button>`,
   so the chip can't nest inside it: make the row a `div` wrapper holding the existing row button
   and a sibling chip button positioned on the right of the meta line. Keep `data-stop-row` on the
   main button so ↑/↓ on the board still works. Chip renders read-only text for roles without
   edit (`useCan`), and is hidden in select mode.
3. `components/management/DayPickerSheet.tsx`: bottom sheet (phone) / popover (board). Route
   days large and first, other weekdays muted, `Any day` last; current value marked. Selecting
   calls `useSetPlannedDate`.
4. `RouteActionBar`: a `Day` action. Outside select mode it enters select mode preset for a day
   change (same as Crew/Truck do today); with a selection it opens `DayPickerSheet` and calls
   `useSetPlannedDates`, with an Undo toast like the bulk crew change.
5. Onboarding: add `data-tour="schedule.dayChip"` to the first chip, a step in `tour.schedule`,
   bump its `version`, add a `NEWS` item with `parentTour: 'tour.schedule'`.

**Don't:** put lanes on the Week overview rows (a per-route `Mon 4 · Tue 3` count is enough
there, optional); persist a "collapsed lane" state; use drag.

**Verify:** a Mon/Tue route shows three lanes; setting a day moves the row between lanes
instantly, offline too; bulk Day + Undo restores prior dates (including nulls); crew see chips
but can't open the picker; desktop board middle pane shows the same lanes; trio passes.

**As built — deviations:**
- **No `Day` button on the route action bar.** A phone already fits Crew · Truck · Note · ⋯
  there. Bulk `Day` went into select mode's `SelectionBar` instead, next to Crew/Truck, and is
  reached through ⋯ → Select stops. `BulkActionSheet` gained a `'day'` kind, and
  `ScheduleBulkControls` takes `weekStart` and `routeDays`.
- `components/management/DayPicker.tsx` exports `DayPickerOptions`, which the chip and the bulk
  action share, plus `DayPickerSheet` and `dayName`. It's a bottom sheet on the board too, not
  a popover, to match `BulkActionSheet`.
- The row is now a `div` wrapper (tint, selection, active spine, border) around the row button
  and a sibling chip button that is 56px wide and runs the full row height.
  `[data-stop-row]` stays on the row button, and the board's ↑/↓ uses `querySelectorAll`, so
  navigation doesn't depend on the structure.
- The chip is hidden on rows with no visit (tapping those still schedules them) and in select
  mode. Crew and the accountant see a read-only pill, and only when a day is set.
- Lanes appear when a route has ≥ 2 `default_days` **or** any stop has a `planned_date`. Until
  D4 pre-fills, a multi-day route opens with empty route-day lanes and everything under Any day,
  which is accurate. Today's lane is marked "Today" in green.
- A single chip tap goes through `setPlannedDay` with one target, with an Undo toast.
- The Week overview's per-route `Mon 4 · Tue 3` counts are **not** built (they were optional).
- `RouteGroupBand`'s private `DAY_ORDER` was folded into `DAY_KEYS` (now `readonly string[]`).
- Onboarding: `tour.schedule` is now v6, with a `day-chip` step after `route-actions` (skipped
  on routes with no chip, because the runner skips missing anchors). Added the
  `news.dayPlanning` NEWS item (owner/lead).


---

## D2 — Today runs on the day

**Goal:** a route card on Today shows today's work, not the whole week's.

**Read first:** `components/management/TodayView.tsx`, `lib/utils/schedule.ts`
(`routesRunningToday`, `RunningRoute`), the crew branch of `ScheduleView.tsx`.

**Build:**
1. `routesRunningToday()`: a route shows if today is in its `default_days`, **or** any stop is
   planned for today, **or** a stop is on site (unchanged). Its `rows` become: planned today +
   `Any day` stops (only when today is a route day) + carried over. `next` and progress count
   those rows. Keep the full-week row list available for the "open route" tap.
2. Route card: a `↻ Carried over · n` line under progress when n > 0, naming the first stop.
3. Crew's stop list: a `Today` / `Week` chip pair defaulting to `Today` when any of their stops
   has a `planned_date` this week. Same data, client-side filter; no RLS change.
4. Update the `routesRunningToday` doc comment — `default_days` is no longer the only day signal.

**Don't:** write anything to resolve carryover; tick a clock over stale data (existing rule).

**Verify:** stop planned yesterday, not done → appears today as carried over, and `audit_log`
has no new row; a Mon/Tue route on Tuesday shows only Tue + Any + carried; a route with one stop
planned on its off day appears that day; trio passes.

**As built — deviations:**
- `routesRunningToday(week, today: Date, order)` now takes a date, not a weekday key. A stop is
  **today's** if it is planned today, has no day and its route runs today, is carried over, is
  on site, or was **finished today** (`ended_at` falls on today's local date). That last
  condition wasn't in the plan: it keeps a Tuesday stop done early on Monday in Monday's count,
  and stops Monday's finished stops from padding Tuesday's.
- A route shows when it runs today, or has a stop planned today, on site, or finished today.
  Carryover alone doesn't bring back a route that isn't running today, because it would
  re-appear every day until someone dealt with it. `otherCount` still counts the rest.
- `RunningRoute.rows` is now today's stops only, and there's a new `carried` field. The card's
  done count, progress bar and Next all use today's stops. The card says "Carried over · n
  (first stop …)", "Today's stops are settled" and "Nothing scheduled for today". Opening the
  card still goes to the full route view (with its day lanes), so no week-wide list is kept on
  the card.
- **No crew Today filter.** Since `4f88011` crew no longer have a separate stop list: they get
  the route overview and route view, and D1's day lanes already mark today's lane. A filter
  would duplicate that.
- Checked with a throwaway esbuild script against a fake week (a Mon/Tue route on a Tuesday,
  plus a Thursday route with one stop planned for Tuesday). The right stops, carryover, Next
  and `otherCount` came out. No write happens on any path; carryover is computed purely.
- Updated `CLAUDE.md` (the `TodayView` line and the `default_days` note) and the
  `news.dayPlanning` text.


---

## D3 — "Plan tomorrow" sheet

**Goal:** the daily way to set days — pick tomorrow's stops from what's left.

**Read first:** `components/management/UnroutedPanel.tsx` (checkbox + sticky bottom bar
precedent), `components/management/TodayView.tsx`, `lib/utils/cadence.ts` (`cadencePriority`).

**Build:**
1. On Today (owner/lead), a `Plan tomorrow` button below Running today; inside the sheet, a
   segmented `Today | Tomorrow` target. On Saturday/Sunday "tomorrow" is the next route day
   inside the current week, or the control hides if none is left.
2. `components/management/PlanDaySheet.tsx`: this week's scheduled, not-started stops whose
   `planned_date` is null or before the target, grouped by route, priority-sorted within route,
   carried-over ones flagged. Stops already on the target day are listed checked at the top.
3. Sticky bar: `Put 7 on Wed` → `useSetPlannedDates`. Unchecking a pre-checked stop clears it
   back to `Any day`. Undo toast.
4. Onboarding: a checklist item or `NEWS` entry only — tours must not drive a write.

**Don't:** reorder stops (drive order stays the route's); offer days outside the current week
(the week model holds).

**Verify:** plan Wednesday from Tuesday evening offline, reconnect, see it on a second device via
Realtime; trio passes.

**As built — deviations:**
- Entry point: a `Plan tomorrow` outline button under Running today (and under "Other routes"),
  owner/lead only (`editSchedule`), anchored `data-tour="today.planDay"`. On Sunday it reads
  `Plan today`, because tomorrow is in next week and a visit can't be planned outside its own
  week. The sheet's `Today | Tomorrow` toggle hides then, rather than jumping to "the next route
  day" as the plan said.
- `components/management/PlanDaySheet.tsx` lists this week's scheduled, not-started stops whose
  `planned_date` is null, or on or before the target day. Stops planned for a later day are left
  out. Each route is sorted by `sortRowsByPriority`, and routes that run on the target day come
  first. Flags: `Carried over from Mon` (planned before today), and `Planned today` when
  planning tomorrow, which is the "push it to tomorrow" case.
- It reads the **unfiltered** current week (`weeks[0]`), not Today's filtered one, so a filter
  can't silently hide stops from planning.
- Ticks are stored as a diff from what's already on the target, and reset when the target
  changes. The button says `Put N on Wed` (N = everything ticked), and is disabled until
  something changes. Saving makes at most two `setPlannedDay` calls (adds → day, unticks →
  null), with one Undo toast that runs both undos.
- The rows are `role="checkbox"` buttons with `CheckIndicator`, not shadcn `Checkbox`, so the
  whole row is the tap target, like select mode in the route view.
- The sheet mounts only while open, so ticks left by a cancel are dropped.
- Added the `news.planTomorrow` NEWS item (owner/lead), with no `parentTour`: the schedule tour
  doesn't teach it, and tours mustn't drive a write.


---

## D4 — Generate pre-fills days

**Goal:** after Generate, multi-day routes already have last week's pattern; Matt fixes
exceptions instead of starting blank.

**Read first:** `lib/utils/schedule.ts` (`planWeek`, `PlanCandidate`), `hooks/useGenerateWeek.ts`,
`components/management/GenerateWeekSheet.tsx`, the `create_visit` case in
`lib/offline/mutation-queue.ts`.

**Build:**
1. `CreateVisitPayload` gains optional `plannedDate?: string | null`; the flush upsert includes
   it when present. Optional, so mutations already queued on a phone still replay.
2. `useGenerateWeek`: for each due property, `defaultPlannedDate(lastVisitedOn, routeDays, weekStart)`.
   `lastVisitedOn` comes from `property_last_visit` (ended_at), already loaded for `planWeek`.
3. Preview: per route, `Mon 4 · Tue 3 · Any 1` under the count.

**Don't:** let Generate overwrite a `planned_date` on an existing visit (it only creates).

**Verify:** generate a week where Wilder's stops were split Mon/Tue last week → same split this
week; a property last done on a non-route day lands in Any day; trio passes.

**As built — deviations:**
- `planWeek()` is unchanged. A new pure helper,
  `decisionPlannedDate(decision, weekStart)` in `lib/utils/schedule.ts`, wraps
  `defaultPlannedDate` with the candidate's `lastVisitedOn` (already a local `yyyy-MM-dd` from
  `usePropertyLastVisit`) and its route's `default_days`. The preview and the write both call
  it, so what's shown is exactly what's written.
- `useCreateVisit(row, weekStart, label?, plannedDate = null)` gained a 4th parameter. It sets
  the optimistic visit's `planned_date` and goes in the `create_visit` payload as optional
  `plannedDate`. The flush upsert writes `planned_date: p.plannedDate ?? null`. Payloads queued
  before this have no field and write null, the column default. It's still `ignoreDuplicates`,
  so Generate never touches an existing visit's day.
- The preview shows a `Mon 4 · Tue 3 · Any 1` line under each route header, only for routes with
  ≥ 2 days (a one-day route has nothing to split). It counts only ticked stops, so it updates as
  rows are unticked.
- Checked with a throwaway esbuild script: last done Tue → this week's Tue, Mon → Mon, Thu (off
  the route) → Any, never visited → Any, no route → Any.

