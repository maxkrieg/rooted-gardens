'use client'

import React, { useState } from 'react'
import { addDays, addWeeks, format, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getWeekStart } from '@/lib/utils/schedule'
import { ScheduleFilterButton } from '@/components/management/ScheduleFilterButton'
import { emitTourEvent } from '@/lib/onboarding/events'

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
 * The whole phone schedule header in one 48px row. Filters sit behind the right-hand button:
 * set occasionally, not worth permanent space.
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
    <div className="flex h-12 items-center gap-1" data-tour="schedule.weekNav">
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

      <ScheduleFilterButton activeFilterCount={activeFilterCount} onClick={onOpenFilters} />

      {overflowActions.length > 0 && (
        <Popover
          open={menuOpen}
          onOpenChange={(next) => {
            setMenuOpen(next)
            if (next) emitTourEvent('schedule.menuOpened')
          }}
        >
          <PopoverTrigger asChild>
            <Button
              data-tour="schedule.actions"
              variant="ghost"
              size="icon"
              className="h-10 w-9 shrink-0"
              aria-label="More schedule actions"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1" data-tour="schedule.actionsMenu">
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
