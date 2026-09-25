'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Map as MapIcon, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { assignProperty, unassignProperty } from '@/app/app/(padded)/routes/actions'
import { useRefreshRoutes } from '@/hooks/useRoutes'
import type { PropertyWithAccount } from '@/types/app'

interface PropertyAssignmentSheetProps {
  routeGroupId: string
  routeGroupName: string
  allProperties: PropertyWithAccount[]
}

interface AccountGroup {
  accountId: string
  accountName: string
  properties: PropertyWithAccount[]
}

function groupByAccount(properties: PropertyWithAccount[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>()
  for (const property of properties) {
    const existing = map.get(property.account_id)
    if (existing) {
      existing.properties.push(property)
    } else {
      map.set(property.account_id, {
        accountId: property.account_id,
        accountName: property.accountName,
        properties: [property],
      })
    }
  }
  return [...map.values()].sort((a, b) => a.accountName.localeCompare(b.accountName))
}

/**
 * Assign properties to one route group, grouped by account, in three sections: this route,
 * unrouted, other routes (moving prompts a confirm). Toggles use a local overrides layer and
 * an inFlight set, never the transition's pending flag, so a slow refresh can't wedge them.
 */
export function PropertyAssignmentSheet({
  routeGroupId,
  routeGroupName,
  allProperties,
}: PropertyAssignmentSheetProps) {
  const router = useRouter()
  const refreshRoutes = useRefreshRoutes()
  const [open, setOpen] = useState(false)
  // Pending flag deliberately discarded — see the note above. Same idiom as
  // ScheduleGrid's `creatingKey`: track busy state per row ourselves.
  const [, startTransition] = useTransition()
  const [reassignTarget, setReassignTarget] = useState<PropertyWithAccount | null>(null)
  const [query, setQuery] = useState('')
  // propertyId → assigned here, as last asked. Absent defers to the server; reset on close.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())

  /** Where each property renders now: override, else server. Overridden-off means unrouted. */
  const effectiveGroupIds = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const property of allProperties) {
      const override = overrides.get(property.id)
      map.set(
        property.id,
        override === undefined
          ? property.currentRouteGroup?.id ?? null
          : override
            ? routeGroupId
            : null
      )
    }
    return map
  }, [allProperties, overrides, routeGroupId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allProperties
    return allProperties.filter(
      (p) => p.address.toLowerCase().includes(q) || p.accountName.toLowerCase().includes(q)
    )
  }, [allProperties, query])

  const { inThisRoute, notOnARoute, inOtherRoutes } = useMemo(() => {
    const inThisRoute: PropertyWithAccount[] = []
    const notOnARoute: PropertyWithAccount[] = []
    const inOtherRoutes: PropertyWithAccount[] = []
    for (const property of filtered) {
      const groupId = effectiveGroupIds.get(property.id) ?? null
      if (groupId === routeGroupId) inThisRoute.push(property)
      else if (groupId === null) notOnARoute.push(property)
      else inOtherRoutes.push(property)
    }
    return { inThisRoute, notOnARoute, inOtherRoutes }
  }, [filtered, routeGroupId, effectiveGroupIds])

  const sections: Array<{
    key: string
    label: string
    properties: PropertyWithAccount[]
    dot: string | null
  }> = [
    { key: 'here', label: 'In this route', properties: inThisRoute, dot: null },
    { key: 'unrouted', label: 'Not on a route', properties: notOnARoute, dot: 'bg-[var(--clay)]' },
    { key: 'elsewhere', label: 'In other routes', properties: inOtherRoutes, dot: null },
  ]

  function setOverride(propertyId: string, assignedHere: boolean) {
    setOverrides((prev) => new Map(prev).set(propertyId, assignedHere))
  }

  // Rollback drops the override so a failed move shows its real, unchanged route.
  function clearOverride(propertyId: string) {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.delete(propertyId)
      return next
    })
  }

  function clearInFlight(propertyId: string) {
    setInFlight((prev) => {
      const next = new Set(prev)
      next.delete(propertyId)
      return next
    })
  }

  function doToggle(propertyId: string, isAssignedHere: boolean) {
    // Flip the switch first — the user's intent is the truth until the server
    // says otherwise.
    setOverride(propertyId, !isAssignedHere)
    setInFlight((prev) => new Set(prev).add(propertyId))

    startTransition(async () => {
      try {
        const res = isAssignedHere
          ? await unassignProperty(propertyId, routeGroupId)
          : await assignProperty(propertyId, routeGroupId)

        if (res.error) {
          clearOverride(propertyId) // roll back the optimistic flip
          toast.error('Could not update assignment', { description: res.error })
          return
        }

        // revalidatePath only marks the cache stale; this is what actually
        // repaints the route group card behind the sheet.
        refreshRoutes()
        router.refresh()
      } catch {
        // A thrown failure skips `res.error`; without this the row stays flipped and stuck.
        clearOverride(propertyId)
        toast.error('Could not update assignment', {
          description: 'The change did not reach the server. Check your connection and try again.',
        })
      } finally {
        clearInFlight(propertyId)
      }
    })
  }

  function handleToggle(property: PropertyWithAccount, isAssignedHere: boolean) {
    const groupId = effectiveGroupIds.get(property.id) ?? null
    const isLocked = groupId !== null && groupId !== routeGroupId
    if (isLocked) {
      setReassignTarget(property)
      return
    }
    doToggle(property.id, isAssignedHere)
  }

  function confirmReassign() {
    if (!reassignTarget) return
    doToggle(reassignTarget.id, false)
    setReassignTarget(null)
  }

  function renderPropertyRow(property: PropertyWithAccount, inline: boolean) {
    const groupId = effectiveGroupIds.get(property.id) ?? null
    const isAssignedHere = groupId === routeGroupId
    const addressClass = inline
      ? 'text-sm text-[--primary] hover:underline truncate block'
      : 'text-sm font-medium text-[--primary] hover:underline truncate block'

    return (
      <li
        key={property.id}
        className={inline ? 'flex items-center justify-between gap-3 pl-8 pr-6 py-3' : 'flex items-center justify-between gap-3 px-6 py-3.5'}
      >
        <div className="min-w-0">
          {!inline && (
            <Link
              href={`/app/accounts/${property.account_id}`}
              className="text-sm font-medium text-[--primary] hover:underline truncate block"
            >
              {property.accountName}
            </Link>
          )}
          <Link
            href={`/app/accounts/${property.account_id}`}
            className={inline ? addressClass : 'text-xs text-muted-foreground hover:underline truncate block'}
          >
            {property.address}
          </Link>
          {property.currentRouteGroup && groupId === property.currentRouteGroup.id && groupId !== routeGroupId && (
            <p className="text-[11px] text-muted-foreground/80 truncate">
              Currently in {property.currentRouteGroup.name}
            </p>
          )}
        </div>
        <Switch
          checked={isAssignedHere}
          disabled={inFlight.has(property.id)}
          onCheckedChange={() => handleToggle(property, isAssignedHere)}
          aria-label={isAssignedHere ? 'Remove from group' : 'Add to group'}
          className="shrink-0"
        />
      </li>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <MapIcon className="h-3.5 w-3.5" />
        Manage properties
      </Button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // Re-sync from fresh server props on the next open rather than
          // carrying a stale local view of the assignments forward.
          if (!next) {
            setOverrides(new Map())
            setReassignTarget(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Assign Properties</SheetTitle>
            <SheetDescription>
              Toggle properties in and out of <strong>{routeGroupName}</strong>.
            </SheetDescription>
            <div className="relative pt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search address or account…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground text-center px-6">
                {allProperties.length === 0
                  ? 'No properties exist yet.'
                  : 'No properties match your search.'}
              </div>
            ) : (
              sections.map((section) =>
                section.properties.length === 0 ? null : (
                  <div key={section.key}>
                    <div className="sticky top-0 z-[1] flex items-center gap-1.5 border-b border-border/60 bg-card/95 px-6 pb-1.5 pt-3 backdrop-blur">
                      {section.dot && <span className={`h-1.5 w-1.5 rounded-full ${section.dot}`} />}
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.label} · {section.properties.length}
                      </p>
                    </div>
                    <ul className="divide-y divide-border">
                      {groupByAccount(section.properties).map((group) => {
                        if (group.properties.length === 1) {
                          return renderPropertyRow(group.properties[0], false)
                        }

                        return (
                          <li key={group.accountId}>
                            <div className="px-6 pt-3.5 pb-1 bg-muted/30">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {group.accountName}
                              </p>
                            </div>
                            <ul className="divide-y divide-border/60">
                              {group.properties.map((property) => renderPropertyRow(property, true))}
                            </ul>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              )
            )}
          </div>

          {reassignTarget && (
            // Inline overlay, not a nested Radix Dialog: nested dismissable layers cross-dismiss.
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Move to {routeGroupName}?
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <strong className="text-foreground">{reassignTarget.address}</strong> is
                  already assigned to{' '}
                  <strong className="text-foreground">
                    {reassignTarget.currentRouteGroup?.name}
                  </strong>
                  . Adding it here will remove it from that route group.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReassignTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmReassign}
                    disabled={inFlight.has(reassignTarget.id)}
                  >
                    Move property
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
