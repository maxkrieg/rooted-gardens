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
  onEditNote: () => void
  hasNote: boolean
  /** The week's note, when there is one. Absent notes render nothing. */
  noteSlot?: React.ReactNode
}

/**
 * The header of a route group on the phone schedule.
 *
 * Two text rows, not three. The name owns the first line outright — it's the
 * identity of the block and was being truncated to make room for avatars — and
 * the standing plan (days, crew, truck) drops to a muted second line that
 * disappears entirely when nothing is set.
 *
 * The progress bar became the band's bottom border: a 3px strip that doubles as
 * the divider above the stops. It was costing a full row to say what a hairline
 * says, and this is the "how much of this route is settled" signal the coloured
 * spreadsheet block gave at a glance.
 *
 * Crew and truck are aggregated from the group's actual visits. Once a visit
 * carries no assignment the route's defaults (R3.1) are the fallback.
 */
export function RouteGroupBand({
  name,
  days = [],
  stats,
  canEdit,
  onAssignRoute,
  onEditDefaults,
  onEditNote,
  hasNote,
  noteSlot,
}: RouteGroupBandProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { done, total, crew, vehicles, onSite } = stats
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const shownCrew = crew.slice(0, 3)
  const overflow = crew.length - shownCrew.length
  const hasPlan = days.length > 0 || crew.length > 0 || vehicles.length > 0

  return (
    <div className="rounded-t-xl bg-secondary text-secondary-foreground">
      <div className="flex items-center gap-2 px-4 pt-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-widest">
          {name}
        </span>

        {onSite && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--clay)]"
            aria-label="A stop on this route is in progress"
          />
        )}

        <span
          className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground"
          aria-label={`${done} of ${total} stops done`}
        >
          {done}/{total}
        </span>

        {/* Popover, not a dropdown-menu — the repo has no dropdown-menu
            primitive and one overflow menu doesn't justify a new dependency. */}
        {canEdit && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="-mr-2 h-7 w-7 shrink-0 text-secondary-foreground/70 hover:bg-secondary-foreground/10 hover:text-foreground"
                aria-label={`Actions for ${name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1">
              <MenuItem label="Assign route…" onClick={() => { setMenuOpen(false); onAssignRoute() }} />
              <MenuItem
                label={hasNote ? 'Edit this week’s note…' : 'Add a note for this week…'}
                onClick={() => { setMenuOpen(false); onEditNote() }}
              />
              <MenuItem label="Route defaults…" onClick={() => { setMenuOpen(false); onEditDefaults() }} />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* The standing plan, muted and secondary. Omitted rather than rendered
          empty — an unplanned route shouldn't pay a row to say nothing. */}
      {hasPlan && (
        <div className="flex items-center gap-2 px-4 pb-2 pt-0.5 text-[11px] text-muted-foreground">
          {days.length > 0 && <span className="shrink-0 font-medium">{formatDays(days)}</span>}

          {shownCrew.length > 0 && (
            <span
              className="flex shrink-0 items-center gap-1"
              aria-label={crew.map((c) => c.name).join(', ')}
            >
              {shownCrew.map((emp) => (
                <span key={emp.id} title={emp.name}>
                  {initialsOf(emp.name)}
                </span>
              ))}
              {overflow > 0 && <span>+{overflow}</span>}
            </span>
          )}

          {vehicles.length > 0 && (
            <span className="flex min-w-0 items-center gap-1">
              <Truck className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">
                {vehicles.length === 1 ? vehicles[0] : `${vehicles.length} trucks`}
              </span>
            </span>
          )}
        </div>
      )}

      {!hasPlan && <div className="pb-1.5" />}

      {noteSlot}

      {/* The progress bar IS the divider. A full row for a bar plus a number was
          the most expensive whitespace on the screen. */}
      <div
        className="h-[3px] w-full bg-secondary-foreground/15"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${done} of ${total} stops done on ${name}`}
      >
        <div
          className={cn(
            'h-full transition-[width] duration-300',
            done === total && total > 0 ? 'bg-primary' : 'bg-[var(--sap)]',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
    >
      {label}
    </button>
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
