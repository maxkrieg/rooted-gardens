'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, addWeeks, addDays, isBefore, isAfter } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getWeekStart } from '@/lib/utils/schedule'
import { scheduleFilterParams, type ScheduleFilterValues } from '@/lib/utils/schedule-filters'

interface ScheduleNavProps {
  windowStart: string // ISO date — first Monday of the 4-week window
  /** Carried through every navigation so changing week never drops the filters. */
  filters: ScheduleFilterValues
}

export function ScheduleNav({ windowStart, filters }: ScheduleNavProps) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const windowStartDate = parseISO(windowStart)
  const windowEndDate = addWeeks(windowStartDate, 3) // last week shown
  const currentWeekStart = getWeekStart(new Date())

  const isCurrentWeekVisible =
    !isBefore(currentWeekStart, windowStartDate) &&
    !isAfter(currentWeekStart, windowEndDate)

  function goToWeek(weekStart: string) {
    const params = scheduleFilterParams(filters, weekStart)
    router.push(`/management/schedule?${params.toString()}`)
  }

  function navigate(weeks: number) {
    goToWeek(format(addWeeks(windowStartDate, weeks), 'yyyy-MM-dd'))
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    goToWeek(format(getWeekStart(date), 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  const rangeLabel = `${format(windowStartDate, 'MMM d')} – ${format(addWeeks(windowStartDate, 3), 'MMM d')}`
  const singleWeekLabel = `${format(windowStartDate, 'MMM d')} – ${format(addDays(windowStartDate, 6), 'MMM d')}`

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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

      {/* Desktop: 4-week window range */}
      <span className="hidden lg:inline font-display text-sm font-medium text-foreground px-1 min-w-[120px] text-center">
        {rangeLabel}
      </span>
      {/* Mobile: single week */}
      <span className="lg:hidden font-display text-sm font-medium text-foreground px-1 text-center">
        {singleWeekLabel}
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
