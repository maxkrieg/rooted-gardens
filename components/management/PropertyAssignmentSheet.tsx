'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
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
import { assignProperty, unassignProperty } from '@/app/management/routes/actions'
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
 * Sheet that lets owners assign/unassign properties to a route group.
 * Properties are grouped by account for scanability, but every property gets
 * its own toggle — no account-level bulk control. A property already assigned
 * to a DIFFERENT route group can still be toggled here; flipping it prompts a
 * confirmation dialog (moving it out of its current group) rather than being
 * disabled outright.
 *
 * The list is split into three always-visible sections — In this route / Not
 * on a route / In other routes — rather than the old "Unassigned only"
 * filter toggle, so an unrouted property doesn't require knowing a toggle
 * exists. The Routes page's UnroutedPanel is now the primary place to catch
 * these company-wide; this sheet's job is curating one route at a time.
 */
export function PropertyAssignmentSheet({
  routeGroupId,
  routeGroupName,
  allProperties,
}: PropertyAssignmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reassignTarget, setReassignTarget] = useState<PropertyWithAccount | null>(null)
  const [query, setQuery] = useState('')

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
      if (property.currentRouteGroup?.id === routeGroupId) inThisRoute.push(property)
      else if (!property.currentRouteGroup) notOnARoute.push(property)
      else inOtherRoutes.push(property)
    }
    return { inThisRoute, notOnARoute, inOtherRoutes }
  }, [filtered, routeGroupId])

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

  function doToggle(propertyId: string, isAssignedHere: boolean) {
    startTransition(async () => {
      const res = isAssignedHere
        ? await unassignProperty(propertyId, routeGroupId)
        : await assignProperty(propertyId, routeGroupId)

      if (res.error) {
        toast.error('Could not update assignment', { description: res.error })
      }
    })
  }

  function handleToggle(property: PropertyWithAccount, isAssignedHere: boolean) {
    const isLocked = !!property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId
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
    const isAssignedHere = property.currentRouteGroup?.id === routeGroupId
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
              href={`/management/accounts/${property.account_id}`}
              className="text-sm font-medium text-[--primary] hover:underline truncate block"
            >
              {property.accountName}
            </Link>
          )}
          <Link
            href={`/management/accounts/${property.account_id}`}
            className={inline ? addressClass : 'text-xs text-muted-foreground hover:underline truncate block'}
          >
            {property.address}
          </Link>
          {property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId && (
            <p className="text-[11px] text-muted-foreground/80 truncate">
              Currently in {property.currentRouteGroup.name}
            </p>
          )}
        </div>
        <Switch
          checked={isAssignedHere}
          disabled={pending}
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

      <Sheet open={open} onOpenChange={setOpen}>
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
            // Rendered inline within the Sheet (not a separate Radix Dialog)
            // deliberately — nesting a second Radix Dialog/Sheet root here
            // causes their dismissable-layer stacks to cross-dismiss each
            // other on outside clicks (well-documented Radix issue), closing
            // this Sheet whenever the confirmation is dismissed. A plain
            // absolutely-positioned overlay sidesteps that entirely.
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
                  <Button
                    variant="outline"
                    onClick={() => setReassignTarget(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={confirmReassign} disabled={pending}>
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
