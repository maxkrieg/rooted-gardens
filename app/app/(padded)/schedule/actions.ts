'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { toUserMessage } from '@/lib/errors'

type Supabase = Awaited<ReturnType<typeof createClient>>
type Result = { error?: string; count?: number }

/** The route's still-scheduled visits that week. Done and skipped stops keep their history. */
async function scheduledRouteVisitIds(
  supabase: Supabase,
  routeGroupId: string,
  weekStart: string,
  tag: string,
): Promise<{ ids: string[] } | { error: string }> {
  const { data: prgs, error: prgsError } = await supabase
    .from('property_route_groups')
    .select('property_id')
    .eq('route_group_id', routeGroupId)
  if (prgsError) return { error: toUserMessage(prgsError, 'Could not update the route.', tag) }

  const propertyIds = (prgs ?? []).map((r) => r.property_id)
  if (propertyIds.length === 0) return { ids: [] }

  const { data: visits, error: visitsError } = await supabase
    .from('visits')
    .select('id')
    .eq('week_start', weekStart)
    .eq('status', 'scheduled')
    .in('property_id', propertyIds)
  if (visitsError) return { error: toUserMessage(visitsError, 'Could not update the route.', tag) }

  return { ids: (visits ?? []).map((v) => v.id) }
}

/**
 * Sets the assigned crew on every scheduled stop of a route for one week. Leaves the truck alone.
 * Server-side because its delete-then-insert can't be replayed safely from the queue.
 */
export async function assignRouteCrew(
  routeGroupId: string,
  weekStart: string,
  employeeIds: string[],
): Promise<Result> {
  const tag = '[assignRouteCrew]'
  const supabase = await createClient()
  const found = await scheduledRouteVisitIds(supabase, routeGroupId, weekStart, tag)
  if ('error' in found) return found
  const visitIds = found.ids
  if (visitIds.length === 0) return { count: 0 }

  const { error: deleteError } = await supabase
    .from('visit_crew')
    .delete()
    .in('visit_id', visitIds)
    .eq('relation', 'assigned')
  if (deleteError) return { error: toUserMessage(deleteError, 'Could not assign the crew.', tag) }

  if (employeeIds.length > 0) {
    const rows = visitIds.flatMap((visitId) =>
      employeeIds.map((empId) => ({
        visit_id: visitId,
        employee_id: empId,
        relation: 'assigned' as const,
      })),
    )
    const { error: insertError } = await supabase.from('visit_crew').insert(rows)
    if (insertError) return { error: toUserMessage(insertError, 'Could not assign the crew.', tag) }
  }

  revalidatePath('/app/schedule')
  return { count: visitIds.length }
}

/** Sets the truck on every scheduled stop of a route for one week. Leaves the crew alone. */
export async function assignRouteVehicle(
  routeGroupId: string,
  weekStart: string,
  vehicleId: string | null,
): Promise<Result> {
  const tag = '[assignRouteVehicle]'
  const supabase = await createClient()
  const found = await scheduledRouteVisitIds(supabase, routeGroupId, weekStart, tag)
  if ('error' in found) return found
  const visitIds = found.ids
  if (visitIds.length === 0) return { count: 0 }

  const { error } = await supabase.from('visits').update({ vehicle_id: vehicleId }).in('id', visitIds)
  if (error) return { error: toUserMessage(error, 'Could not set the truck.', tag) }

  revalidatePath('/app/schedule')
  return { count: visitIds.length }
}
