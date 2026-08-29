'use client'

import { useState } from 'react'
import { Building2, ChevronsUpDown, MoreHorizontal, Trash2, Truck, X } from 'lucide-react'
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
import { useReorderRouteProperties, moveToGap } from '@/hooks/useReorderRouteProperties'
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
  // Index of the property picked up and waiting for a destination.
  const [lifted, setLifted] = useState<number | null>(null)
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
                          <FrequencyBadge frequency={property.frequency} />
                        </span>
                      </div>
                    </div>

                    {/* Tap to lift, tap a gap to place. Chevrons cost one tap per
                        position — moving a stop three places was three precise
                        taps on a 20px target — and this is two taps at any
                        distance. Still not drag: the repo has no gesture
                        infrastructure, and a drag inside a scrolling page is the
                        case that actually needs it. */}
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
 * A tappable landing strip between two rows, shown only while something is
 * lifted.
 *
 * Carries an explicit "Move here" pill rather than just a rule. A dashed line on
 * its own reads as a divider — the first version used `border-primary/40`, which
 * on warm paper is a grey hairline indistinguishable from the row separators,
 * and it was reported as "not showing" even though it was rendering.
 *
 * 36px tall and full width: you tap roughly between two rows, no aiming.
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
