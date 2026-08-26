'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Employee, Vehicle } from '@/types/app'

export type BulkActionKind = 'crew' | 'vehicle' | 'skip'

interface BulkActionSheetProps {
  kind: BulkActionKind | null
  onOpenChange: (open: boolean) => void
  count: number
  employees: Employee[]
  vehicles: Vehicle[]
  onPickCrew: (employee: Employee) => void
  onPickVehicle: (vehicleId: string | null) => void
  onSkip: (reason: string) => void
}

/**
 * The picker behind each bulk action. One sheet with three modes rather than
 * three sheets, because they differ only in what they list — and the phone has
 * room for exactly one sheet at a time anyway.
 */
export function BulkActionSheet({
  kind,
  onOpenChange,
  count,
  employees,
  vehicles,
  onPickCrew,
  onPickVehicle,
  onSkip,
}: BulkActionSheetProps) {
  const [reason, setReason] = useState('')

  const title =
    kind === 'crew'
      ? `Assign crew to ${count}`
      : kind === 'vehicle'
        ? `Set truck on ${count}`
        : `Skip ${count} ${count === 1 ? 'stop' : 'stops'}`

  return (
    <Sheet open={kind !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">{title}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {kind === 'crew' && (
            <ul className="space-y-1">
              {employees
                .filter((e) => e.role !== 'accountant')
                .map((employee) => (
                  <li key={employee.id}>
                    <RowButton label={employee.name} onClick={() => onPickCrew(employee)} />
                  </li>
                ))}
            </ul>
          )}

          {kind === 'vehicle' && (
            <ul className="space-y-1">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <RowButton label={vehicle.name} onClick={() => onPickVehicle(vehicle.id)} />
                </li>
              ))}
              <li>
                <RowButton label="No truck" muted onClick={() => onPickVehicle(null)} />
              </li>
            </ul>
          )}

          {kind === 'skip' && (
            <div className="space-y-3">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are these being skipped? (rain, customer away…)"
                rows={3}
                className="text-base"
              />
              <Button
                className="h-12 w-full"
                variant="destructive"
                disabled={reason.trim().length === 0}
                onClick={() => {
                  onSkip(reason.trim())
                  setReason('')
                }}
              >
                Skip {count} {count === 1 ? 'stop' : 'stops'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function RowButton({
  label,
  onClick,
  muted,
}: {
  label: string
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center rounded-lg px-3 text-left text-[15px] font-medium transition-colors hover:bg-secondary',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {label}
    </button>
  )
}
