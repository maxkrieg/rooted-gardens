'use client'

import { useState, useCallback } from 'react'
import { Building2, ChevronsUpDown, MoreHorizontal, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/states/EmptyState'
import { CadenceBadge } from '@/components/management/badges'
import { usePropertyLastVisit } from '@/hooks/usePropertyLastVisit'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { PropertyAssignmentSheet } from '@/components/management/PropertyAssignmentSheet'
import { deleteRouteGroup, moveRouteGroup } from '@/app/app/(padded)/routes/actions'
import { useRefreshRoutes, routesDataKey } from '@/hooks/useRoutes'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { emitTourEvent } from '@/lib/onboarding/events'
import { RouteDefaultsSheet } from '@/components/management/RouteDefaultsSheet'
import { formatDays } from '@/components/management/RouteGroupBand'
import type { Employee, RouteGroup, PropertyWithAccount, Vehicle } from '@/types/app'
import { useQueryClient } from '@tanstack/react-query'
import { useAssignPropertyRoute } from '@/hooks/useAssignPropertyRoute'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import type { RoutesData } from '@/lib/routes/fetch'
import type { ScheduleReference } from '@/lib/schedule/fetch'

interface RouteGroupCardProps {
  routeGroup: RouteGroup
  /** Already in drive order — assignedIdsByGroup is sorted by sort_order. */
  assignedProperties: PropertyWithAccount[]
  allProperties: PropertyWithAccount[]
  sortOrderByPropertyId: Record<string, number>
  defaultCrewIds: string[]
  defaultCrewNames: string[]
  defaultVehicleName: string | null
  employees: Employee[]
  vehicles: Vehicle[]
  isFirst: boolean
  isLast: boolean
}

export function RouteGroupCard({
  routeGroup,
  assignedProperties,
  allProperties,
  sortOrderByPropertyId,
  defaultCrewIds,
  defaultCrewNames,
  defaultVehicleName,
  employees,
  vehicles,
  isFirst,
  isLast,
}: RouteGroupCardProps) {
  const { data: lastVisitByProperty } = usePropertyLastVisit()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  // Index of the property picked up and waiting for a destination.
  const [lifted, setLifted] = useState<number | null>(null)
  const reorder = useReorderRouteProperties()
  // Own busy flag: a shared transition pending flag could stick and disable the whole card.
  const [busy, setBusy] = useState(false)
  const refreshRoutes = useRefreshRoutes()

  async function handleMove(direction: 'up' | 'down') {
    setBusy(true)
    try {
      const res = await moveRouteGroup(routeGroup.id, direction)
      if (res.error) toast.error('Could not reorder route group', { description: res.error })
      else refreshRoutes()
    } catch (err) {
      toast.error('Could not reorder route group', {
        description: toUserMessage(err, 'Try again.', '[RouteGroupCard.move]'),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleMoveToGap(from: number, gap: number) {
    const ordered = moveToGap(assignedProperties, from, gap)
    setLifted(null)
    if (ordered === assignedProperties) return
    setBusy(true)
    try {
      await reorder(
        routeGroup.id,
        ordered.map((p) => p.id),
        sortOrderByPropertyId,
        Object.fromEntries(ordered.map((p) => [p.id, p.address])),
      )
    } catch (err) {
      toast.error('Could not reorder the stops', {
        description: toUserMessage(err, 'The change is queued and will retry.', '[RouteGroupCard.reorderStop]'),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      const res = await deleteRouteGroup(routeGroup.id)
      if (res.error) {
        toast.error('Could not delete route group', { description: res.error })
        setConfirmDelete(false)
        return
      }
      // The cache refresh removes the card; revalidatePath can't reach this client-first page.
      refreshRoutes()
    } catch (err) {
      toast.error('Could not delete route group', {
        description: toUserMessage(err, 'Try again.', '[RouteGroupCard.delete]'),
      })
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-tour="routes.card" className="rounded-2xl border border-border shadow-warm">
      <CardHeader className="px-4 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          {/* Name + count */}
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-foreground leading-tight truncate">
              {routeGroup.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {assignedProperties.length}{' '}
              {assignedProperties.length === 1 ? 'property' : 'properties'}
            </p>
          </div>

          {/* Rename and overflow travel together at the right edge — as three
              justify-between children the pencil landed mid-row. */}
          <div className="flex shrink-0 items-center gap-0.5">
          <RouteGroupSheet routeGroup={routeGroup} />

          {/* One overflow menu so the title stays readable on a phone. */}
          <Popover
            open={menuOpen}
            onOpenChange={(next) => {
              setMenuOpen(next)
              if (next) emitTourEvent('routes.groupMenuOpened')
            }}
          >
            <PopoverTrigger asChild>
              <Button
                data-tour="routes.groupMenu"
                variant="ghost"
                size="icon"
                className="-mr-1 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${routeGroup.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1" data-tour="routes.groupMenuContent">
              <MenuButton
                label="Move up"
                disabled={isFirst || busy}
                onClick={() => {
                  setMenuOpen(false)
                  void handleMove('up')
                }}
              />
              <MenuButton
                label="Move down"
                disabled={isLast || busy}
                onClick={() => {
                  setMenuOpen(false)
                  void handleMove('down')
                }}
              />
              <MenuButton
                label="Route defaults…"
                onClick={() => {
                  setMenuOpen(false)
                  setDefaultsOpen(true)
                }}
              />
              <div className="my-1 h-px bg-border" />
              <MenuButton
                label={confirmDelete ? 'Confirm delete' : 'Delete route'}
                destructive
                disabled={busy}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    return
                  }
                  setMenuOpen(false)
                  void handleDelete()
                }}
              />
            </PopoverContent>
          </Popover>
          </div>
        </div>

        {/* The standing plan, as a line rather than a hidden sheet — days,
            truck and regulars are what distinguish one route from another. */}
        <RouteDefaultsSummary
          days={routeGroup.default_days ?? []}
          vehicleName={defaultVehicleName}
          crewNames={defaultCrewNames}
          onEdit={() => setDefaultsOpen(true)}
        />
      </CardHeader>

      <CardContent className="px-4 pb-3" data-tour="routes.stops">
        {/* Assigned properties list */}
        {assignedProperties.length === 0 ? (
          // The card already has its own "Assign" control, so stay compact.
          <EmptyState
            compact
            title="No properties assigned"
            hint="Assign properties to put this group on the schedule."
            className="mb-3"
          />
        ) : (
          <>
            {lifted !== null && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-accent-foreground">
                {/* Two lines: the instruction is what teaches the interaction,
                    and on one line the property name truncated it away. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">
                    Moving{' '}
                    <strong className="font-semibold">
                      {assignedProperties[lifted]?.accountName}
                    </strong>
                  </span>
                  <span className="block text-[11px] text-accent-foreground/75">
                    Tap a “Move here” spot
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setLifted(null)}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium hover:bg-accent-foreground/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Cancel
                </button>
              </div>
            )}

            <ul className={cn('mb-3', lifted === null && 'divide-y divide-border/40')}>
              {assignedProperties.map((property, index) => (
                <li key={property.id}>
                  <DropGap
                    show={lifted !== null && lifted !== index && lifted !== index - 1}
                    disabled={busy}
                    onClick={() => void handleMoveToGap(lifted!, index)}
                    label={`Move here, before ${property.address}`}
                  />

                  <div
                    className={cn(
                      'flex items-center gap-2 py-1.5',
                      lifted === index && 'rounded-lg bg-accent px-2 ring-1 ring-primary/40',
                      lifted !== null && lifted !== index && 'opacity-55',
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {/* Account first, address below — mirrors the schedule grid's
                        label column so owners can toggle between the two pages. */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold leading-tight text-foreground">
                        {property.accountName}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs leading-tight text-muted-foreground">
                          {property.address}
                        </span>
                        <span className="shrink-0">
                          <CadenceBadge
                            property={property}
                            lastVisitOn={lastVisitByProperty?.[property.id] ?? null}
                            showDays
                          />
                        </span>
                      </div>
                    </div>

                    {/* Tap to lift, tap a gap to place: two taps at any distance, no drag
                       infrastructure needed. */}
                    {assignedProperties.length > 1 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setLifted(lifted === index ? null : index)}
                        aria-label={
                          lifted === index
                            ? `Cancel moving ${property.address}`
                            : `Move ${property.address} within the route`
                        }
                        aria-pressed={lifted === index}
                        className={cn(
                          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          'transition-colors disabled:pointer-events-none disabled:opacity-30',
                          lifted === index
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}

              {/* The final gap — "move to the end". */}
              <li>
                <DropGap
                  show={lifted !== null && lifted !== assignedProperties.length - 1}
                  disabled={busy}
                  onClick={() => void handleMoveToGap(lifted!, assignedProperties.length)}
                  label="Move to the end of the route"
                />
              </li>
            </ul>
          </>
        )}

        {/* Manage properties trigger */}
        <PropertyAssignmentSheet
          routeGroupId={routeGroup.id}
          routeGroupName={routeGroup.name}
          allProperties={allProperties}
        />
      </CardContent>

      <RouteDefaultsSheet
        open={defaultsOpen}
        onOpenChange={setDefaultsOpen}
        routeGroup={routeGroup}
        employees={employees}
        vehicles={vehicles}
        currentCrewIds={defaultCrewIds}
      />
    </Card>
  )
}

/**
 * A tap target between rows while something is lifted. The explicit pill matters: a bare
 * dashed line read as a row divider.
 */
function DropGap({
  show,
  disabled,
  onClick,
  label,
}: {
  show: boolean
  disabled: boolean
  onClick: () => void
  label: string
}) {
  if (!show) return null
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="group relative flex h-9 w-full items-center justify-center disabled:pointer-events-none disabled:opacity-40"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-primary/70 transition-colors group-active:border-primary"
      />
      {/* Sits on bg-card so it masks the rule behind it. */}
      <span className="relative rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/30 transition-colors group-active:bg-primary group-active:text-primary-foreground">
        Move here
      </span>
    </button>
  )
}

function MenuButton({
  label,
  onClick,
  disabled,
  destructive,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-40',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-secondary',
      )}
    >
      {label}
    </button>
  )
}

/** The standing plan in one line. Empty reads as an invitation, not a blank. */
function RouteDefaultsSummary({
  days,
  vehicleName,
  crewNames,
  onEdit,
}: {
  days: string[]
  vehicleName: string | null
  crewNames: string[]
  onEdit: () => void
}) {
  const isEmpty = days.length === 0 && !vehicleName && crewNames.length === 0

  return (
    <button
      data-tour="routes.defaults"
      type="button"
      onClick={onEdit}
      className="mt-1 flex min-h-7 w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {isEmpty ? (
        <span className="text-[var(--clay)]">Set crew, truck and days →</span>
      ) : (
        <>
          {days.length > 0 && <span className="font-medium">{formatDays(days)}</span>}
          {vehicleName && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3 shrink-0" aria-hidden />
              {vehicleName}
            </span>
          )}
          {crewNames.length > 0 && <span className="truncate">{crewNames.join(', ')}</span>}
        </>
      )}
    </button>
  )
}

/**
 * Reorder a property within its route (sort_order = drive order). The batch owns its optimistic
 * state and writes `silent`, or a mid-flight refetch bounces the row. Only moved rows are written.
 */
function useReorderRouteProperties() {
  const assign = useAssignPropertyRoute()
  const queryClient = useQueryClient()

  return useCallback(
    async (
      routeGroupId: string,
      orderedPropertyIds: string[],
      currentSortOrders: Record<string, number>,
      labelByPropertyId: Record<string, string> = {},
    ) => {
      // One patch for the whole new order, before anything is written.
      queryClient.setQueryData<RoutesData>(routesDataKey, (old) =>
        old
          ? {
              ...old,
              assignedIdsByGroup: {
                ...old.assignedIdsByGroup,
                [routeGroupId]: orderedPropertyIds,
              },
              sortOrderByPropertyId: {
                ...old.sortOrderByPropertyId,
                ...Object.fromEntries(orderedPropertyIds.map((id, i) => [id, i])),
              },
            }
          : old,
      )

      // The schedule sorts its rows by the same column, so it has to move too —
      // and offline this patch is the only thing that will ever move it.
      const positions = new Map(orderedPropertyIds.map((id, i) => [id, i]))
      queryClient.setQueryData<ScheduleReference>(scheduleReferenceKey, (old) =>
        old
          ? {
              ...old,
              assignments: old.assignments.map((a) =>
                positions.has(a.property_id)
                  ? { ...a, sort_order: positions.get(a.property_id)! }
                  : a,
              ),
            }
          : old,
      )

      try {
        for (const [index, propertyId] of orderedPropertyIds.entries()) {
          if (currentSortOrders[propertyId] === index) continue
          await assign.mutateAsync({
            propertyId,
            routeGroupId,
            sortOrder: index,
            label: labelByPropertyId[propertyId],
            silent: true,
          })
        }
      } finally {
        // Once, after the batch. Online this reconciles; offline it's a no-op
        // and the patches above stand on their own.
        queryClient.invalidateQueries({ queryKey: routesDataKey })
        queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
        queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
      }
    },
    [assign, queryClient],
  )
}

/**
 * Move the item at `from` into gap `gap` (before the item at that index; 0…length). Returns the
 * same array for a no-op.
 */
function moveToGap<T>(items: T[], from: number, gap: number): T[] {
  if (gap === from || gap === from + 1) return items
  if (from < 0 || from >= items.length || gap < 0 || gap > items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(gap > from ? gap - 1 : gap, 0, item)
  return next
}
