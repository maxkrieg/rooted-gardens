import { createClient } from '@/lib/supabase/client'
import type { ScheduleAssignment } from '@/lib/utils/schedule'
import type { Account, Property, RouteGroup, VisitWithCrew } from '@/types/app'

/**
 * Route groups, assignments, and properties — everything the schedule needs that
 * does NOT vary by week. The RSC version refetched all of this per week, so a
 * 4-week load pulled the whole property+account set eight times.
 */
export type ScheduleReference = {
  routeGroups: RouteGroup[]
  assignments: ScheduleAssignment[]
  ungroupedProperties: Array<Property & { account: Account }>
}

export async function fetchScheduleReference(): Promise<ScheduleReference> {
  const supabase = createClient()

  const [routeGroupsResult, assignmentsResult, propertiesResult] = await Promise.all([
    supabase.from('route_groups').select('*').order('sort_order', { ascending: true }),
    // !inner + is_archived so a soft-deleted property can't reach the grid.
    supabase
      .from('property_route_groups')
      .select(
        `property_id, route_group_id, sort_order,
         property:properties!inner(*, account:accounts(*))`,
      )
      .eq('property.is_archived', false),
    supabase.from('properties').select('*, account:accounts(*)').eq('is_archived', false),
  ])

  if (routeGroupsResult.error) throw routeGroupsResult.error
  if (assignmentsResult.error) throw assignmentsResult.error
  if (propertiesResult.error) throw propertiesResult.error

  const assignments = (assignmentsResult.data ?? []) as unknown as ScheduleAssignment[]
  const allProperties = (propertiesResult.data ?? []) as unknown as Array<
    Property & { account: Account }
  >

  // Properties on no route group get the schedule's "Not on a route" bucket
  // rather than being silently dropped.
  const assignedIds = new Set(assignments.map((a) => a.property_id))

  return {
    routeGroups: (routeGroupsResult.data ?? []) as RouteGroup[],
    assignments,
    ungroupedProperties: allProperties.filter((p) => !assignedIds.has(p.id)),
  }
}

/**
 * One week's visits. `withInvoices` is management-only — crew RLS can't read
 * `invoices`, so the embed would fail on their side.
 */
export async function fetchWeekVisits(
  weekStartISO: string,
  { withInvoices = false }: { withInvoices?: boolean } = {},
): Promise<VisitWithCrew[]> {
  const supabase = createClient()

  const select = withInvoices
    ? `*, visit_crew(*, employee:employees(*)), invoice:invoices(status, qbo_invoice_id)`
    : `*, visit_crew(*, employee:employees(*))`

  const { data, error } = await supabase
    .from('visits')
    .select(select)
    .eq('week_start', weekStartISO)
  if (error) throw error

  const visits = (data ?? []) as unknown as VisitWithCrew[]

  // Completion-photo counts drive the grid's camera indicator. Only completed
  // visits can have them, so skip the round-trip when there are none.
  const completedIds = visits.filter((v) => v.status === 'completed').map((v) => v.id)
  if (completedIds.length > 0) {
    const { data: photoRows, error: photosError } = await supabase
      .from('photos')
      .select('visit_id')
      .eq('type', 'visit')
      .in('visit_id', completedIds)
    if (photosError) throw photosError

    const countByVisitId = new Map<string, number>()
    for (const row of photoRows ?? []) {
      if (!row.visit_id) continue
      countByVisitId.set(row.visit_id, (countByVisitId.get(row.visit_id) ?? 0) + 1)
    }
    for (const visit of visits) {
      visit.photo_count = countByVisitId.get(visit.id) ?? 0
    }
  }

  return visits
}
