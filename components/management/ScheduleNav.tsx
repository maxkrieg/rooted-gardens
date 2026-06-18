'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, addWeeks, isBefore, isAfter } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getWeekStart } from '@/lib/utils/schedule'

interface ScheduleNavProps {
  windowStart: string // ISO date — first Monday of the 4-week window
}

export function ScheduleNav({ windowStart }: ScheduleNavProps) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const windowStartDate = parseISO(windowStart)
  const windowEndDate = addWeeks(windowStartDate, 3) // last week shown
  const currentWeekStart = getWeekStart(new Date())

  const isCurrentWeekVisible =
    !isBefore(currentWeekStart, windowStartDate) &&
    !isAfter(currentWeekStart, windowEndDate)

  function navigate(weeks: number) {
    const next = format(addWeeks(windowStartDate, weeks), 'yyyy-MM-dd')
    router.push(`/management/schedule?week=${next}`)
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    const weekStart = format(getWeekStart(date), 'yyyy-MM-dd')
    router.push(`/management/schedule?week=${weekStart}`)
    setCalendarOpen(false)
  }

  const rangeLabel = `${format(windowStartDate, 'MMM d')} – ${format(addWeeks(windowStartDate, 3), 'MMM d')}`

  return (
    <div className="flex items-center gap-1.5">
      {!isCurrentWeekVisible && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => router.push('/management/schedule')}
        >
          Today
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(-1)}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="font-display text-sm font-medium text-foreground px-1 min-w-[120px] text-center">
        {rangeLabel}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(1)}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Open calendar">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
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
