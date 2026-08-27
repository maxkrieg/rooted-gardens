'use client'

import { useState } from 'react'
import { MoreHorizontal, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/app'

export interface RouteGroupStats {
  /** Visits done (completed or skipped) — the week's work that's settled. */
  done: number
  /** Every property in this group this week, scheduled or not. */
  total: number
  /** Distinct crew across the group's visits, completed-over-assigned per visit. */
  crew: Employee[]
  /** Distinct vehicle names across the group's visits. */
  vehicles: string[]
  /** Any visit in the group currently on site. */
  onSite: boolean
}

interface RouteGroupBandProps {
  name: string
  /** Standing days for the route ('mon'…'sun'), from its defaults. */
  days?: string[]
  stats: RouteGroupStats
  canEdit: boolean
  onAssignRoute: () => void
  onEditDefaults: () => void
  /** The week's dispatch note, rendered below the progress bar. */
  noteSlot?: React.ReactNode
}

/**
 * The header of a route group on the phone schedule.
 *
 * It used to hold a name and one ghost button. This is the screen's most
 * valuable strip — it's what the spreadsheet's colored block communicated at a
 * glance — so it now carries the dispatch state: who's on it, what they're
 * driving, and how far through the week the route is.
 *
 * Crew and truck are aggregated from the group's actual visits. Once route
 * groups carry defaults (R3.1) those become the fallback for a visit that
 * hasn't been assigned yet; until then an unassigned week reads as empty here,
 * which is honest.
 */
export function RouteGroupBand({
  name,
  days = [],
  stats,
  canEdit,
  onAssignRoute,
  onEditDefaults,
  noteSlot,
}: RouteGroupBandProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { done, total, crew, vehicles, onSite } = stats
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const shownCrew = crew.slice(0, 3)
  const overflow = crew.length - shownCrew.length

  return (
    <div className="rounded-t-xl border-b border-border bg-secondary text-secondary-foreground">
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-widest">
          {name}
          {days.length > 0 && (
            <span className="font-medium text-muted-foreground"> · {formatDays(days)}</span>
          )}
        </span>

        {onSite && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--clay)]"
            aria-label="A stop on this route is in progress"
          />
        )}

        {shownCrew.length > 0 && (
          <div className="flex shrink-0 -space-x-1" aria-label={crew.map((c) => c.name).join(', ')}>
            {shownCrew.map((emp) => (
              <span
                key={emp.id}
                title={emp.name}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-[9px] font-semibold uppercase text-muted-foreground ring-1 ring-border"
              >
                {initialsOf(emp.name)}
              </span>
            ))}
            {overflow > 0 && (
              <span className="flex h-5 items-center rounded-full bg-card px-1 text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                +{overflow}
              </span>
            )}
          </div>
        )}

        {vehicles.length > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Truck className="h-3 w-3 shrink-0" aria-hidden />
            <span className="max-w-20 truncate">
              {vehicles.length === 1 ? vehicles[0] : `${vehicles.length} trucks`}
            </span>
          </span>
        )}

        {/* Popover, not a dropdown-menu — the repo has no dropdown-menu
            primitive and one overflow menu doesn't justify a new dependency. */}
        {canEdit && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="-mr-2 h-8 w-8 shrink-0 text-secondary-foreground/70 hover:bg-secondary-foreground/10 hover:text-foreground"
                aria-label={`Actions for ${name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onAssignRoute()
                }}
                className="flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Assign route…
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onEditDefaults()
                }}
                className="flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Route defaults…
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* The progress bar is the at-a-glance signal the colored block gave him:
          how much of this route is settled, without reading a single row. */}
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-1.5">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary-foreground/15"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${done} of ${total} stops done on ${name}`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              done === total && total > 0 ? 'bg-primary' : 'bg-[var(--sap)]',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      {noteSlot}
    </div>
  )
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * `['tue','mon'] → 'Mon/Tue'`. Sorted into week order rather than the order they
 * were ticked, so the label reads the way the route sheet writes it.
 */
export function formatDays(days: string[]): string {
  return [...days]
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
    .join('/')
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}
