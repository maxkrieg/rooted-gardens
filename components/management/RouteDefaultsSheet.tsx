'use client'

import { useState, useTransition } from 'react'
import { Loader2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { setRouteGroupDefaults } from '@/app/app/(padded)/routes/actions'
import { useRefreshRoutes } from '@/hooks/useRoutes'
import { useOfflineStatus } from '@/hooks/crew/useOfflineStatus'
import { cn } from '@/lib/utils'
import type { Employee, RouteGroup, Vehicle } from '@/types/app'

const DAYS: Array<{ value: string; label: string }> = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

interface RouteDefaultsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeGroup: RouteGroup
  employees: Employee[]
  vehicles: Vehicle[]
  /** Current regulars for this group, from the schedule reference. */
  currentCrewIds: string[]
}

/**
 * A route group's standing plan: who normally runs it, in what, on which days.
 *
 * The route sheet has encoded this in the group's *name* ("Wilder - Mon/Tues")
 * because there was nowhere else to put it. A generated week pre-fills from
 * here, which is what makes generating worth doing at all.
 *
 * Online-only, and says so: it replaces a set of join rows in one go, which is
 * the same reason bulkAssignRoute isn't queued either.
 */
export function RouteDefaultsSheet({
  open,
  onOpenChange,
  routeGroup,
  employees,
  vehicles,
  currentCrewIds,
}: RouteDefaultsSheetProps) {
  const refreshRoutes = useRefreshRoutes()
  const { isOnline } = useOfflineStatus()
  const [pending, startTransition] = useTransition()

  const [crewIds, setCrewIds] = useState<string[]>(currentCrewIds)
  const [days, setDays] = useState<string[]>(routeGroup.default_days ?? [])
  const [vehicleId, setVehicleId] = useState<string | null>(routeGroup.default_vehicle_id)

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function save() {
    startTransition(async () => {
      const res = await setRouteGroupDefaults(routeGroup.id, { vehicleId, days, crewIds })
      if (res.error) {
        toast.error('Could not save the route defaults', { description: res.error })
        return
      }
      // The schedule is client-first, so revalidatePath alone would leave it
      // showing the old defaults.
      refreshRoutes()
      onOpenChange(false)
      toast.success(`Defaults saved for ${routeGroup.name}.`)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">{routeGroup.name} defaults</SheetTitle>
          <SheetDescription>
            Used to pre-fill a generated week. A stop&rsquo;s own crew and truck always win.
          </SheetDescription>
        </SheetHeader>

        {!isOnline ? (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Route defaults need a connection — they replace a whole set at once, so
            they can&rsquo;t be queued safely.
          </div>
        ) : (
          <div className="space-y-5 px-4 pb-4">
            <Field
              label="Days"
              hint="Shown on the route's band and in a generated week. A visit is a week, not a day, so this labels the plan rather than scheduling to it."
            >
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <Chip
                    key={day.value}
                    label={day.label}
                    active={days.includes(day.value)}
                    onClick={() => setDays((d) => toggle(d, day.value))}
                  />
                ))}
              </div>
            </Field>

            <Field label="Truck">
              <div className="flex flex-wrap gap-1.5">
                {vehicles.map((vehicle) => (
                  <Chip
                    key={vehicle.id}
                    label={vehicle.name}
                    active={vehicleId === vehicle.id}
                    onClick={() => setVehicleId((v) => (v === vehicle.id ? null : vehicle.id))}
                  />
                ))}
              </div>
            </Field>

            <Field label="Regular crew">
              <ul className="space-y-0.5">
                {employees
                  .filter((e) => e.role !== 'accountant')
                  .map((employee) => (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onClick={() => setCrewIds((c) => toggle(c, employee.id))}
                        aria-pressed={crewIds.includes(employee.id)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-[15px] transition-colors hover:bg-secondary"
                      >
                        <CheckIndicator checked={crewIds.includes(employee.id)} />
                        {employee.name}
                      </button>
                    </li>
                  ))}
              </ul>
            </Field>

            <Button className="h-12 w-full" disabled={pending} onClick={save}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save defaults
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {hint && <p className="mb-2 mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
