'use client'

import React, { useState } from 'react'
import { format, parseISO, addWeeks, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { formatWeekRange, getWeekStart } from '@/lib/utils/schedule'
import { cn } from '@/lib/utils'

/** The schedule's date, phone and desktop: Fraunces in tracked caps, like a date stamped on a field sheet. */
export const DATE_STAMP =
  'font-display text-[15px] font-semibold uppercase tracking-[0.04em] tabular-nums'

interface ScheduleNavProps {
  windowStart: string // ISO date — the Monday of the week on screen
  /** Week paging as client state: a router push would be a network round-trip. */
  onWeekChange: (weekStart: string) => void
  /** 'today' shows today's date in place of the pager, as the phone header does. */
  mode?: 'week' | 'today'
}

/** The desktop toolbar's pager. The dates open the calendar; This week shows once you've left it. */
export function ScheduleNav({ windowStart, onWeekChange, mode = 'week' }: ScheduleNavProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  const windowStartDate = parseISO(windowStart)
  const currentWeekStart = getWeekStart(new Date())
  const isCurrentWeekVisible = isSameDay(currentWeekStart, windowStartDate)

  function navigate(weeks: number) {
    onWeekChange(format(addWeeks(windowStartDate, weeks), 'yyyy-MM-dd'))
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    onWeekChange(format(getWeekStart(date), 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  if (mode === 'today') {
    return (
      <span className={cn(DATE_STAMP, 'px-1 text-foreground')} data-tour="schedule.weekNav">
        {format(new Date(), 'EEE MMM d')}
      </span>
    )
  }

  const weekLabel = formatWeekRange(windowStartDate)

  return (
    <div className="flex items-center gap-1" data-tour="schedule.weekNav">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(-1)}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              DATE_STAMP,
              'h-9 rounded-lg px-2 text-foreground transition-colors hover:bg-secondary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label={`Week of ${weekLabel}. Open calendar`}
          >
            {weekLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start" collisionPadding={8}>
          <Calendar
            mode="single"
            selected={windowStartDate}
            onSelect={handleCalendarSelect}
            defaultMonth={windowStartDate}
            weekStartsOn={1}
            style={{ '--cell-size': '3rem' } as React.CSSProperties}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(1)}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentWeekVisible && (
        <Button
          variant="outline"
          size="sm"
          className="ml-1 h-9 text-xs"
          onClick={() => onWeekChange(format(currentWeekStart, 'yyyy-MM-dd'))}
        >
          This week
        </Button>
      )}
    </div>
  )
}
