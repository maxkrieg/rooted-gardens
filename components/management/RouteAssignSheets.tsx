'use client'

import { useState, useTransition } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Check, Loader2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { assignRouteCrew, assignRouteVehicle } from '@/app/app/(padded)/schedule/actions'
import { useRefreshSchedule } from '@/hooks/useManagementSchedule'
import { useOfflineStatus } from '@/hooks/crew/useOfflineStatus'
import { emitTourEvent } from '@/lib/onboarding/events'
import { cn } from '@/lib/utils'
import type { RouteAssignment } from '@/lib/utils/schedule'
import type { Employee, RouteGroup, Vehicle } from '@/types/app'

export type RouteAssignKind = 'crew' | 'truck'

interface RouteAssignSheetProps {
  kind: RouteAssignKind
  onOpenChange: (open: boolean) => void
  routeGroup: RouteGroup
  weekStart: string
  assignment: RouteAssignment
  employees: Employee[]
  vehicles: Vehicle[]
}

/**
 * The route view's Crew and Truck: each sets one thing on every scheduled stop of the route this
 * week, and leaves the other alone. Online-only — the crew write replaces a set of join rows.
 */
export function RouteAssignSheet({
  kind,
  onOpenChange,
  routeGroup,
  weekStart,
  assignment,
  employees,
  vehicles,
}: RouteAssignSheetProps) {
  const { isOnline } = useOfflineStatus()
  const start = parseISO(weekStart)
  const weekLabel = `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`
  const { scheduledCount } = assignment
  const scope =
    scheduledCount === 0
      ? 'No scheduled stops to change'
      : `Sets all ${scheduledCount} scheduled ${scheduledCount === 1 ? 'stop' : 'stops'}`

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">
            {kind === 'crew' ? 'Crew' : 'Truck'} · {routeGroup.name}
          </SheetTitle>
          <SheetDescription>
            Week of {weekLabel}. {scope}.
          </SheetDescription>
        </SheetHeader>

        {!isOnline ? (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Changing a whole route needs a connection. You can still change one stop offline.
          </div>
        ) : kind === 'crew' ? (
          <CrewPicker
            routeGroup={routeGroup}
            weekStart={weekStart}
            assignment={assignment}
            employees={employees}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <TruckPicker
            routeGroup={routeGroup}
            weekStart={weekStart}
            assignment={assignment}
            vehicles={vehicles}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function CrewPicker({
  routeGroup,
  weekStart,
  assignment,
  employees,
  onDone,
}: {
  routeGroup: RouteGroup
  weekStart: string
  assignment: RouteAssignment
  employees: Employee[]
  onDone: () => void
}) {
  const refreshSchedule = useRefreshSchedule()
  const [pending, startTransition] = useTransition()
  const [crewIds, setCrewIds] = useState<string[]>(assignment.crewIds)

  function toggle(id: string) {
    setCrewIds((c) => (c.includes(id) ? c.filter((v) => v !== id) : [...c, id]))
  }

  function save() {
    startTransition(async () => {
      const res = await assignRouteCrew(routeGroup.id, weekStart, crewIds)
      if (res.error) {
        toast.error('Could not assign the crew', { description: res.error })
        return
      }
      // Client-first schedule: revalidatePath alone wouldn't repaint it.
      refreshSchedule(weekStart)
      if ((res.count ?? 0) > 0) emitTourEvent('schedule.crewAssigned')
      toast.success(`Crew set on ${res.count} ${res.count === 1 ? 'stop' : 'stops'}.`)
      onDone()
    })
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      {assignment.crewMixed && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-[13px] leading-snug text-muted-foreground">
          These stops have different crews. Everyone on any of them is ticked, and saving puts
          the same crew on all of them.
        </p>
      )}
      <ul className="space-y-0.5">
        {employees
          .filter((e) => e.role !== 'accountant')
          .map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                onClick={() => toggle(employee.id)}
                aria-pressed={crewIds.includes(employee.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-[15px] transition-colors hover:bg-secondary"
              >
                <CheckIndicator checked={crewIds.includes(employee.id)} />
                {employee.name}
              </button>
            </li>
          ))}
      </ul>
      <Button
        className="h-12 w-full"
        disabled={pending || assignment.scheduledCount === 0}
        onClick={save}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save crew
      </Button>
    </div>
  )
}

/** One tap saves: picking a truck is a single choice, so it needs no confirm step. */
function TruckPicker({
  routeGroup,
  weekStart,
  assignment,
  vehicles,
  onDone,
}: {
  routeGroup: RouteGroup
  weekStart: string
  assignment: RouteAssignment
  vehicles: Vehicle[]
  onDone: () => void
}) {
  const refreshSchedule = useRefreshSchedule()
  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined)
  const disabled = pendingId !== undefined || assignment.scheduledCount === 0
  const current = assignment.vehicleMixed ? undefined : assignment.vehicleId

  async function pick(vehicleId: string | null) {
    setPendingId(vehicleId)
    const res = await assignRouteVehicle(routeGroup.id, weekStart, vehicleId)
    setPendingId(undefined)
    if (res.error) {
      toast.error('Could not set the truck', { description: res.error })
      return
    }
    refreshSchedule(weekStart)
    const name = vehicles.find((v) => v.id === vehicleId)?.name
    toast.success(
      name
        ? `${name} set on ${res.count} ${res.count === 1 ? 'stop' : 'stops'}.`
        : `Truck cleared on ${res.count} ${res.count === 1 ? 'stop' : 'stops'}.`,
    )
    onDone()
  }

  const options: Array<{ id: string | null; name: string; note?: string }> = [
    ...vehicles
      .filter((v) => v.status !== 'retired')
      .map((v) => ({
        id: v.id,
        name: v.name,
        note: v.status === 'maintenance' ? 'In maintenance' : (v.plate ?? undefined),
      })),
    { id: null, name: 'No truck' },
  ]

  return (
    <div className="space-y-3 px-4 pb-4">
      {assignment.vehicleMixed && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-[13px] leading-snug text-muted-foreground">
          These stops have different trucks. Picking one sets it on all of them.
        </p>
      )}
      <ul className="space-y-0.5">
        {options.map((option) => {
          const isCurrent = current === option.id
          return (
            <li key={option.id ?? 'none'}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void pick(option.id)}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-[15px] transition-colors hover:bg-secondary disabled:opacity-60',
                  isCurrent && 'bg-secondary font-semibold',
                  option.id === null && 'text-muted-foreground',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.name}</span>
                  {option.note && (
                    <span className="block truncate text-[12px] font-normal text-muted-foreground">
                      {option.note}
                    </span>
                  )}
                </span>
                {pendingId === option.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  isCurrent && <Check className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
