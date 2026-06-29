'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  search: string
}

export const EMPTY_FILTERS: ScheduleFilters = { crew: 'all', routeGroup: 'all', search: '' }

interface CrewScheduleFiltersProps {
  filters: ScheduleFilters
  onChange: (next: ScheduleFilters) => void
  employees: Employee[]
  routeGroups: RouteGroup[]
}

export function CrewScheduleFilters({
  filters,
  onChange,
  employees,
  routeGroups,
}: CrewScheduleFiltersProps) {
  const isFiltered =
    filters.crew !== 'all' || filters.routeGroup !== 'all' || filters.search.trim() !== ''

  return (
    <div className="space-y-2.5">
      {/* Address search */}
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

      <div className="flex gap-2">
        {/* Crew filter — includes a quick "My stops" entry */}
        <Select value={filters.crew} onValueChange={(v) => onChange({ ...filters, crew: v })}>
          <SelectTrigger className="h-11 flex-1 min-w-0">
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

        {/* Route group filter */}
        <Select
          value={filters.routeGroup}
          onValueChange={(v) => onChange({ ...filters, routeGroup: v })}
        >
          <SelectTrigger className="h-11 flex-1 min-w-0">
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

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
