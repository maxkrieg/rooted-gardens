'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildScheduleWeek, type ScheduleAssignment } from '@/lib/utils/schedule'
import type { RouteGroup, ScheduleWeek, VisitWithCrew } from '@/types/app'

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
        account:accounts(*)
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
  const assignments = (assignmentsResult.data ?? []) as unknown as ScheduleAssignment[]
  const visits = (visitsResult.data ?? []) as unknown as VisitWithCrew[]

  return buildScheduleWeek(weekStart, routeGroups, assignments, visits)
}

export async function createVisit(
  propertyId: string,
  weekStart: string,
  accountId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('visits').insert({
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

export async function bulkAssignRoute(
  routeGroupId: string,
  weekStart: string,
  employeeIds: string[],
  vehicleId: string | null,
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient()

  const { data: prgs, error: prgsError } = await supabase
    .from('property_route_groups')
    .select('property_id')
    .eq('route_group_id', routeGroupId)

  if (prgsError) {
    console.error('[bulkAssignRoute:prgs]', prgsError)
    return { error: prgsError.message }
  }

  const propertyIds = (prgs ?? []).map((r) => r.property_id)
  if (propertyIds.length === 0) return { count: 0 }

  const { data: visits, error: visitsError } = await supabase
    .from('visits')
    .select('id')
    .eq('week_start', weekStart)
    .in('property_id', propertyIds)

  if (visitsError) {
    console.error('[bulkAssignRoute:visits]', visitsError)
    return { error: visitsError.message }
  }

  const visitIds = (visits ?? []).map((v) => v.id)
  if (visitIds.length === 0) return { count: 0 }

  const [updateResult, deleteResult] = await Promise.all([
    supabase.from('visits').update({ vehicle_id: vehicleId }).in('id', visitIds),
    supabase.from('visit_crew').delete().in('visit_id', visitIds).eq('relation', 'assigned'),
  ])

  if (updateResult.error) {
    console.error('[bulkAssignRoute:update]', updateResult.error)
    return { error: updateResult.error.message }
  }
  if (deleteResult.error) {
    console.error('[bulkAssignRoute:delete]', deleteResult.error)
    return { error: deleteResult.error.message }
  }

  if (employeeIds.length > 0) {
    const rows = visitIds.flatMap((visitId) =>
      employeeIds.map((empId) => ({
        visit_id: visitId,
        employee_id: empId,
        relation: 'assigned' as const,
      }))
    )
    const { error: insertError } = await supabase.from('visit_crew').insert(rows)
    if (insertError) {
      console.error('[bulkAssignRoute:insert]', insertError)
      return { error: insertError.message }
    }
  }

  revalidatePath('/management/schedule')
  return { count: visitIds.length }
}
