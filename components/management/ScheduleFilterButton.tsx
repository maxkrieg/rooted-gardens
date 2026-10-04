'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Opens ScheduleFilterSheet. Filters are set occasionally, so they don't get permanent space. */
export function ScheduleFilterButton({
  activeFilterCount,
  onClick,
  className,
}: {
  /** Drives the badge; 0 hides it. */
  activeFilterCount: number
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
      size="icon"
      className={cn('relative h-10 w-10 shrink-0', activeFilterCount > 0 && 'text-foreground', className)}
      onClick={onClick}
      data-tour="schedule.filters"
      aria-label={
        activeFilterCount > 0 ? `Filters — ${activeFilterCount} active` : 'Filter the schedule'
      }
    >
      <SlidersHorizontal className="h-[18px] w-[18px]" />
      {activeFilterCount > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background"
        >
          {activeFilterCount}
        </span>
      )}
    </Button>
  )
}
