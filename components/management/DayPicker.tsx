'use client'

import { format, parseISO } from 'date-fns'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DAY_KEYS, plannedDateFor } from '@/lib/utils/schedule'

/** `'tue'` → `'Tue'`. */
export function dayName(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

interface DayPickerOptionsProps {
  weekStart: string
  /** The route's `default_days`: offered first and large. Empty = every day is equal. */
  routeDays: string[]
  /** The day it's set to now; null = any day. Undefined when there's no single answer. */
  current?: string | null
  onPick: (day: string | null) => void
}

/** The day choices behind the stop chip and the bulk Day action. */
export function DayPickerOptions({ weekStart, routeDays, current, onPick }: DayPickerOptionsProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const primary = DAY_KEYS.filter((day) => routeDays.includes(day))
  const others = DAY_KEYS.filter((day) => !routeDays.includes(day))

  function option(day: string, large: boolean) {
    const date = plannedDateFor(weekStart, day)!
    const selected = current === day
    return (
      <button
        key={day}
        type="button"
        onClick={() => onPick(day)}
        aria-pressed={selected}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          large ? 'h-16 border-border' : 'h-12 border-border/60',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : large
              ? 'bg-card text-foreground hover:bg-secondary'
              : 'bg-transparent text-muted-foreground hover:bg-secondary',
        )}
      >
        <span className={cn('font-display font-semibold', large ? 'text-lg' : 'text-sm')}>
          {dayName(day)}
        </span>
        <span className={cn('text-[11px] tabular-nums', !selected && 'text-muted-foreground')}>
          {date === today ? 'Today' : format(parseISO(date), 'MMM d')}
        </span>
        {selected && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5" aria-hidden />}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {primary.length > 0 && (
        <div className="grid grid-cols-3 gap-2">{primary.map((day) => option(day, true))}</div>
      )}
      <div className="space-y-1.5">
        {primary.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Not a route day
          </p>
        )}
        <div className="grid grid-cols-4 gap-2">{others.map((day) => option(day, false))}</div>
      </div>
      <button
        type="button"
        onClick={() => onPick(null)}
        aria-pressed={current === null}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-[15px] font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          current === null
            ? 'border-primary text-primary'
            : 'border-border text-muted-foreground hover:bg-secondary',
        )}
      >
        {current === null && <Check className="h-4 w-4" aria-hidden />}
        Any day this week
      </button>
    </div>
  )
}

/** One stop's day, from the chip on its row. */
export function DayPickerSheet({
  open,
  onOpenChange,
  title,
  ...options
}: DayPickerOptionsProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <DayPickerOptions {...options} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
