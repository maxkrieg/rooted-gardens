import { startOfWeek, addDays, addWeeks, isAfter, isBefore, parseISO, format } from 'date-fns'
import { cadenceFor, cadencePriority, intervalDaysFor } from '@/lib/utils/cadence'
import type {
  Account,
  Property,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  VisitWithCrew,
} from '@/types/app'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/**
 * Parse a `?week=YYYY-MM-DD` query param into the Monday of that week.
 * Falls back to the current week when the param is missing or unparseable —
 * shared by the management schedule (server) and crew schedule (client) so a
 * week link works in both directions.
 */
export function parseWeekParam(value: string | null | undefined): Date {
  if (!value) return getWeekStart(new Date())
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return getWeekStart(new Date())
  return getWeekStart(parsed)
}

/** Serialize a week start for the `?week=` query param. */
export function formatWeekParam(date: Date): string {
  return format(getWeekStart(date), 'yyyy-MM-dd')
}

export function getWeeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = []
  let current = getWeekStart(start)
  while (!isBefore(end, current)) {
    weeks.push(current)
    current = addWeeks(current, 1)
  }
  return weeks
}

/** Raw property_route_groups row with its nested property/account. */
export type ScheduleAssignment = {
  property_id: string
  route_group_id: string
  sort_order: number
  property: (Property & { account: Account }) | null
}

/**
 * Assembles the route group → property → visit grid for a single week.
 * Pure (no I/O), and now called from exactly one place — useManagementSchedule's
 * `combine`, which every role's schedule goes through.
 *
 * `ungroupedProperties` is optional and defaults to empty. It stays optional
 * because the shape is useful without it, but the live caller always passes it:
 * a property on no route group would otherwise be silently dropped from the
 * schedule rather than landing in the "Not on a route" bucket.
 */
export function buildScheduleWeek(
  weekStart: string,
  routeGroups: RouteGroup[],
  assignments: ScheduleAssignment[],
  visits: VisitWithCrew[],
  ungroupedProperties: Array<Property & { account: Account }> = []
): ScheduleWeek {
  // Build visit lookup by property_id
  const visitByPropertyId = new Map<string, VisitWithCrew>()
  for (const v of visits) {
    visitByPropertyId.set(v.property_id, v)
  }

  const scheduleRouteGroups: ScheduleWeek['routeGroups'] = routeGroups.map((routeGroup) => {
    const groupAssignments = assignments
      .filter((a) => a.route_group_id === routeGroup.id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const rows: SchedulePropertyRow[] = []

    for (const assignment of groupAssignments) {
      const property = assignment.property
      if (!property) continue

      const account = property.account as Account

      rows.push({
        property: { ...property, account: undefined } as unknown as Property,
        account,
        routeGroup,
        visit: visitByPropertyId.get(property.id) ?? null,
      })
    }

    return { routeGroup, rows }
  })

  const ungrouped: SchedulePropertyRow[] = ungroupedProperties.map((property) => {
    const account = property.account as Account

    return {
      property: { ...property, account: undefined } as unknown as Property,
      account,
      routeGroup: null,
      visit: visitByPropertyId.get(property.id) ?? null,
    }
  })

  return { weekStart, routeGroups: scheduleRouteGroups, ungrouped }
}

/**
 * Clusters a route group's rows by account, preserving each account's first-
 * occurrence order (rows arrive pre-sorted by sort_order, so this naturally
 * keeps the route's drive order). Presentation-only — does not reshape
 * ScheduleWeek, so it doesn't touch buildScheduleWeek's crew-shared output.
 * An account whose properties span multiple route groups will legitimately
 * appear once per route group when this is applied per-group.
 */
export function groupRowsByAccount(
  rows: SchedulePropertyRow[]
): Array<{ account: SchedulePropertyRow['account']; rows: SchedulePropertyRow[] }> {
  const groups: Array<{ account: SchedulePropertyRow['account']; rows: SchedulePropertyRow[] }> = []
  const indexByAccountId = new Map<string, number>()

  for (const row of rows) {
    let idx = indexByAccountId.get(row.account.id)
    if (idx === undefined) {
      idx = groups.length
      indexByAccountId.set(row.account.id, idx)
      groups.push({ account: row.account, rows: [] })
    }
    groups[idx].rows.push(row)
  }

  return groups
}

/**
 * Locate a visit within a loaded schedule window, so a `?visit=<id>` deep link
 * can open its detail sheet directly. Returns the row with `visit` narrowed to
 * the matching one — the shape VisitDetailSheet expects.
 *
 * Callers pass the weeks they already hold, so a visit outside the loaded window
 * simply isn't found; the link carries `week` alongside `visit` to make sure the
 * right window is fetched in the first place.
 */
export function findVisitInWeeks(
  weeks: ScheduleWeek[],
  visitId: string | undefined,
): { row: SchedulePropertyRow; weekStart: string } | null {
  if (!visitId) return null

  for (const week of weeks) {
    for (const group of week.routeGroups) {
      for (const row of group.rows) {
        if (row.visit?.id === visitId) {
          return { row, weekStart: week.weekStart }
        }
      }
    }
    for (const row of week.ungrouped) {
      if (row.visit?.id === visitId) {
        return { row, weekStart: week.weekStart }
      }
    }
  }
  return null
}

// ─── Week planning ──────────────────────────────────────────────────────────────

/** What `planWeek` needs to know about a property to decide whether it's due. */
export type PlanCandidate = {
  property: Property
  account: Account
  routeGroup: RouteGroup | null
  /** ISO date of the most recent completed visit, or null if there's never been one. */
  lastVisitedOn: string | null
  /** True when a visit already exists for the week being planned. */
  hasVisitThisWeek: boolean
}

export type PlanDecision = {
  candidate: PlanCandidate
  due: boolean
  /** Why, in the owner's words — shown per row in the generate preview. */
  reason: string
}

/**
 * Decide which properties are due for a given week.
 *
 * Pure, and deliberately separate from anything that writes: R3.5's preview
 * renders exactly this output, so what the owner confirms is what gets created.
 *
 * A property is due when its next-due date — last completed visit plus its
 * interval — lands on or before the target week's Sunday. The interval is
 * intervalDaysFor(): the owner's per-property override, else the frequency
 * default. Sharing that one function with the cadence badge is the point; the
 * generator and the overdue chip can't disagree about the same property.
 *
 * Always phased from the property's own last visit, never from a fixed calendar
 * parity. The real route sheet's biweekly rows drift constantly (5/12, 5/18,
 * skip, 6/10) as weather and crew availability move them, so a parity rule would
 * fight the way the work actually happens.
 *
 * `as_needed` with no override has no interval at all and is never due — those
 * are scheduled by hand, by definition.
 *
 * Never returns a property that already has a visit that week, and never an
 * archived one. The UNIQUE (property_id, week_start) index makes the whole thing
 * idempotent regardless, so a double-run can't duplicate.
 */
export function planWeek(weekStart: string, candidates: PlanCandidate[]): PlanDecision[] {
  // Compared against the week's Sunday, not its Monday: a property that comes
  // due on Thursday belongs on Thursday's week, and anchoring on the Monday
  // would push it a week late.
  const weekEnd = addDays(parseISO(weekStart), 6)

  return candidates.map((candidate) => {
    const { property, lastVisitedOn, hasVisitThisWeek } = candidate

    if (property.is_archived) {
      return { candidate, due: false, reason: 'Archived' }
    }
    if (hasVisitThisWeek) {
      return { candidate, due: false, reason: 'Already on this week' }
    }

    const label = frequencyLabel(property.frequency)
    const intervalDays = intervalDaysFor(property)

    // No interval at all — as_needed with no override. Not silently dropped: an
    // unrecognised frequency lands here too, and the owner sees it in the
    // preview's skipped list and can schedule it by hand.
    if (intervalDays === null) {
      return property.frequency === 'as_needed'
        ? { candidate, due: false, reason: 'As needed — schedule by hand' }
        : { candidate, due: false, reason: `Unknown frequency (${property.frequency})` }
    }

    // No history: treat as due rather than guessing a phase. A property that has
    // never been visited is exactly the one most likely to be overlooked.
    if (!lastVisitedOn) {
      return { candidate, due: true, reason: 'Never visited' }
    }

    const nextDue = addDays(parseISO(lastVisitedOn), intervalDays)
    const every = `${label} — every ${intervalDays} days`

    return isAfter(nextDue, weekEnd)
      ? { candidate, due: false, reason: `${every}, next due ${format(nextDue, 'EEE MMM d')}` }
      : { candidate, due: true, reason: `${every}, due ${format(nextDue, 'EEE MMM d')}` }
  })
}

function frequencyLabel(frequency: string): string {
  if (frequency === 'weekly') return 'Weekly'
  if (frequency === 'biweekly') return 'Biweekly'
  if (frequency === 'monthly') return 'Monthly'
  if (frequency === 'as_needed') return 'As needed'
  return frequency
}

// ─── Priority ordering ──────────────────────────────────────────────────────────

/**
 * Reorder a route group's rows so the properties that have waited longest come
 * first, most overdue at the top.
 *
 * A *view* over the rows, never a write. property_route_groups.sort_order is the
 * order the crew physically drive the route, so this is opt-in and the schedule
 * defaults to leaving it alone. Ties keep the incoming drive order — Array.sort
 * is stable — so within a band of equally-urgent stops the route still reads in
 * driving sequence.
 *
 * Settled visits sink to the bottom: work that's done needs no attention, and
 * leaving them interleaved buries the stops the mode exists to surface.
 */
export function sortRowsByPriority(
  rows: SchedulePropertyRow[],
  lastVisitByProperty: Record<string, string> | undefined,
  today: Date = new Date(),
): SchedulePropertyRow[] {
  const weight = (row: SchedulePropertyRow): number => {
    const settled = row.visit?.status === 'completed' || row.visit?.status === 'skipped'
    if (settled) return -Infinity
    return cadencePriority(cadenceFor(row.property, lastVisitByProperty?.[row.property.id], today))
  }

  return [...rows].sort((a, b) => weight(b) - weight(a))
}
