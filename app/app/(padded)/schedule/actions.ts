'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { toUserMessage } from '@/lib/errors'

/**
 * The last Server Action on this page. getScheduleForWeek and createVisit moved
 * client-side (hooks/useManagementSchedule, hooks/useCreateVisit) so the schedule
 * works offline; this one stays server-side because its delete-then-insert can't
 * be replayed safely from the queue.
 */
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
    return { error: toUserMessage(prgsError, 'Could not assign the route.', '[bulkAssignRoute]') }
  }

  const propertyIds = (prgs ?? []).map((r) => r.property_id)
  if (propertyIds.length === 0) return { count: 0 }

  const { data: visits, error: visitsError } = await supabase
    .from('visits')
    .select('id')
    .eq('week_start', weekStart)
    .in('property_id', propertyIds)

  if (visitsError) {
    return { error: toUserMessage(visitsError, 'Could not assign the route.', '[bulkAssignRoute]') }
  }

  const visitIds = (visits ?? []).map((v) => v.id)
  if (visitIds.length === 0) return { count: 0 }

  const [updateResult, deleteResult] = await Promise.all([
    supabase.from('visits').update({ vehicle_id: vehicleId }).in('id', visitIds),
    supabase.from('visit_crew').delete().in('visit_id', visitIds).eq('relation', 'assigned'),
  ])

  if (updateResult.error) {
    return { error: toUserMessage(updateResult.error, 'Could not assign the route.', '[bulkAssignRoute]') }
  }
  if (deleteResult.error) {
    return { error: toUserMessage(deleteResult.error, 'Could not assign the route.', '[bulkAssignRoute]') }
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
      return { error: toUserMessage(insertError, 'Could not assign the route.', '[bulkAssignRoute]') }
    }
  }

  revalidatePath('/app/schedule')
  return { count: visitIds.length }
}
