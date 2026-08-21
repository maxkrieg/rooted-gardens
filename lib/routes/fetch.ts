import { createClient } from '@/lib/supabase/client'
import type { Property, PropertyWithAccount, RouteGroup } from '@/types/app'

export type RoutesData = {
  routeGroups: RouteGroup[]
  /** route_group_id → property ids on it. */
  assignedIdsByGroup: Record<string, string[]>
  allProperties: PropertyWithAccount[]
}

/**
 * Everything the routes page renders, in three queries merged in JS.
 *
 * The properties select is narrowed to the six columns the UI reads — the RSC
 * version shipped every column of every property to each of N route-group cards.
 */
export async function fetchRoutesData(): Promise<RoutesData> {
  const supabase = createClient()

  const [groupsResult, assignmentsResult, propertiesResult] = await Promise.all([
    supabase
      .from('route_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('property_route_groups').select('property_id, route_group_id'),
    supabase
      .from('properties')
      .select('id, address, account_id, frequency, is_archived, accounts(name)')
      .eq('is_archived', false)
      .order('address', { ascending: true }),
  ])

  if (groupsResult.error) throw groupsResult.error
  // Load-bearing: without either, every group renders "No properties assigned
  // yet" — a confident lie about the routes. Fail rather than show it.
  if (assignmentsResult.error) throw assignmentsResult.error
  if (propertiesResult.error) throw propertiesResult.error

  const routeGroups = (groupsResult.data ?? []) as RouteGroup[]
  const assignments = assignmentsResult.data ?? []

  const assignedIdsByGroup: RoutesData['assignedIdsByGroup'] = {}
  const routeGroupNameById = new Map(routeGroups.map((g) => [g.id, g.name]))
  // Which group each property is on, so the assign sheet can show properties
  // already claimed elsewhere.
  const groupByPropertyId = new Map<string, { id: string; name: string }>()

  for (const row of assignments) {
    ;(assignedIdsByGroup[row.route_group_id] ??= []).push(row.property_id)
    const name = routeGroupNameById.get(row.route_group_id)
    if (name) groupByPropertyId.set(row.property_id, { id: row.route_group_id, name })
  }

  const allProperties: PropertyWithAccount[] = (propertiesResult.data ?? []).map((row) => {
    const { accounts: accountData, ...property } = row as typeof row & {
      accounts: { name: string } | null
    }
    return {
      ...(property as unknown as Property),
      accountName: accountData?.name ?? '—',
      currentRouteGroup: groupByPropertyId.get(property.id) ?? null,
    }
  })

  return { routeGroups, assignedIdsByGroup, allProperties }
}
