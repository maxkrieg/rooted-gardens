import { startOfWeek, addWeeks, differenceInDays, isBefore } from 'date-fns'
import type {
  Account,
  Property,
  RouteGroup,
  ScheduleWeek,
  ScheduleZoneRow,
  ServiceZone,
  VisitWithCrew,
} from '@/types/app'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
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

export function isZoneDueThisWeek(
  zone: ServiceZone,
  weekStart: Date,
  lastVisitDate?: Date | null
): boolean {
  if (!zone.active) return false
  switch (zone.frequency) {
    case 'weekly':
      return true
    case 'as_needed':
      return false
    case 'biweekly':
      if (!lastVisitDate) return true
      return differenceInDays(weekStart, lastVisitDate) >= 14
    case 'monthly':
      if (!lastVisitDate) return true
      return differenceInDays(weekStart, lastVisitDate) >= 28
    default:
      return false
  }
}

/** Raw property_route_groups row with its nested property/account/zones. */
export type ScheduleAssignment = {
  property_id: string
  route_group_id: string
  sort_order: number
  property:
    | (Property & { account: Account; service_zones: ServiceZone[] })
    | null
}

/**
 * Assembles the route group → property → zone → visit grid for a single week.
 * Pure (no I/O) so it can be reused by both the management Server Action
 * (getScheduleForWeek) and the crew client hook (useWeekSchedule).
 */
export function buildScheduleWeek(
  weekStart: string,
  routeGroups: RouteGroup[],
  assignments: ScheduleAssignment[],
  visits: VisitWithCrew[]
): ScheduleWeek {
  // Build visit lookup by service_zone_id
  const visitByZoneId = new Map<string, VisitWithCrew>()
  for (const v of visits) {
    visitByZoneId.set(v.service_zone_id, v)
  }

  const scheduleRouteGroups: ScheduleWeek['routeGroups'] = routeGroups.map((routeGroup) => {
    const groupAssignments = assignments
      .filter((a) => a.route_group_id === routeGroup.id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const rows: ScheduleZoneRow[] = []

    for (const assignment of groupAssignments) {
      const property = assignment.property
      if (!property) continue

      const account = property.account as Account
      const zones = (property.service_zones as ServiceZone[])
        .filter((z) => z.active)
        .sort((a, b) => a.sort_order - b.sort_order)

      for (const zone of zones) {
        rows.push({
          zone,
          property: { ...property, account: undefined } as unknown as Property,
          account,
          routeGroup,
          visit: visitByZoneId.get(zone.id) ?? null,
        })
      }
    }

    return { routeGroup, rows }
  })

  return { weekStart, routeGroups: scheduleRouteGroups }
}
