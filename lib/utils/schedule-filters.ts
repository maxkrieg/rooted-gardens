import type { ScheduleWeek, SchedulePropertyRow, VisitWithCrew } from '@/types/app'

/** Schedule filter state, kept in the URL alongside `?week=` so a filtered view is shareable. */
export type ScheduleFilterValues = {
  /** 'all' | a route_groups.id */
  routeGroup: string
  /** 'all' | an accounts.id */
  account: string
  /** 'all' | an employees.id */
  crew: string
  /** 'all' | one of SCHEDULE_STATUS_FILTERS */
  status: string
}

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilterValues = {
  routeGroup: 'all',
  account: 'all',
  crew: 'all',
  status: 'all',
}

/** `unscheduled` isn't a visits.status: it's a property with no visit that week. */
export const SCHEDULE_STATUS_FILTERS = [
  'all',
  'unscheduled',
  'scheduled',
  'completed',
  'skipped',
] as const

type ScheduleStatusFilter = (typeof SCHEDULE_STATUS_FILTERS)[number]

export const SCHEDULE_STATUS_FILTER_LABELS: Record<ScheduleStatusFilter, string> = {
  all: 'All statuses',
  unscheduled: 'Unscheduled',
  scheduled: 'Scheduled',
  completed: 'Completed',
  skipped: 'Skipped',
}

/** Read the filter params off a page's searchParams, falling back to 'all'. */
export function parseScheduleFilters(sp: {
  routeGroup?: string
  account?: string
  crew?: string
  status?: string
}): ScheduleFilterValues {
  const status = SCHEDULE_STATUS_FILTERS.includes(sp.status as ScheduleStatusFilter)
    ? (sp.status as ScheduleStatusFilter)
    : 'all'
  return {
    routeGroup: sp.routeGroup || 'all',
    account: sp.account || 'all',
    crew: sp.crew || 'all',
    status,
  }
}

/** Query string for the schedule; 'all' values are omitted. */
export function scheduleFilterParams(
  filters: ScheduleFilterValues,
  week?: string
): URLSearchParams {
  const params = new URLSearchParams()
  if (week) params.set('week', week)
  if (filters.routeGroup !== 'all') params.set('routeGroup', filters.routeGroup)
  if (filters.account !== 'all') params.set('account', filters.account)
  if (filters.crew !== 'all') params.set('crew', filters.crew)
  if (filters.status !== 'all') params.set('status', filters.status)
  return params
}

export function hasActiveScheduleFilters(filters: ScheduleFilterValues): boolean {
  return activeScheduleFilterCount(filters) > 0
}

/** How many filters are narrowing the view — the phone header's badge count. */
export function activeScheduleFilterCount(filters: ScheduleFilterValues): number {
  return [filters.routeGroup, filters.account, filters.crew, filters.status].filter(
    (v) => v !== 'all',
  ).length
}

/** Does this crew member appear on the visit, either as planned or as having worked it? */
function matchesCrew(visit: VisitWithCrew | null, employeeId: string): boolean {
  if (!visit) return false
  return visit.visit_crew.some((vc) => vc.employee_id === employeeId)
}

function matchesStatus(visit: VisitWithCrew | null, status: string): boolean {
  if (status === 'unscheduled') return visit === null
  if (!visit) return false
  return visit.status === status
}

function matchesVisitFilters(row: SchedulePropertyRow, filters: ScheduleFilterValues): boolean {
  if (filters.crew !== 'all' && !matchesCrew(row.visit, filters.crew)) return false
  if (filters.status !== 'all' && !matchesStatus(row.visit, filters.status)) return false
  return true
}

/**
 * Filter a schedule window, keeping its shape. Crew/status match if ANY week in the window
 * matches; the schedule passes one week, so in practice that's exact matching.
 */
export function filterScheduleWeeks(
  weeks: ScheduleWeek[],
  filters: ScheduleFilterValues
): ScheduleWeek[] {
  // Unfiltered is passed through untouched — an empty route group is only pruned
  // when a filter emptied it, never when it simply has no properties yet.
  if (!hasActiveScheduleFilters(filters)) return weeks

  // Structural pass. A route filter excludes the ungrouped bucket; an account filter still applies.
  const structural = weeks.map((week) => ({
    weekStart: week.weekStart,
    routeGroups: week.routeGroups
      .filter((g) => filters.routeGroup === 'all' || g.routeGroup.id === filters.routeGroup)
      .map((g) => ({
        routeGroup: g.routeGroup,
        rows: g.rows.filter(
          (row) => filters.account === 'all' || row.account.id === filters.account
        ),
      })),
    ungrouped:
      filters.routeGroup === 'all'
        ? week.ungrouped.filter(
            (row) => filters.account === 'all' || row.account.id === filters.account
          )
        : [],
  }))

  const needsVisitPass = filters.crew !== 'all' || filters.status !== 'all'
  if (!needsVisitPass) {
    return structural.map((week) => ({
      ...week,
      routeGroups: week.routeGroups.filter((g) => g.rows.length > 0),
    }))
  }

  // Visit pass — a property survives if it matches in any week of the window.
  const keep = new Set<string>()
  for (const week of structural) {
    for (const { rows } of week.routeGroups) {
      for (const row of rows) {
        if (matchesVisitFilters(row, filters)) keep.add(row.property.id)
      }
    }
    for (const row of week.ungrouped) {
      if (matchesVisitFilters(row, filters)) keep.add(row.property.id)
    }
  }

  return structural.map((week) => ({
    weekStart: week.weekStart,
    routeGroups: week.routeGroups
      .map((g) => ({
        routeGroup: g.routeGroup,
        rows: g.rows.filter((row) => keep.has(row.property.id)),
      }))
      .filter((g) => g.rows.length > 0),
    ungrouped: week.ungrouped.filter((row) => keep.has(row.property.id)),
  }))
}
