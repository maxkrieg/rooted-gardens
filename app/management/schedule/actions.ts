'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildScheduleWeek, type ScheduleAssignment } from '@/lib/utils/schedule'
import type { Account, Property, RouteGroup, ScheduleWeek, VisitWithCrew } from '@/types/app'
import { toUserMessage } from '@/lib/errors'

export async function getScheduleForWeek(weekStart: string): Promise<ScheduleWeek> {
  const supabase = await createClient()

  const [routeGroupsResult, assignmentsResult, visitsResult, propertiesResult] = await Promise.all([
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
      .select(`*, visit_crew(*, employee:employees(*)), invoice:invoices(status, qbo_invoice_id)`)
      .eq('week_start', weekStart),
    // Every property, so ones with no property_route_groups row can be
    // surfaced as the schedule's "Not on a route" bucket instead of being
    // silently dropped (buildScheduleWeek used to only iterate route groups).
    supabase.from('properties').select('*, account:accounts(*)'),
  ])

  // Throw rather than return: the page fetches four weeks in parallel and a
  // partial window would be a misleading schedule, so management/error.tsx
  // catches it. Sanitized first — Next surfaces the message verbatim in dev.
  const readError =
    routeGroupsResult.error ?? assignmentsResult.error ?? visitsResult.error ?? propertiesResult.error
  if (readError) {
    throw new Error(
      toUserMessage(readError, "The schedule didn't load.", '[getScheduleForWeek]'),
    )
  }

  const routeGroups = routeGroupsResult.data as RouteGroup[]
  const assignments = (assignmentsResult.data ?? []) as unknown as ScheduleAssignment[]
  const visits = (visitsResult.data ?? []) as unknown as VisitWithCrew[]
  const allProperties = (propertiesResult.data ?? []) as unknown as Array<
    Property & { account: Account }
  >

  const assignedPropertyIds = new Set(assignments.map((a) => a.property_id))
  const ungroupedProperties = allProperties.filter((p) => !assignedPropertyIds.has(p.id))

  return buildScheduleWeek(weekStart, routeGroups, assignments, visits, ungroupedProperties)
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
    return { error: toUserMessage(error, 'Could not add the stop.', '[createVisit]') }
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

  revalidatePath('/management/schedule')
  return { count: visitIds.length }
}
