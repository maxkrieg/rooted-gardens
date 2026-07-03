import { Route } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { RouteGroupCard } from '@/components/management/RouteGroupCard'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import type { Property, PropertyWithAccount, RouteGroup } from '@/types/app'

/**
 * Route Groups management page.
 * Server Component — fetches route_groups, property_route_groups, and properties
 * in three targeted queries (the same merge-in-JS pattern as the accounts page).
 */
export default async function RouteGroupsPage() {
  const supabase = await createClient()

  // ── 1. Route groups ordered by sort_order ────────────────────────────────
  const { data: groupsData, error: groupsError } = await supabase
    .from('route_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (groupsError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Could not load route groups — try refreshing.
      </div>
    )
  }

  const routeGroups = (groupsData ?? []) as RouteGroup[]

  // ── 2. All property_route_group assignments ────────────────────────────
  const { data: assignmentsData } = await supabase
    .from('property_route_groups')
    .select('property_id, route_group_id')

  // Build a map: route_group_id → Set<property_id>
  const assignmentMap = new Map<string, Set<string>>()
  for (const row of assignmentsData ?? []) {
    const existing = assignmentMap.get(row.route_group_id)
    if (existing) {
      existing.add(row.property_id)
    } else {
      assignmentMap.set(row.route_group_id, new Set([row.property_id]))
    }
  }

  // Reverse lookup — which route group (if any) each property currently
  // belongs to, so the Assign Properties sheet can lock properties that are
  // already assigned elsewhere. Built from data already fetched above.
  const routeGroupNameById = new Map(routeGroups.map((g) => [g.id, g.name]))
  const propertyGroupMap = new Map<string, { id: string; name: string }>()
  for (const row of assignmentsData ?? []) {
    const name = routeGroupNameById.get(row.route_group_id)
    if (name) propertyGroupMap.set(row.property_id, { id: row.route_group_id, name })
  }

  // ── 3. All properties with their account name ─────────────────────────
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('*, accounts(name)')
    .order('address', { ascending: true })

  const allProperties: PropertyWithAccount[] = (propertiesData ?? []).map((row) => {
    const { accounts: accountData, ...property } = row as typeof row & {
      accounts: { name: string } | null
    }
    return {
      ...(property as Property),
      accountName: accountData?.name ?? '—',
      currentRouteGroup: propertyGroupMap.get(property.id) ?? null,
    }
  })

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Route className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Route Groups</h1>
        </div>
        <RouteGroupSheet />
      </div>

      <p className="text-sm text-muted-foreground -mt-2">
        Geographic clusters that organize properties into daily crew routes.
        Each property belongs to one route group at a time.
      </p>

      {/* Route group cards */}
      {routeGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Route className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground mb-1">No route groups yet.</p>
          <p className="text-xs text-muted-foreground">
            Create one to start organizing your properties into routes.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          {routeGroups.map((group, idx) => {
            const assignedIds = assignmentMap.get(group.id) ?? new Set<string>()
            const assignedProperties = allProperties.filter((p) => assignedIds.has(p.id))

            return (
              <RouteGroupCard
                key={group.id}
                routeGroup={group}
                assignedProperties={assignedProperties}
                allProperties={allProperties}
                isFirst={idx === 0}
                isLast={idx === routeGroups.length - 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
