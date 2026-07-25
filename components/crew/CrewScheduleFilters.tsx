'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Employee, RouteGroup } from '@/types/app'

export type ScheduleFilters = {
  /** 'all' | an employee id (the current user's id is what the "My stops" toggle sets) */
  crew: string
  /** 'all' | a route group id */
  routeGroup: string
  /** 'all' | a visit status (currently only 'scheduled', driven by the Incomplete toggle) */
  status: string
}

export const EMPTY_FILTERS: ScheduleFilters = {
  crew: 'all',
  routeGroup: 'all',
  status: 'all',
}

interface CrewScheduleFilterBarProps {
  filters: ScheduleFilters
  onChange: (next: ScheduleFilters) => void
  employees: Employee[]
  routeGroups: RouteGroup[]
  /** The signed-in user's employee id — floated to the top of the Crew dropdown. */
  currentEmployeeId?: string
}

/**
 * Route + Crew dropdowns for the crew schedule header. Two equal-width Selects
 * (each flex-1) so they split the row and never overflow narrow phones. The Crew
 * dropdown and the "My stops" toggle both bind to `filters.crew` (an employee id),
 * so they stay in sync — the toggle is a shortcut for the current user's own id,
 * which also appears (labelled "(you)") at the top of this dropdown.
 */
export function CrewScheduleFilterBar({
  filters,
  onChange,
  employees,
  routeGroups,
  currentEmployeeId,
}: CrewScheduleFilterBarProps) {
  const orderedEmployees = useMemo(() => {
    if (!currentEmployeeId) return employees
    const me = employees.find((e) => e.id === currentEmployeeId)
    if (!me) return employees
    return [me, ...employees.filter((e) => e.id !== currentEmployeeId)]
  }, [employees, currentEmployeeId])

  return (
    <div className="flex items-center gap-2">
      <Select
        value={filters.routeGroup}
        onValueChange={(v) => onChange({ ...filters, routeGroup: v })}
      >
        <SelectTrigger className="h-11 flex-1 text-base">
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

      <Select value={filters.crew} onValueChange={(v) => onChange({ ...filters, crew: v })}>
        <SelectTrigger className="h-11 flex-1 text-base">
          <SelectValue placeholder="Crew" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All crew</SelectItem>
          {orderedEmployees.map((emp) => (
            <SelectItem key={emp.id} value={emp.id}>
              {emp.name}
              {emp.id === currentEmployeeId ? ' (you)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
