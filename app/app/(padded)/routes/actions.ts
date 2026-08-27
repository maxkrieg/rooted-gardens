'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  routeGroupFormSchema,
  bulkAssignPropertiesSchema,
  type RouteGroupFormValues,
} from '@/lib/validators/routeGroup'
import { toUserMessage } from '@/lib/errors'

function revalidate() {
  revalidatePath('/app/routes')
  // Route membership changes what the schedule renders (the ungrouped
  // bucket, or which route group a property's row falls under).
  revalidatePath('/app/schedule')
}

// ─── Route group CRUD ────────────────────────────────────────────────────────

export async function createRouteGroup(
  values: RouteGroupFormValues,
): Promise<{ error?: string }> {
  const parsed = routeGroupFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()

  // Append to end by using max existing sort_order + 1
  const { data: maxRow } = await supabase
    .from('route_groups')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = maxRow ? maxRow.sort_order + 1 : 0

  const { error } = await supabase.from('route_groups').insert({
    name: parsed.data.name,
    sort_order: nextSortOrder,
  })

  if (error) {
    return { error: toUserMessage(error, 'Could not create the route group.', '[createRouteGroup]') }
  }

  revalidate()
  return {}
}

export async function updateRouteGroup(
  id: string,
  values: RouteGroupFormValues,
): Promise<{ error?: string }> {
  const parsed = routeGroupFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  // Only update name — sort_order is managed by moveRouteGroup
  const { error } = await supabase
    .from('route_groups')
    .update({ name: parsed.data.name })
    .eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not save the route group.', '[updateRouteGroup]') }
  }

  revalidate()
  return {}
}

/**
 * Move a route group up or down by swapping sort_order with its neighbor.
 * Same pattern as moveZone in property-actions.ts.
 */
export async function moveRouteGroup(
  id: string,
  direction: 'up' | 'down',
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: groups, error: fetchError } = await supabase
    .from('route_groups')
    .select('id, sort_order')
    .order('sort_order', { ascending: true })

  if (fetchError || !groups) {
    return { error: fetchError?.message ?? 'Could not load route groups' }
  }

  const idx = groups.findIndex((g) => g.id === id)
  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1

  if (idx === -1 || neighborIdx < 0 || neighborIdx >= groups.length) {
    return {} // Already at boundary — no-op
  }

  const current = groups[idx]
  const neighbor = groups[neighborIdx]

  const { error: e1 } = await supabase
    .from('route_groups')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', current.id)

  if (e1) return { error: toUserMessage(e1, 'Could not reorder the route groups.', '[moveRouteGroup]') }

  const { error: e2 } = await supabase
    .from('route_groups')
    .update({ sort_order: current.sort_order })
    .eq('id', neighbor.id)

  if (e2) return { error: toUserMessage(e2, 'Could not reorder the route groups.', '[moveRouteGroup]') }

  revalidate()
  return {}
}

/**
 * Delete a route group.
 * Assignments in property_route_groups cascade via FK ON DELETE CASCADE.
 */
export async function deleteRouteGroup(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('route_groups').delete().eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not delete the route group.', '[deleteRouteGroup]') }
  }

  revalidate()
  return {}
}

// ─── Property assignments ────────────────────────────────────────────────────

/**
 * Assign a property to a route group.
 * A property belongs to at most one route group
 * (property_route_groups_property_idx) — onConflict targets that unique index,
 * so assigning a property already in a different group *moves* it (the
 * upsert replaces the conflicting row's route_group_id) rather than erroring.
 * The Assign Properties sheet confirms with the user before calling this for
 * a property that's assigned elsewhere.
 */
export async function assignProperty(
  propertyId: string,
  routeGroupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('property_route_groups')
    .upsert(
      { property_id: propertyId, route_group_id: routeGroupId, sort_order: 0 },
      { onConflict: 'property_id' },
    )

  if (error) {
    return { error: toUserMessage(error, 'Could not assign the property.', '[assignProperty]') }
  }

  revalidate()
  return {}
}

/**
 * Assign several properties to a route group at once — the Unrouted panel's
 * "N selected → Put on a route" bulk action. Same upsert/onConflict shape as
 * assignProperty, one row per id, so it also moves any of the ids that were
 * already assigned elsewhere.
 */
export async function assignProperties(
  propertyIds: string[],
  routeGroupId: string,
): Promise<{ error?: string }> {
  const parsed = bulkAssignPropertiesSchema.safeParse({ propertyIds, routeGroupId })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid selection' }
  }

  const supabase = await createClient()

  const rows = parsed.data.propertyIds.map((propertyId) => ({
    property_id: propertyId,
    route_group_id: parsed.data.routeGroupId,
    sort_order: 0,
  }))

  const { error } = await supabase
    .from('property_route_groups')
    .upsert(rows, { onConflict: 'property_id' })

  if (error) {
    return { error: toUserMessage(error, 'Could not assign the properties.', '[assignProperties]') }
  }

  revalidate()
  return {}
}

/**
 * Remove a property from a route group.
 */
export async function unassignProperty(
  propertyId: string,
  routeGroupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('property_route_groups')
    .delete()
    .eq('property_id', propertyId)
    .eq('route_group_id', routeGroupId)

  if (error) {
    return { error: toUserMessage(error, 'Could not remove the property from this route.', '[unassignProperty]') }
  }

  revalidate()
  return {}
}

// ─── Route group defaults ────────────────────────────────────────────────────

export type RouteGroupDefaults = {
  vehicleId: string | null
  days: string[]
  crewIds: string[]
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Set a route group's default crew, truck, and days — what "Wilder - Mon/Tues"
 * has been encoding in a string on the route sheet all along. A generated week
 * (R3.5) pre-fills from these.
 *
 * A Server Action rather than a queued mutation: this is seasonal configuration
 * set once and rarely touched, not field work, and the same call has to replace
 * a set of join rows atomically. Callers must invalidate `schedule-reference`
 * themselves — the schedule is client-first, so revalidatePath alone repaints a
 * shell holding no data.
 */
export async function setRouteGroupDefaults(
  routeGroupId: string,
  defaults: RouteGroupDefaults,
): Promise<{ error?: string }> {
  if (defaults.days.some((day) => !WEEKDAYS.includes(day))) {
    return { error: 'Unrecognised day' }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('route_groups')
    .update({ default_vehicle_id: defaults.vehicleId, default_days: defaults.days })
    .eq('id', routeGroupId)

  if (updateError) {
    return { error: toUserMessage(updateError, 'Could not save the route defaults.') }
  }

  // Replace the crew set. Delete-then-insert clobbers a concurrent edit, which
  // is acceptable here and nowhere near the visit data: two owners editing the
  // same route's regulars in the same minute is not a real scenario, and the
  // whole set is visible in the sheet before saving.
  const { error: deleteError } = await supabase
    .from('route_group_default_crew')
    .delete()
    .eq('route_group_id', routeGroupId)

  if (deleteError) {
    return { error: toUserMessage(deleteError, 'Could not save the route defaults.') }
  }

  if (defaults.crewIds.length > 0) {
    const { error: insertError } = await supabase.from('route_group_default_crew').insert(
      defaults.crewIds.map((employeeId) => ({
        route_group_id: routeGroupId,
        employee_id: employeeId,
      })),
    )
    if (insertError) {
      return { error: toUserMessage(insertError, 'Could not save the route defaults.') }
    }
  }

  revalidate()
  return {}
}
