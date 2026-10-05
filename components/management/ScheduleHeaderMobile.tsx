'use client'

import React, { useState } from 'react'
import { addWeeks, format, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { formatWeekRange, getWeekStart } from '@/lib/utils/schedule'
import { ScheduleFilterButton } from '@/components/management/ScheduleFilterButton'
import { DATE_STAMP as STAMP } from '@/components/management/ScheduleNav'
import {
  ScheduleViewToggle,
  type ScheduleViewMode,
} from '@/components/management/ScheduleViewToggle'
import { emitTourEvent } from '@/lib/onboarding/events'
import { cn } from '@/lib/utils'

interface ScheduleHeaderMobileProps {
  /** ISO Monday of the single week the phone list renders. */
  weekStart: string
  onWeekChange: (weekStart: string) => void
  /** Drives the badge on the filter button; 0 hides it. */
  activeFilterCount: number
  onOpenFilters: () => void
  /** Week-level actions behind `⋯`. */
  overflowActions?: Array<{ label: string; onClick: () => void }>
  /** `Today | Week` in the row (office roles, not on a route). Filters then move into `⋯`. */
  view?: { mode: ScheduleViewMode; onChange: (mode: ScheduleViewMode) => void }
}

/**
 * The whole phone schedule header in one 48px row: the week pager (or today's date on Today),
 * the view toggle, and `⋯`. Without the toggle there's room for the filter button itself.
 */
export function ScheduleHeaderMobile({
  weekStart,
  onWeekChange,
  activeFilterCount,
  onOpenFilters,
  overflowActions = [],
  view,
}: ScheduleHeaderMobileProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const weekStartDate = parseISO(weekStart)
  const thisWeek = format(getWeekStart(new Date()), 'yyyy-MM-dd')
  const isCurrentWeek = isSameDay(weekStartDate, parseISO(thisWeek))
  const label = formatWeekRange(weekStartDate)
  const onToday = view?.mode === 'today'

  function navigate(weeks: number) {
    onWeekChange(format(addWeeks(weekStartDate, weeks), 'yyyy-MM-dd'))
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    onWeekChange(format(getWeekStart(date), 'yyyy-MM-dd'))
    setCalendarOpen(false)
  }

  const menuItems = view
    ? [
        {
          label: activeFilterCount > 0 ? `Filters (${activeFilterCount})…` : 'Filters…',
          onClick: onOpenFilters,
        },
        ...(!onToday && !isCurrentWeek
          ? [{ label: 'Go to this week', onClick: () => onWeekChange(thisWeek) }]
          : []),
        ...overflowActions,
      ]
    : overflowActions

  return (
    <div className="flex h-12 items-center gap-1" data-tour="schedule.weekNav">
      {onToday ? (
        <span className={cn(STAMP, 'min-w-0 flex-1 truncate pl-1 text-foreground')}>
          {format(new Date(), 'EEE MMM d')}
        </span>
      ) : (
        <>
          {/* Plain buttons, 32 wide × 44 tall: icon Buttons force 44 square on touch, and this
              row has no width to spare once the toggle is in it. */}
          <PagerButton label="Previous week" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </PagerButton>

          {/* The label is the calendar trigger: a separate calendar button wouldn't fit. */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-lg px-0.5 py-1.5 text-center transition-colors hover:bg-secondary active:bg-secondary"
                aria-label={`Week of ${label}. Open calendar`}
              >
                <span className={cn(STAMP, 'block truncate text-foreground')}>{label}</span>
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

          <PagerButton label="Next week" onClick={() => navigate(1)}>
            <ChevronRight className="h-5 w-5" />
          </PagerButton>
        </>
      )}

      {view ? (
        <ScheduleViewToggle value={view.mode} onChange={view.onChange} size="compact" />
      ) : (
        <>
          {/* Back to the current week, only when you've left it. */}
          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-2.5 text-xs"
              onClick={() => onWeekChange(thisWeek)}
            >
              This week
            </Button>
          )}
          <ScheduleFilterButton activeFilterCount={activeFilterCount} onClick={onOpenFilters} />
        </>
      )}

      {menuItems.length > 0 && (
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
              className="relative h-10 w-9 shrink-0"
              aria-label={
                view && activeFilterCount > 0
                  ? `More schedule actions. ${activeFilterCount} filters on`
                  : 'More schedule actions'
              }
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
              {/* Filters live in here when the toggle takes their place, so say when one is on. */}
              {view && activeFilterCount > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1" data-tour="schedule.actionsMenu">
            {menuItems.map((action) => (
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

function PagerButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-8 shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}
