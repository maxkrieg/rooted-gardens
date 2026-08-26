'use client'

import React, { useState } from 'react'
import { addDays, addWeeks, format, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getWeekStart } from '@/lib/utils/schedule'
import { cn } from '@/lib/utils'

interface ScheduleHeaderMobileProps {
  /** ISO Monday of the single week the phone list renders. */
  weekStart: string
  onWeekChange: (weekStart: string) => void
  /** Drives the badge on the filter button; 0 hides it. */
  activeFilterCount: number
  onOpenFilters: () => void
  /** Week-level actions behind `⋯`. Empty hides the button entirely. */
  overflowActions?: Array<{ label: string; onClick: () => void }>
}

/**
 * The whole phone schedule header, in one 48px row.
 *
 * It replaces ~200px of stacked chrome: an `<h1>` repeating what the nav tab
 * already says, four filter dropdowns wrapping to two rows, a four-button week
 * nav, and a week-range link duplicating the range beside it. The filters moved
 * behind the button on the right — they're set occasionally and read never,
 * which is the wrong trade for permanent vertical space on a phone held in one
 * hand in a truck.
 */
export function ScheduleHeaderMobile({
  weekStart,
  onWeekChange,
  activeFilterCount,
  onOpenFilters,
  overflowActions = [],
}: ScheduleHeaderMobileProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const weekStartDate = parseISO(weekStart)
  const isCurrentWeek = isSameDay(weekStartDate, getWeekStart(new Date()))
  const label = `${format(weekStartDate, 'MMM d')} – ${format(addDays(weekStartDate, 6), 'MMM d')}`

  function navigate(weeks: number) {
    onWeekChange(format(addWeeks(weekStartDate, weeks), 'yyyy-MM-dd'))
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    onWeekChange(format(getWeekStart(date), 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  return (
    <div className="flex h-12 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-9 shrink-0"
        onClick={() => navigate(-1)}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {/* The label is the calendar trigger — a separate calendar button was a
          fourth target in a row that has no width to spare. */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-secondary active:bg-secondary"
            aria-label={`Week of ${label}. Open calendar`}
          >
            <span className="block truncate font-display text-[15px] font-semibold tabular-nums text-foreground">
              {label}
            </span>
            {!isCurrentWeek && (
              <span className="block text-[10px] leading-none text-muted-foreground">
                not this week
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="center" collisionPadding={8}>
          <Calendar
            mode="single"
            selected={weekStartDate}
            onSelect={handleCalendarSelect}
            defaultMonth={weekStartDate}
            weekStartsOn={1}
            style={{ '--cell-size': '3rem' } as React.CSSProperties}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-9 shrink-0"
        onClick={() => navigate(1)}
        aria-label="Next week"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Getting back to the current week is one tap from any week, but only
          costs width when you've actually navigated away from it. */}
      {!isCurrentWeek && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 px-2.5 text-xs"
          onClick={() => onWeekChange(format(getWeekStart(new Date()), 'yyyy-MM-dd'))}
        >
          Today
        </Button>
      )}

      <Button
        variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
        size="icon"
        className={cn('relative h-10 w-10 shrink-0', activeFilterCount > 0 && 'text-foreground')}
        onClick={onOpenFilters}
        aria-label={
          activeFilterCount > 0
            ? `Filters — ${activeFilterCount} active`
            : 'Filter the schedule'
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

      {overflowActions.length > 0 && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-9 shrink-0"
              aria-label="More schedule actions"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1">
            {overflowActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  action.onClick()
                }}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {action.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
