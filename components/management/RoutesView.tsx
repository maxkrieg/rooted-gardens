'use client'

import { useMemo } from 'react'
import { Route, Check } from 'lucide-react'
import { RouteGroupCard } from '@/components/management/RouteGroupCard'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { UnroutedPanel } from '@/components/management/UnroutedPanel'
import { CachedNotice } from '@/components/states/CachedNotice'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { useRoutesData } from '@/hooks/useRoutes'
import { useScheduleReference } from '@/hooks/useManagementSchedule'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { useActiveVehicles } from '@/hooks/crew/useActiveVehicles'
import { useIsHydrated } from '@/hooks/use-hydrated'
import type { PropertyWithAccount } from '@/types/app'

/** Client-first routes page — readable in the field, and every write repaints
 *  from the cache rather than waiting on an RSC refresh. */
export function RoutesView() {
  const hydrated = useIsHydrated()
  const { data, isLoading, isError, isStale, hasData } = useRoutesData()
  // The route defaults live on the schedule's reference query, which the routes
  // page shares — no extra fetch, and it's already persisted for offline.
  const { data: reference } = useScheduleReference()
  const { data: employees = [] } = useActiveEmployees()
  const { data: vehicles = [] } = useActiveVehicles()
  const defaultCrew = reference?.defaultCrew ?? []

  const routeGroups = useMemo(() => data?.routeGroups ?? [], [data])
  const allProperties = useMemo(() => data?.allProperties ?? [], [data])
  const unrouted = useMemo(
    () => allProperties.filter((p) => !p.currentRouteGroup),
    [allProperties],
  )

  if (!hydrated || (isLoading && !hasData)) return <RoutesSkeleton />
  if (isError && !hasData) {
    return (
      <ErrorState
        title="Route assignments didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

  const routedCount = allProperties.length - unrouted.length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Route className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Routes</h1>
        </div>
        <RouteGroupSheet />
      </div>

      {isStale && <CachedNotice />}

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
          Geographic clusters that organize properties into daily crew routes. Each property
          belongs to one route group at a time.
        </p>
      </div>

      <UnroutedPanel properties={unrouted} routeGroups={routeGroups} />

      {routeGroups.length === 0 ? (
        <EmptyState
          variant="seed"
          title="No route groups yet"
          hint="Create one to start organizing your properties into daily crew routes."
          action={<RouteGroupSheet />}
        />
      ) : (
        <div className="space-y-4 pb-8">
          {routeGroups.map((group, idx) => {
            // Drive order, not alphabetical: assignedIdsByGroup arrives sorted by
            // sort_order, so mapping through it preserves the route's own order.
            // Sorting by account name here would hide every reorder made below.
            const byId = new Map(allProperties.map((p) => [p.id, p]))
            const assignedProperties = (data?.assignedIdsByGroup[group.id] ?? [])
              .map((id) => byId.get(id))
              .filter((p): p is PropertyWithAccount => !!p)

            const crewForGroup = defaultCrew.filter((c) => c.route_group_id === group.id)

            return (
              <RouteGroupCard
                key={group.id}
                routeGroup={group}
                assignedProperties={assignedProperties}
                allProperties={allProperties}
                sortOrderByPropertyId={data?.sortOrderByPropertyId ?? {}}
                defaultCrewIds={crewForGroup.map((c) => c.employee_id)}
                defaultCrewNames={crewForGroup
                  .map((c) => c.employee?.name)
                  .filter((n): n is string => !!n)}
                defaultVehicleName={
                  vehicles.find((v) => v.id === group.default_vehicle_id)?.name ?? null
                }
                employees={employees}
                vehicles={vehicles}
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

function RoutesSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeaderSkeleton />
      <CardListSkeleton rows={5} height="h-28" />
    </div>
  )
}
