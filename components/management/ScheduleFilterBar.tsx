'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SCHEDULE_STATUS_FILTERS,
  SCHEDULE_STATUS_FILTER_LABELS,
  hasActiveScheduleFilters,
  scheduleFilterParams,
  type ScheduleFilterValues,
} from '@/lib/utils/schedule-filters'
import type { Account, Employee, RouteGroup } from '@/types/app'

interface ScheduleFilterBarProps {
  filters: ScheduleFilterValues
  /** The window's first Monday — preserved on every filter change. */
  week: string
  routeGroups: RouteGroup[]
  accounts: Account[]
  employees: Employee[]
}

/**
 * Route group / account / crew / status filters for the management schedule.
 * State lives in the URL rather than component state, so a filtered view is
 * shareable and survives week navigation — the same approach as the billing
 * History tab's filters. Sizing is phone-first: 2-up on a narrow screen,
 * a single row from `sm` up.
 */
export function ScheduleFilterBar({
  filters,
  week,
  routeGroups,
  accounts,
  employees,
}: ScheduleFilterBarProps) {
  const router = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)

  // Accountants never work visits, so they're not crew-filter candidates.
  const crewEmployees = useMemo(
    () => employees.filter((e) => e.role !== 'accountant'),
    [employees]
  )

  const selectedAccountName =
    filters.account === 'all'
      ? 'All accounts'
      : (accounts.find((a) => a.id === filters.account)?.name ?? 'All accounts')

  function apply(next: Partial<ScheduleFilterValues>) {
    const params = scheduleFilterParams({ ...filters, ...next }, week)
    router.push(`/management/schedule?${params.toString()}`)
  }

  const controlClass = 'h-9 w-[calc(50%-0.25rem)] sm:w-40'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.routeGroup} onValueChange={(v) => apply({ routeGroup: v })}>
        <SelectTrigger className={controlClass} aria-label="Filter by route group">
          <SelectValue />
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

      <Popover open={accountOpen} onOpenChange={setAccountOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={accountOpen}
            aria-label="Filter by account"
            className={cn(controlClass, 'justify-between font-normal')}
          >
            <span className="truncate">{selectedAccountName}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search accounts…" />
            <CommandList>
              <CommandEmpty>No account found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all accounts"
                  onSelect={() => {
                    setAccountOpen(false)
                    apply({ account: 'all' })
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      filters.account === 'all' ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  All accounts
                </CommandItem>
                {accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.name}
                    onSelect={() => {
                      setAccountOpen(false)
                      apply({ account: account.id })
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        filters.account === account.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{account.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Select value={filters.crew} onValueChange={(v) => apply({ crew: v })}>
        <SelectTrigger className={controlClass} aria-label="Filter by crew member">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All crew</SelectItem>
          {crewEmployees.map((emp) => (
            <SelectItem key={emp.id} value={emp.id}>
              {emp.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(v) => apply({ status: v })}>
        <SelectTrigger className={controlClass} aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCHEDULE_STATUS_FILTERS.map((status) => (
            <SelectItem key={status} value={status}>
              {SCHEDULE_STATUS_FILTER_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveScheduleFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-muted-foreground"
          onClick={() => router.push(`/management/schedule?week=${week}`)}
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
