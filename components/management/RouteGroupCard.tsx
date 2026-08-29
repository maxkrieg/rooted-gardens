'use client'

import { useState } from 'react'
import { Building2, ChevronUp, ChevronDown, MoreHorizontal, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/states/EmptyState'
import { FrequencyBadge } from '@/components/management/badges'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { PropertyAssignmentSheet } from '@/components/management/PropertyAssignmentSheet'
import { deleteRouteGroup, moveRouteGroup } from '@/app/app/(padded)/routes/actions'
import { useRefreshRoutes } from '@/hooks/useRoutes'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RouteDefaultsSheet } from '@/components/management/RouteDefaultsSheet'
import { formatDays } from '@/components/management/RouteGroupBand'
import { useReorderRouteProperties, moveInArray } from '@/hooks/useReorderRouteProperties'
import type { Employee, RouteGroup, PropertyWithAccount, Vehicle } from '@/types/app'

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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const reorder = useReorderRouteProperties()
  // Own busy flag, not a transition's pending: a shared pending flag disabled
  // every control on the card and could stay stuck true (see commit f4e09e3,
  // which fixed the same shape in the assignment sheets).
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

  async function handleReorder(index: number, direction: 'up' | 'down') {
    const ordered = moveInArray(assignedProperties, index, direction)
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
      // Refreshing the cache is what removes this card now — revalidatePath only
      // refreshes an RSC shell that no longer holds the list.
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
    <Card className="rounded-2xl border border-border shadow-warm">
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

          {/* One overflow instead of five targets crowding a truncating
              title: reorder, rename, defaults and delete are all occasional,
              and the title is what has to stay readable on a phone. */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-1 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${routeGroup.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1">
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

      <CardContent className="px-4 pb-3">
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
          <ul className="mb-3 divide-y divide-border/40">
            {assignedProperties.map((property, index) => (
              <li key={property.id} className="flex items-center gap-2 py-1.5">
                <Building2
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
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
                      <FrequencyBadge frequency={property.frequency} />
                    </span>
                  </div>
                </div>

                {/* Drive order. Chevrons, not drag-and-drop: the repo has no
                    gesture infrastructure, and dragging a list this long on a
                    phone is worse than two taps anyway.

                    Plain buttons, not <Button size="icon">: that variant carries
                    a `pointer-coarse:size-11` touch target which no className
                    can override, so the pair rendered 88px tall on a phone. */}
                {assignedProperties.length > 1 && (
                  <div className="flex shrink-0 flex-col">
                    <ReorderButton
                      direction="up"
                      disabled={index === 0 || busy}
                      onClick={() => void handleReorder(index, 'up')}
                      label={`Move ${property.address} earlier in the route`}
                    />
                    <ReorderButton
                      direction="down"
                      disabled={index === assignedProperties.length - 1 || busy}
                      onClick={() => void handleReorder(index, 'down')}
                      label={`Move ${property.address} later in the route`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
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
 * A reorder caret: small to look at, big to hit.
 *
 * The visible control stays 20px so a route of a dozen stops still reads as a
 * list, while a transparent `::before` carries the touch target out to ~40px —
 * the same trick `components/ui/checkbox.tsx` uses, and the reason it exists.
 *
 * The expansion is one-directional on purpose: up grows upward, down grows
 * downward. Growing both ways would overlap the two hit areas in the middle and
 * make the boundary a coin flip.
 */
function ReorderButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: 'up' | 'down'
  disabled: boolean
  onClick: () => void
  label: string
}) {
  const Icon = direction === 'up' ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative flex h-5 w-8 items-center justify-center rounded text-muted-foreground',
        'transition-colors hover:bg-secondary hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-25',
        "before:absolute before:content-[''] before:-inset-x-2",
        direction === 'up' ? 'before:-top-2.5 before:bottom-0' : 'before:top-0 before:-bottom-2.5',
      )}
    >
      <Icon className="h-4 w-4" />
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
