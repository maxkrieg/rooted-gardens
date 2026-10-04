'use client'

import React, { useState } from 'react'
import { format, parseISO, addWeeks, addDays, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getWeekStart } from '@/lib/utils/schedule'

interface ScheduleNavProps {
  windowStart: string // ISO date — the Monday of the week on screen
  /** Week paging as client state: a router push would be a network round-trip. */
  onWeekChange: (weekStart: string) => void
}

export function ScheduleNav({ windowStart, onWeekChange }: ScheduleNavProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  const windowStartDate = parseISO(windowStart)
  const currentWeekStart = getWeekStart(new Date())
  const isCurrentWeekVisible = isSameDay(currentWeekStart, windowStartDate)

  function goToWeek(weekStart: string) {
    onWeekChange(weekStart)
  }

  function navigate(weeks: number) {
    goToWeek(format(addWeeks(windowStartDate, weeks), 'yyyy-MM-dd'))
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    goToWeek(format(getWeekStart(date), 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  const weekLabel = `${format(windowStartDate, 'MMM d')} – ${format(addDays(windowStartDate, 6), 'MMM d')}`

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-tour="schedule.weekNav">
      {!isCurrentWeekVisible && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs"
          onClick={() => goToWeek(format(currentWeekStart, 'yyyy-MM-dd'))}
        >
          Today
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(-1)}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="font-display text-sm font-medium text-foreground px-1 min-w-[120px] text-center">
        {weekLabel}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(1)}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Open calendar">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end" collisionPadding={8}>
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
    </div>
  )
}
