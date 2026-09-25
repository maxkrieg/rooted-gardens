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

/** Move a route group up or down by swapping sort_order with its neighbor. */
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

/** Delete a route group; its property_route_groups rows cascade. */
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
 * Assign a property to a route group. One route per property, so this upsert moves it if it's
 * already elsewhere (the sheet confirms first).
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

/** Bulk assign for the Unrouted panel. Same upsert, so it also moves already-routed ids. */
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

type RouteGroupDefaults = {
  vehicleId: string | null
  days: string[]
  crewIds: string[]
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Set a route group's default crew, truck and days, which a generated week pre-fills from.
 * A Server Action (it replaces join rows atomically); callers must invalidate schedule-reference.
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

  // Delete-then-insert could clobber a concurrent edit; acceptable for seasonal config.
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
