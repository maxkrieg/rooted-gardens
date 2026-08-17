'use client'

import { useMemo, useState, useTransition } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { FrequencyBadge } from '@/components/management/badges'
import { RoutePicker } from '@/components/management/RoutePicker'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { assignProperty, assignProperties, unassignProperty } from '@/app/management/routes/actions'
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
 */
export function UnroutedPanel({ properties, routeGroups }: UnroutedPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const sorted = useMemo(
    () =>
      [...properties].sort(
        (a, b) => a.accountName.localeCompare(b.accountName) || a.address.localeCompare(b.address)
      ),
    [properties]
  )

  if (properties.length === 0) return null

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

  function handleAssignSingle(property: PropertyWithAccount, routeGroupId: string) {
    const name = routeGroupName(routeGroupId)
    startTransition(async () => {
      const res = await assignProperty(property.id, routeGroupId)
      if (res.error) {
        toast.error('Could not assign the property', { description: res.error })
        return
      }
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(property.id)
        return next
      })
      toast.success(`${property.address} added to ${name}.`, {
        action: {
          label: 'Undo',
          onClick: () => {
            startTransition(async () => {
              const undoRes = await unassignProperty(property.id, routeGroupId)
              if (undoRes.error) {
                toast.error('Could not undo', { description: undoRes.error })
              }
            })
          },
        },
      })
    })
  }

  function handleAssignBulk(routeGroupId: string) {
    const ids = [...selected]
    if (ids.length === 0) return
    const name = routeGroupName(routeGroupId)
    startTransition(async () => {
      const res = await assignProperties(ids, routeGroupId)
      if (res.error) {
        toast.error('Could not assign the properties', { description: res.error })
        return
      }
      setSelected(new Set())
      toast.success(`${ids.length} propert${ids.length === 1 ? 'y' : 'ies'} added to ${name}.`, {
        action: {
          label: 'Undo',
          onClick: () => {
            startTransition(async () => {
              await Promise.all(ids.map((id) => unassignProperty(id, routeGroupId)))
            })
          },
        },
      })
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
          {properties.length}
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
                  disabled={pending}
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
                disabled={pending}
                onSelect={handleAssignBulk}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
