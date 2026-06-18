'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { visitUpdateSchema, type VisitUpdateValues } from '@/lib/validators/visit'
import type {
  Account,
  Property,
  RouteGroup,
  ScheduleWeek,
  ScheduleZoneRow,
  ServiceZone,
  VisitWithCrew,
} from '@/types/app'

export async function getScheduleForWeek(weekStart: string): Promise<ScheduleWeek> {
  const supabase = await createClient()

  const [routeGroupsResult, assignmentsResult, visitsResult] = await Promise.all([
    supabase.from('route_groups').select('*').order('sort_order', { ascending: true }),
    supabase.from('property_route_groups').select(`
      property_id,
      route_group_id,
      sort_order,
      property:properties(
        *,
        account:accounts(*),
        service_zones(*)
      )
    `),
    supabase
      .from('visits')
      .select(`*, visit_crew(*, employee:employees(*))`)
      .eq('week_start', weekStart),
  ])

  if (routeGroupsResult.error) throw new Error(routeGroupsResult.error.message)
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message)
  if (visitsResult.error) throw new Error(visitsResult.error.message)

  const routeGroups = routeGroupsResult.data as RouteGroup[]
  const assignments = assignmentsResult.data ?? []
  const visits = visitsResult.data ?? []

  // Build visit lookup by service_zone_id
  const visitByZoneId = new Map<string, VisitWithCrew>()
  for (const v of visits) {
    visitByZoneId.set(v.service_zone_id, v as unknown as VisitWithCrew)
  }

  const scheduleRouteGroups: ScheduleWeek['routeGroups'] = routeGroups.map((routeGroup) => {
    // Get assignments for this route group, sorted by sort_order within the group
    const groupAssignments = assignments
      .filter((a) => a.route_group_id === routeGroup.id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const rows: ScheduleZoneRow[] = []

    for (const assignment of groupAssignments) {
      const property = assignment.property as unknown as Property & {
        account: Account
        service_zones: ServiceZone[]
      }
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

export async function createVisit(
  zoneId: string,
  weekStart: string,
  accountId: string,
  propertyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('visits').insert({
    service_zone_id: zoneId,
    account_id: accountId,
    property_id: propertyId,
    week_start: weekStart,
    status: 'scheduled',
  })

  if (error) {
    console.error('[createVisit]', error)
    return { error: error.message }
  }

  revalidatePath('/management/schedule')
  return {}
}

export async function saveVisitChanges(
  visitId: string,
  values: VisitUpdateValues,
): Promise<{ error?: string }> {
  const parsed = visitUpdateSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }

  const supabase = await createClient()

  const [updateResult, crewDeleteResult] = await Promise.all([
    supabase
      .from('visits')
      .update({
        status: parsed.data.status,
        crew_instruction: parsed.data.crew_instruction ?? null,
        vehicle_id: parsed.data.vehicle_id ?? null,
      })
      .eq('id', visitId),
    supabase
      .from('visit_crew')
      .delete()
      .eq('visit_id', visitId)
      .eq('relation', 'assigned'),
  ])

  if (updateResult.error) {
    console.error('[saveVisitChanges:update]', updateResult.error)
    return { error: updateResult.error.message }
  }
  if (crewDeleteResult.error) {
    console.error('[saveVisitChanges:delete crew]', crewDeleteResult.error)
    return { error: crewDeleteResult.error.message }
  }

  if (parsed.data.assigned_crew_ids.length > 0) {
    const { error: insertError } = await supabase.from('visit_crew').insert(
      parsed.data.assigned_crew_ids.map((empId) => ({
        visit_id: visitId,
        employee_id: empId,
        relation: 'assigned' as const,
      }))
    )
    if (insertError) {
      console.error('[saveVisitChanges:insert crew]', insertError)
      return { error: insertError.message }
    }
  }

  revalidatePath('/management/schedule')
  return {}
}
