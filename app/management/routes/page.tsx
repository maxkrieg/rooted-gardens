import { Route, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { RouteGroupCard } from '@/components/management/RouteGroupCard'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { UnroutedPanel } from '@/components/management/UnroutedPanel'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import type { Property, PropertyWithAccount, RouteGroup } from '@/types/app'

/**
 * Routes management page.
 * Server Component — fetches route_groups, property_route_groups, and properties
 * in three targeted queries (the same merge-in-JS pattern as the accounts page).
 */
export default async function RoutesPage() {
  const supabase = await createClient()

  // ── 1. Route groups ordered by sort_order ────────────────────────────────
  const { data: groupsData, error: groupsError } = await supabase
    .from('route_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (groupsError) {
    console.error('[routes] groups', groupsError)
    return (
      <ErrorState
        title="Route groups didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

  const routeGroups = (groupsData ?? []) as RouteGroup[]

  // ── 2. All property_route_group assignments ────────────────────────────
  const { data: assignmentsData, error: assignmentsError } = await supabase
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
  const { data: propertiesData, error: propertiesError } = await supabase
    .from('properties')
    .select('*, accounts(name)')
    .eq('is_archived', false)
    .order('address', { ascending: true })

  // Load-bearing: without either, every group renders "No properties assigned
  // yet" — a confident lie about the routes. Fail the page instead.
  if (assignmentsError || propertiesError) {
    console.error('[routes] assignments/properties', assignmentsError ?? propertiesError)
    return (
      <ErrorState
        title="Route assignments didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

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

  const unrouted = allProperties.filter((p) => !p.currentRouteGroup)
  const routedCount = allProperties.length - unrouted.length

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Route className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Routes</h1>
        </div>
        <RouteGroupSheet />
      </div>

      <div className="-mt-2 space-y-0.5">
        {allProperties.length > 0 &&
          (unrouted.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-[--sap]">
              <Check className="h-4 w-4 shrink-0" />
              Every property is on a route.
            </p>
          ) : (
            <p className="text-sm font-medium text-foreground">
              {routedCount} of {allProperties.length} properties are on a route.
            </p>
          ))}
        <p className="text-sm text-muted-foreground">
          Geographic clusters that organize properties into daily crew routes.
          Each property belongs to one route group at a time.
        </p>
      </div>

      <UnroutedPanel properties={unrouted} routeGroups={routeGroups} />

      {/* Route group cards */}
      {routeGroups.length === 0 ? (
        <EmptyState
          variant="seed"
          title="No route groups yet"
          hint="Create one to start organizing your properties into daily crew routes."
          // RouteGroupSheet renders its own "New Route Group" trigger.
          action={<RouteGroupSheet />}
        />
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
