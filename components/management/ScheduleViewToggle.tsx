'use client'

import { cn } from '@/lib/utils'

export type ScheduleViewMode = 'today' | 'week'

/** `Today | Week` — the dashboard folded into the schedule. */
export function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: ScheduleViewMode
  onChange: (value: ScheduleViewMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Schedule view"
      data-tour="schedule.viewToggle"
      className="flex gap-1 rounded-lg bg-secondary p-1"
    >
      {(['today', 'week'] as const).map((mode) => (
        <button
          key={mode}
          role="tab"
          type="button"
          aria-selected={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'min-h-9 flex-1 rounded-md text-sm font-semibold capitalize transition-colors',
            value === mode
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}
