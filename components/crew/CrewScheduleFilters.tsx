'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Employee, RouteGroup } from '@/types/app'

export type ScheduleFilters = {
  /** 'all' | 'me' | an employee id */
  crew: string
  /** 'all' | a route group id */
  routeGroup: string
  /** 'all' | a visit status */
  status: string
  search: string
}

export const EMPTY_FILTERS: ScheduleFilters = {
  crew: 'all',
  routeGroup: 'all',
  status: 'all',
  search: '',
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'invoiced', label: 'Invoiced' },
]

export type FilterChip = {
  key: 'search' | 'crew' | 'route' | 'status'
  label: string
  clear: Partial<ScheduleFilters>
}

/**
 * The active filters as removable chips for the header. Excludes `crew === 'me'`
 * (shown by the "My stops" toggle) and any field still at its default.
 */
export function activeFilterChips(
  filters: ScheduleFilters,
  employees: Employee[],
  routeGroups: RouteGroup[]
): FilterChip[] {
  const chips: FilterChip[] = []

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: `“${filters.search.trim()}”`,
      clear: { search: '' },
    })
  }

  if (filters.crew !== 'all' && filters.crew !== 'me') {
    const name = employees.find((e) => e.id === filters.crew)?.name ?? 'Crew'
    chips.push({ key: 'crew', label: name, clear: { crew: 'all' } })
  }

  if (filters.routeGroup !== 'all') {
    const name = routeGroups.find((rg) => rg.id === filters.routeGroup)?.name ?? 'Route'
    chips.push({ key: 'route', label: name, clear: { routeGroup: 'all' } })
  }

  if (filters.status !== 'all') {
    const label = STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? 'Status'
    chips.push({ key: 'status', label, clear: { status: 'all' } })
  }

  return chips
}

interface ScheduleFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: ScheduleFilters
  onChange: (next: ScheduleFilters) => void
  employees: Employee[]
  routeGroups: RouteGroup[]
}

export function ScheduleFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  employees,
  routeGroups,
}: ScheduleFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Filters</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Address / account search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Search address or account…"
              className="pl-9 h-11 text-base"
              inputMode="search"
            />
          </div>

          {/* Crew */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Crew</label>
            <Select value={filters.crew} onValueChange={(v) => onChange({ ...filters, crew: v })}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Crew" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All crew</SelectItem>
                <SelectItem value="me">My stops</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Route */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Route</label>
            <Select
              value={filters.routeGroup}
              onValueChange={(v) => onChange({ ...filters, routeGroup: v })}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Route" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes</SelectItem>
                {routeGroups.map((rg) => (
                  <SelectItem key={rg.id} value={rg.id}>
                    {rg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v })}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background flex-row gap-2">
          <Button
            variant="ghost"
            className="flex-1 h-11"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear all
          </Button>
          <Button className="flex-1 h-11 font-semibold" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
