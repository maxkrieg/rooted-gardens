import { startOfWeek, addDays, addWeeks, isAfter, isBefore, parseISO, format } from 'date-fns'
import { cadenceFor, cadencePriority, intervalDaysFor } from '@/lib/utils/cadence'
import { displayCrewFor, isVisitInProgress } from '@/lib/utils/visits'
import { UNGROUPED_SORT_KEY } from '@/lib/utils/schedule-sort'
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
  /** Properties with no visit this week. */
  unscheduled: number
  /** Scheduled visits nobody is on yet — the week overview's "N without crew". */
  withoutCrew: number
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
  let unscheduled = 0
  let withoutCrew = 0

  for (const visit of visits) {
    if (!visit) {
      unscheduled += 1
      continue
    }
    // Skipped counts as settled: the decision is made and the week has moved on.
    if (visit.status === 'completed' || visit.status === 'skipped') done += 1
    if (isVisitInProgress(visit)) onSite = true
    const crew = displayCrewFor(visit)
    if (visit.status === 'scheduled' && crew.length === 0) withoutCrew += 1
    for (const emp of crew) crewById.set(emp.id, emp)
    const vehicleName = vehicles.find((v) => v.id === visit.vehicle_id)?.name
    if (vehicleName) vehicleNames.add(vehicleName)
  }

  return {
    done,
    total: visits.length,
    crew: [...crewById.values()],
    vehicles: [...vehicleNames],
    onSite,
    unscheduled,
    withoutCrew,
  }
}

// ─── Exceptions and field activity ──────────────────────────────────────────────

/** On site this long reads as a forgotten Stop tap or a job gone wrong. */
export const LONG_ON_SITE_HOURS = 4

type VisitException = {
  kind: 'skipped' | 'crewReport' | 'longOnSite'
  key: string
  row: SchedulePropertyRow
  visit: VisitWithCrew
  /** Route group id, or null when the property is on no route. */
  routeKey: string | null
  description: string
}

type AggregateException =
  | {
      kind: 'noCrew'
      key: string
      /** Route group id, or UNGROUPED_SORT_KEY for "Not on a route". */
      routeKey: string
      count: number
      description: string
    }
  | { kind: 'dueUnscheduled'; key: string; count: number; description: string }

/** One thing on the week that needs a decision. Visit items open the stop; aggregates don't. */
export type ScheduleException = VisitException | AggregateException

/**
 * What needs Matt this week, most urgent first: skips, long on-site, crew reports, routes with
 * crewless stops, then due-but-unscheduled. Pure; "seen" filtering is the caller's job.
 */
export function scheduleExceptions(
  week: ScheduleWeek | undefined,
  decisions: PlanDecision[],
  now: Date,
): ScheduleException[] {
  if (!week) return []
  const skipped: VisitException[] = []
  const longOnSite: VisitException[] = []
  const reports: VisitException[] = []
  const noCrew: AggregateException[] = []

  const buckets = [
    ...week.routeGroups.map((g) => ({ key: g.routeGroup.id, name: g.routeGroup.name, rows: g.rows })),
    { key: UNGROUPED_SORT_KEY, name: null, rows: week.ungrouped },
  ]

  for (const bucket of buckets) {
    let crewless = 0
    for (const row of bucket.rows) {
      const visit = row.visit
      if (!visit) continue
      const routeKey = row.routeGroup?.id ?? null
      const base = { key: visit.id, row, visit, routeKey }

      if (visit.status === 'skipped') {
        skipped.push({
          ...base,
          kind: 'skipped',
          description: visit.skip_reason ? `Skipped: “${visit.skip_reason}”` : 'Skipped, no reason given',
        })
      } else if (visit.status === 'completed') {
        const report = crewReportSummary(visit)
        if (report) reports.push({ ...base, kind: 'crewReport', description: report })
      } else {
        if (
          isVisitInProgress(visit) &&
          visit.started_at &&
          now.getTime() - parseISO(visit.started_at).getTime() > LONG_ON_SITE_HOURS * 3_600_000
        ) {
          longOnSite.push({
            ...base,
            kind: 'longOnSite',
            description: `On site since ${format(parseISO(visit.started_at), 'h:mm a')}`,
          })
        }
        if (displayCrewFor(visit).length === 0) crewless += 1
      }
    }
    if (crewless > 0) {
      const stops = crewless === 1 ? '1 stop' : `${crewless} stops`
      noCrew.push({
        kind: 'noCrew',
        key: `noCrew:${bucket.key}`,
        routeKey: bucket.key,
        count: crewless,
        description: bucket.name
          ? `${stops} on ${bucket.name} ${crewless === 1 ? 'has' : 'have'} no crew`
          : `${stops} not on a route ${crewless === 1 ? 'has' : 'have'} no crew`,
      })
    }
  }

  const byNewest = (a: VisitException, b: VisitException) =>
    Date.parse(activityTime(b.visit)) - Date.parse(activityTime(a.visit))
  const due = decisions.filter((d) => d.due).length
  const dueItem: AggregateException[] =
    due > 0
      ? [
          {
            kind: 'dueUnscheduled',
            key: 'dueUnscheduled',
            count: due,
            description: `${due} ${due === 1 ? 'stop is' : 'stops are'} due and not scheduled`,
          },
        ]
      : []

  return [
    ...skipped.sort(byNewest),
    ...longOnSite,
    ...reports.sort(byNewest),
    ...noCrew,
    ...dueItem,
  ]
}

/** `"Back gate stuck" · 2 photos`, or null when crew sent nothing back. */
export function crewReportSummary(visit: VisitWithCrew): string | null {
  const note = visit.completion_note?.trim()
  const photos = visit.photo_count ?? 0
  const parts = [
    note ? `“${note}”` : null,
    photos > 0 ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** When a settled visit happened: ended_at, else updated_at (a skip never started has no end). */
export function activityTime(visit: VisitWithCrew): string {
  return visit.ended_at ?? visit.updated_at
}

export type FieldActivityItem = {
  row: SchedulePropertyRow
  visit: VisitWithCrew
  at: string
}

/** The week's completed and skipped visits, newest first — what came back from the field. */
export function fieldActivity(week: ScheduleWeek | undefined): FieldActivityItem[] {
  if (!week) return []
  const rows = [...week.routeGroups.flatMap((g) => g.rows), ...week.ungrouped]
  const items: FieldActivityItem[] = []
  for (const row of rows) {
    const visit = row.visit
    if (visit?.status !== 'completed' && visit?.status !== 'skipped') continue
    items.push({ row, visit, at: activityTime(visit) })
  }
  // Parsed, not string-compared: an optimistic patch and a server row format offsets differently.
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** `'mon'`…`'sun'` for a date, the same keys `route_groups.default_days` stores. */
export function weekdayKey(date: Date): string {
  return format(date, 'EEE').toLowerCase()
}

export type RunningRoute = {
  /** A route group id, or UNGROUPED_SORT_KEY. */
  key: string
  routeGroup: RouteGroup | null
  rows: SchedulePropertyRow[]
  /** Visits on site now, in the rows' order. */
  now: SchedulePropertyRow[]
  /** The first stop not yet started, in the rows' order. Callers pass drive-ordered rows. */
  next: SchedulePropertyRow | null
}

/**
 * Routes whose `default_days` include `day`, plus any route with a visit on site, so nothing
 * live is hidden. `default_days` is the only day signal: a visit is keyed to a week, not a day.
 */
export function routesRunningToday(
  week: ScheduleWeek | undefined,
  day: string,
  order: (groupKey: string, rows: SchedulePropertyRow[]) => SchedulePropertyRow[] = (_, rows) => rows,
): { running: RunningRoute[]; otherCount: number } {
  if (!week) return { running: [], otherCount: 0 }
  const groups: Array<{ key: string; routeGroup: RouteGroup | null; rows: SchedulePropertyRow[] }> = [
    ...week.routeGroups.map(({ routeGroup, rows }) => ({ key: routeGroup.id, routeGroup, rows })),
    ...(week.ungrouped.length > 0
      ? [{ key: UNGROUPED_SORT_KEY, routeGroup: null, rows: week.ungrouped }]
      : []),
  ]

  const running: RunningRoute[] = []
  let otherCount = 0
  for (const group of groups) {
    const rows = order(group.key, group.rows)
    const now = rows.filter((row) => row.visit && isVisitInProgress(row.visit))
    const scheduledToday = group.routeGroup?.default_days?.includes(day) ?? false
    if (!scheduledToday && now.length === 0) {
      if (group.routeGroup) otherCount += 1
      continue
    }
    const next =
      rows.find((row) => row.visit?.status === 'scheduled' && !row.visit.started_at) ?? null
    running.push({ ...group, rows, now, next })
  }
  return { running, otherCount }
}

/** What a route's scheduled stops are set to this week — the Crew and Truck sheets start here. */
export type RouteAssignment = {
  /** Stops the sheets will change: scheduled, not done or skipped. */
  scheduledCount: number
  /** Everyone assigned to any scheduled stop. */
  crewIds: string[]
  crewMixed: boolean
  /** The shared truck, or null when none is set or the stops differ (see vehicleMixed). */
  vehicleId: string | null
  vehicleMixed: boolean
}

export function routeAssignment(visits: Array<VisitWithCrew | null>): RouteAssignment {
  const scheduled = visits.filter((v): v is VisitWithCrew => v?.status === 'scheduled')
  const crewSets = scheduled.map((v) =>
    v.visit_crew
      .filter((vc) => vc.relation === 'assigned')
      .map((vc) => vc.employee_id)
      .sort()
      .join(','),
  )
  const vehicleIds = new Set(scheduled.map((v) => v.vehicle_id))
  const crewIds = new Set(crewSets.flatMap((s) => (s ? s.split(',') : [])))
  return {
    scheduledCount: scheduled.length,
    crewIds: [...crewIds],
    crewMixed: new Set(crewSets).size > 1,
    vehicleId: vehicleIds.size === 1 ? [...vehicleIds][0] : null,
    vehicleMixed: vehicleIds.size > 1,
  }
}
