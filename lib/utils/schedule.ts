import { startOfWeek, addWeeks, isBefore, parseISO, format } from 'date-fns'
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
 * Pure (no I/O) so it can be reused by both the management Server Action
 * (getScheduleForWeek) and the crew client hook (useWeekSchedule).
 *
 * `ungroupedProperties` is optional and defaults to empty — the crew caller
 * never passes it (crew self-organize off route groups, so an unrouted
 * property has nothing to show them), while the management Server Action
 * supplies every property with no property_route_groups row so they aren't
 * silently dropped from the schedule.
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
