'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { FrequencyBadge } from '@/components/management/badges'
import { RoutePicker } from '@/components/management/RoutePicker'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { assignProperties } from '@/app/app/(padded)/routes/actions'
import { useRefreshRoutes } from '@/hooks/useRoutes'
import { useAssignPropertyRoute } from '@/hooks/useAssignPropertyRoute'
import { useOfflineStatus } from '@/hooks/crew/useOfflineStatus'
import type { PropertyWithAccount, RouteGroup } from '@/types/app'

interface UnroutedPanelProps {
  properties: PropertyWithAccount[]
  routeGroups: RouteGroup[]
}

/**
 * The staging strip for properties that belong to no route group. Pinned
 * above the route list, always visible — never behind a modal or a filter
 * toggle, unlike the old "Unassigned only" switch buried in each route
 * group's Assign Properties sheet. Returns null when there's nothing to
 * stage; the page renders the sage "all routed" tally in that case instead.
 *
 * Like the assignment sheet, this does NOT wait on the server round-trip to
 * update: a routed row leaves the list as soon as its write succeeds, and busy
 * state is tracked per row in `inFlight` rather than via the transition's
 * pending flag (which gated every row at once and could stay stuck true).
 */
export function UnroutedPanel({ properties, routeGroups }: UnroutedPanelProps) {
  const router = useRouter()
  const refreshRoutes = useRefreshRoutes()
  const assignRoute = useAssignPropertyRoute()
  const { isOnline } = useOfflineStatus()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Pending flag deliberately discarded — busy state is per row, below.
  const [, startTransition] = useTransition()
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())
  // Locally confirmed as routed — hides the row immediately instead of waiting
  // for the page to re-render.
  const [routed, setRouted] = useState<Set<string>>(new Set())

  // Fresh props are authoritative, so drop the local hiding whenever the server
  // sends a new list (React's sanctioned "adjust state during render" pattern —
  // an effect here would just cause a second render pass).
  const [propsSnapshot, setPropsSnapshot] = useState(properties)
  if (propsSnapshot !== properties) {
    setPropsSnapshot(properties)
    if (routed.size > 0) setRouted(new Set())
  }

  const sorted = useMemo(
    () =>
      [...properties]
        .filter((p) => !routed.has(p.id))
        .sort(
          (a, b) => a.accountName.localeCompare(b.accountName) || a.address.localeCompare(b.address)
        ),
    [properties, routed]
  )

  if (sorted.length === 0) return null

  function toggle(propertyId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(sorted.map((p) => p.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function routeGroupName(routeGroupId: string) {
    return routeGroups.find((rg) => rg.id === routeGroupId)?.name ?? 'the route'
  }

  function markInFlight(ids: string[], busy: boolean) {
    setInFlight((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (busy) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  function markRouted(ids: string[], isRouted: boolean) {
    setRouted((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (isRouted) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  function deselect(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  // Putting the rows back is what "Undo" means here, so it has to clear the
  // local hiding as well as reverse the write.
  // No routeGroupId needed: property_route_groups holds at most one row per
  // property, so taking one off any route is a single delete.
  async function undoAssign(ids: string[]) {
    markInFlight(ids, true)
    try {
      for (const id of ids) {
        await assignRoute.mutateAsync({ propertyId: id, routeGroupId: null })
      }
      markRouted(ids, false)
    } catch {
      toast.error('Could not undo', {
        description: 'The reversal is queued and will retry.',
      })
    } finally {
      markInFlight(ids, false)
    }
  }

  /**
   * Queued, not a Server Action: routing one property is the small correction
   * made standing in front of it, which is exactly when there's no signal.
   */
  async function handleAssignSingle(property: PropertyWithAccount, routeGroupId: string) {
    const name = routeGroupName(routeGroupId)
    markInFlight([property.id], true)
    try {
      await assignRoute.mutateAsync({
        propertyId: property.id,
        routeGroupId,
        label: property.address,
      })
      deselect([property.id])
      markRouted([property.id], true)
      toast.success(`${property.address} added to ${name}.`, {
        action: {
          label: 'Undo',
          onClick: () => undoAssign([property.id]),
        },
      })
    } catch {
      toast.error('Could not assign the property', {
        description: 'The change is queued and will retry.',
      })
    } finally {
      markInFlight([property.id], false)
    }
  }

  function handleAssignBulk(routeGroupId: string) {
    const ids = [...selected]
    if (ids.length === 0) return
    // Deliberately not queued: assignProperties is a bulk upsert that overwrites
    // whatever each property was on, so replaying it later could undo an edit
    // made in between. Single assignment above is queued and covers the field.
    if (!isOnline) {
      toast.error('Assigning several at once needs a connection', {
        description: 'One at a time still works offline.',
      })
      return
    }
    const name = routeGroupName(routeGroupId)
    markInFlight(ids, true)
    startTransition(async () => {
      try {
        const res = await assignProperties(ids, routeGroupId)
        if (res.error) {
          toast.error('Could not assign the properties', { description: res.error })
          return
        }
        deselect(ids)
        markRouted(ids, true)
        // refreshRoutes alone: router.refresh() on a client-first page is an RSC
        // fetch that adds nothing here and takes the page down when it fails.
        refreshRoutes()
        toast.success(`${ids.length} propert${ids.length === 1 ? 'y' : 'ies'} added to ${name}.`, {
          action: {
            label: 'Undo',
            onClick: () => undoAssign(ids),
          },
        })
      } catch {
        toast.error('Could not assign the properties', {
          description: 'The change did not reach the server. Check your connection and try again.',
        })
      } finally {
        markInFlight(ids, false)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.06] p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <TriangleAlert className="h-4 w-4 text-[var(--clay)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--clay)]">
              Not on a route
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              These are skipped on the schedule until they&apos;re on a route.
            </p>
          </div>
        </div>
        <span className="font-display text-2xl font-semibold text-foreground tabular-nums shrink-0">
          {sorted.length}
        </span>
      </div>

      {routeGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Create a route group before you can put these properties on one.
          </p>
          <RouteGroupSheet />
        </div>
      ) : (
        <>
          {sorted.length > 1 && (
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="font-medium text-[--primary] hover:underline"
              >
                Select all
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {sorted.map((property) => (
              <li
                key={property.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                <Checkbox
                  checked={selected.has(property.id)}
                  onCheckedChange={() => toggle(property.id)}
                  aria-label={`Select ${property.address}`}
                />
                {/* Account first, address below — same identity block as the
                    route group cards and the schedule grid's label column. */}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-semibold leading-snug text-foreground truncate">
                    {property.accountName}
                  </p>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] leading-snug text-muted-foreground truncate">
                      {property.address}
                    </span>
                    <span className="shrink-0">
                      <FrequencyBadge frequency={property.frequency} />
                    </span>
                  </div>
                </div>
                <RoutePicker
                  routeGroups={routeGroups}
                  disabled={inFlight.has(property.id)}
                  onSelect={(routeGroupId) => handleAssignSingle(property, routeGroupId)}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>

          {selected.size > 0 && (
            <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-warm-lg">
              <span className="text-sm font-medium text-foreground">
                {selected.size} selected
              </span>
              <RoutePicker
                routeGroups={routeGroups}
                disabled={[...selected].some((id) => inFlight.has(id))}
                onSelect={handleAssignBulk}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
