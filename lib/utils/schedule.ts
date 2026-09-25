import { startOfWeek, addDays, addWeeks, isAfter, isBefore, parseISO, format } from 'date-fns'
import { cadenceFor, cadencePriority, intervalDaysFor } from '@/lib/utils/cadence'
import { displayCrewFor, isVisitInProgress } from '@/lib/utils/visits'
import type {
  Account,
  Employee,
  Property,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Parse `?week=YYYY-MM-DD` to its Monday; falls back to the current week. */
export function parseWeekParam(value: string | null | undefined): Date {
  if (!value) return getWeekStart(new Date())
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return getWeekStart(new Date())
  return getWeekStart(parsed)
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
 * Builds the route group → property → visit grid for one week. Pure.
 * Pass `ungroupedProperties` or unrouted properties vanish from the schedule.
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

/** Clusters a route group's rows by account, keeping first-occurrence (drive) order. */
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

/** Find a visit in the loaded weeks for a `?visit=` deep link; the link also carries `week`. */
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
 * Which properties are due in a week: last completed visit + intervalDaysFor() lands by Sunday.
 * Phased from each property's own last visit, never calendar parity. Pure, so the preview shows
 * exactly what gets created; skips existing visits and archived properties.
 */
export function planWeek(weekStart: string, candidates: PlanCandidate[]): PlanDecision[] {
  // Compare against Sunday, or a property due Thursday lands a week late.
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

    // No interval (as_needed, or an unknown frequency): surfaced in the preview's skipped list.
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
 * Longest-waiting first, as a view only (sort_order is the drive order). Stable, so ties keep
 * drive order; settled visits sink to the bottom.
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

export interface RouteGroupStats {
  /** Visits done (completed or skipped) — the week's work that's settled. */
  done: number
  /** Every property in this group this week, scheduled or not. */
  total: number
  /** Distinct crew across the group's visits, completed-over-assigned per visit. */
  crew: Employee[]
  /** Distinct vehicle names across the group's visits. */
  vehicles: string[]
  /** Any visit in the group currently on site. */
  onSite: boolean
}

/** One route group's week at a glance, from the same resolved visits the rows render. */
export function routeGroupStats(
  visits: Array<VisitWithCrew | null>,
  vehicles: Vehicle[],
): RouteGroupStats {
  const crewById = new Map<string, Employee>()
  const vehicleNames = new Set<string>()
  let done = 0
  let onSite = false

  for (const visit of visits) {
    if (!visit) continue
    // Skipped counts as settled: the decision is made and the week has moved on.
    if (visit.status === 'completed' || visit.status === 'skipped') done += 1
    if (isVisitInProgress(visit)) onSite = true
    for (const emp of displayCrewFor(visit)) crewById.set(emp.id, emp)
    const vehicleName = vehicles.find((v) => v.id === visit.vehicle_id)?.name
    if (vehicleName) vehicleNames.add(vehicleName)
  }

  return {
    done,
    total: visits.length,
    crew: [...crewById.values()],
    vehicles: [...vehicleNames],
    onSite,
  }
}
