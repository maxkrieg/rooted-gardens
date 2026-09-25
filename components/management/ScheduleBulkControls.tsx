'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'
import { SelectionBar } from '@/components/app/SelectionBar'
import { BulkActionSheet, type BulkActionKind } from '@/components/management/BulkActionSheet'
import {
  useBulkScheduleActions,
  type BulkResult,
  type BulkTarget,
} from '@/hooks/useBulkScheduleActions'
import type { Employee, Vehicle } from '@/types/app'
import { firstName } from '@/lib/utils/team'

interface ScheduleBulkControlsProps {
  /** What's selected, resolved to the visit for its own week. */
  targets: BulkTarget[]
  /** Everything selectable on screen — hides "Select all" once reached. */
  selectableCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onExitSelectMode?: () => void
  employees: Employee[]
  vehicles: Vehicle[]
}

/** Select-mode bar and action sheet for both layouts. On failure the selection stays for a retry. */
export function ScheduleBulkControls({
  targets,
  selectableCount,
  onSelectAll,
  onClearSelection,
  onExitSelectMode,
  employees,
  vehicles,
}: ScheduleBulkControlsProps) {
  const bulk = useBulkScheduleActions()
  const [bulkKind, setBulkKind] = useState<BulkActionKind | null>(null)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)

  const count = targets.length
  // Skip only touches scheduled visits, so the sheet must count those, not the
  // whole selection — "Skip 12 stops" on a selection where 4 are skippable lies.
  const skippableCount = targets.filter(({ row }) => row.visit?.status === 'scheduled').length

  async function runBulk(
    label: string,
    fn: () => Promise<BulkResult>,
    done: (n: number) => string,
  ) {
    setBulkKind(null)
    setBusyLabel(label)
    try {
      const { changed, undo } = await fn()
      onClearSelection()
      if (changed === 0) {
        toast('Nothing to change', { description: 'Those stops were already set that way.' })
        return
      }
      // Undo goes through the same queue as the change, so it works in a dead
      // zone too. Scheduling has none — see BulkResult.
      toast.success(done(changed), {
        action: undo
          ? {
              label: 'Undo',
              onClick: () => {
                void undo().catch(() =>
                  toast.error('Could not undo', {
                    description: 'The reversal is queued and will retry.',
                  }),
                )
              },
            }
          : undefined,
      })
    } catch (err) {
      toast.error('Some changes did not save', {
        description: toUserMessage(err, 'They are queued and will retry.', '[ScheduleBulkControls.runBulk]'),
      })
    } finally {
      setBusyLabel(null)
    }
  }

  const stops = (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`

  return (
    <>
      <SelectionBar
        count={count}
        busyLabel={busyLabel}
        onSelectAll={count < selectableCount ? onSelectAll : undefined}
        onClear={() => (count > 0 ? onClearSelection() : onExitSelectMode?.())}
        actions={[
          { label: 'Crew', disabled: count === 0, onClick: () => setBulkKind('crew') },
          { label: 'Truck', disabled: count === 0, onClick: () => setBulkKind('vehicle') },
          {
            label: 'Schedule',
            disabled: count === 0 || targets.every(({ row }) => row.visit),
            onClick: () =>
              runBulk('Scheduling…', () => bulk.scheduleAll(targets), (n) => `${stops(n)} scheduled.`),
          },
          {
            label: 'Skip',
            disabled: count === 0 || skippableCount === 0,
            onClick: () => setBulkKind('skip'),
          },
        ]}
      />

      <BulkActionSheet
        kind={bulkKind}
        onOpenChange={(open) => !open && setBulkKind(null)}
        count={bulkKind === 'skip' ? skippableCount : count}
        employees={employees}
        vehicles={vehicles}
        onPickCrew={(employee) =>
          runBulk(
            `Assigning ${firstName(employee.name)}…`,
            () => bulk.assignCrew(targets, employee),
            (n) => `${firstName(employee.name)} assigned to ${stops(n)}.`,
          )
        }
        onPickVehicle={(vehicleId) =>
          runBulk('Setting truck…', () => bulk.setVehicle(targets, vehicleId), (n) => `Truck set on ${stops(n)}.`)
        }
        onSkip={(reason) =>
          runBulk('Skipping…', () => bulk.skipAll(targets, reason), (n) => `${stops(n)} skipped.`)
        }
      />
    </>
  )
}
