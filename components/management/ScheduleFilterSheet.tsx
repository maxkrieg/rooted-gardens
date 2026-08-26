'use client'

import { Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScheduleFilterBar } from '@/components/management/ScheduleFilterBar'
import { useRole } from '@/components/app/RoleProvider'
import {
  EMPTY_SCHEDULE_FILTERS,
  activeScheduleFilterCount,
  type ScheduleFilterValues,
} from '@/lib/utils/schedule-filters'
import { cn } from '@/lib/utils'
import type { Account, Employee, RouteGroup } from '@/types/app'

interface ScheduleFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: ScheduleFilterValues
  routeGroups: RouteGroup[]
  accounts: Account[]
  employees: Employee[]
  onChange: (filters: ScheduleFilterValues) => void
  /** Stops matching the current filters, so the sheet can say what it did. */
  matchCount: number
}

/**
 * The phone's filter surface, behind the header's filter button.
 *
 * The two quick toggles are the point of it. "My stops" was a one-tap chip on
 * the deleted crew schedule page and became a three-tap dropdown in the merge;
 * this puts it back one tap from the bar, for every role — an owner checking
 * their own day wants exactly the same thing.
 */
export function ScheduleFilterSheet({
  open,
  onOpenChange,
  filters,
  routeGroups,
  accounts,
  employees,
  onChange,
  matchCount,
}: ScheduleFilterSheetProps) {
  const { employeeId } = useRole()

  const mineOn = !!employeeId && filters.crew === employeeId
  const openOn = filters.status === 'scheduled'
  const activeCount = activeScheduleFilterCount(filters)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">Filter</SheetTitle>
          <SheetDescription>
            {matchCount} {matchCount === 1 ? 'stop' : 'stops'} this week
            {activeCount > 0 ? ' with these filters' : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {employeeId && (
            <QuickChip
              label="My stops"
              active={mineOn}
              onClick={() => onChange({ ...filters, crew: mineOn ? 'all' : employeeId })}
            />
          )}
          <QuickChip
            label="Still open"
            active={openOn}
            onClick={() => onChange({ ...filters, status: openOn ? 'all' : 'scheduled' })}
          />
        </div>

        <div className="px-4 pb-4">
          <ScheduleFilterBar
            stacked
            filters={filters}
            routeGroups={routeGroups}
            accounts={accounts}
            employees={employees}
            onChange={onChange}
          />
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button
            variant="outline"
            className="h-11 flex-1"
            disabled={activeCount === 0}
            onClick={() => onChange(EMPTY_SCHEDULE_FILTERS)}
          >
            Clear all
          </Button>
          <Button className="h-11 flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function QuickChip({
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
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  )
}
