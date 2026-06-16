'use client'

import { useTransition } from 'react'
import { ChevronUp, ChevronDown, EyeOff, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FrequencyBadge } from '@/components/management/badges'
import { ServiceZoneSheet } from '@/components/management/ServiceZoneSheet'
import { moveZone, setZoneActive } from '@/app/management/accounts/property-actions'
import type { Property, ServiceZone } from '@/types/app'

interface ZoneListProps {
  property: Property
  zones: ServiceZone[]
}

/**
 * Interactive zone list for a property card on the account detail page.
 * Zones are sorted by sort_order (the server query guarantees this ordering).
 * Reorder (▲/▼) and soft-delete (active toggle) are server-action calls that
 * revalidate the parent page — no optimistic client state needed.
 */
export function ZoneList({ property, zones }: ZoneListProps) {
  const [pending, startTransition] = useTransition()

  function handleMove(zoneId: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const res = await moveZone(zoneId, property.account_id, direction)
      if (res.error) toast.error('Could not reorder zone', { description: res.error })
    })
  }

  function handleToggleActive(zone: ServiceZone) {
    startTransition(async () => {
      const res = await setZoneActive(zone.id, property.account_id, !zone.active)
      if (res.error) {
        toast.error('Could not update zone', { description: res.error })
      } else {
        toast.success(zone.active ? 'Zone deactivated' : 'Zone activated')
      }
    })
  }

  if (zones.length === 0) {
    return (
      <div className="pt-3 border-t border-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Service zones
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground italic">No zones yet.</p>
          <ServiceZoneSheet
            propertyId={property.id}
            accountId={property.account_id}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pt-3 border-t border-border">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Service zones
      </p>
      <div className="space-y-1">
        {zones.map((zone, idx) => (
          <div
            key={zone.id}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 group ${
              zone.active ? '' : 'opacity-50'
            }`}
          >
            {/* Reorder buttons */}
            <div className="flex flex-col shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === 0 || pending}
                onClick={() => handleMove(zone.id, 'up')}
                aria-label="Move zone up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === zones.length - 1 || pending}
                onClick={() => handleMove(zone.id, 'down')}
                aria-label="Move zone down"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>

            {/* Zone name */}
            <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">
              {zone.name}
            </span>

            {/* Frequency badge */}
            <FrequencyBadge frequency={zone.frequency} />

            {/* Actions — appear on hover on desktop, always visible on mobile */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Edit */}
              <ServiceZoneSheet
                propertyId={property.id}
                accountId={property.account_id}
                zone={zone}
              />

              {/* Active toggle (soft delete) */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={pending}
                onClick={() => handleToggleActive(zone)}
                aria-label={zone.active ? 'Deactivate zone' : 'Activate zone'}
                title={zone.active ? 'Deactivate (soft delete)' : 'Activate'}
              >
                {zone.active ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add zone trigger at the bottom */}
      <div className="mt-2 flex justify-end">
        <ServiceZoneSheet
          propertyId={property.id}
          accountId={property.account_id}
        />
      </div>
    </div>
  )
}
