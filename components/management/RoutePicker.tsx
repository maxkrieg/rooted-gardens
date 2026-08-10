'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
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
import type { RouteGroup } from '@/types/app'

interface RoutePickerProps {
  routeGroups: RouteGroup[]
  /** Route group id currently selected, if any — shown checked in the list. */
  value?: string | null
  onSelect: (routeGroupId: string) => void
  label?: string
  disabled?: boolean
  className?: string
}

/**
 * Searchable route-group combobox — the same Popover + Command shape as the
 * account filter in ScheduleFilterBar.tsx, reused wherever a property needs
 * to be pointed at a route group (the Unrouted panel's per-slip picker and
 * its bulk selection bar). Portaling is safe here: unlike CrewMultiSelect,
 * this never renders inside a modal Sheet.
 */
export function RoutePicker({
  routeGroups,
  value,
  onSelect,
  label = 'Put on a route',
  disabled,
  className,
}: RoutePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || routeGroups.length === 0}
          className={cn('h-11 gap-1.5 text-xs font-normal justify-between', className)}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search routes…" />
          <CommandList>
            <CommandEmpty>No route group found.</CommandEmpty>
            <CommandGroup>
              {routeGroups.map((rg) => (
                <CommandItem
                  key={rg.id}
                  value={rg.name}
                  onSelect={() => {
                    setOpen(false)
                    onSelect(rg.id)
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === rg.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{rg.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
