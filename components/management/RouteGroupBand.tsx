'use client'

import { useState } from 'react'
import { MoreHorizontal, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { RouteGroupStats } from '@/lib/utils/schedule'
import type { Employee } from '@/types/app'

export type { RouteGroupStats }

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
  /** The route's own sort switch. Lives on the plan line rather than the title
   *  row: the title row has no width to spare, and "how this route is arranged"
   *  is exactly what that line already says. */
  sortSlot?: React.ReactNode
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
  sortSlot,
}: RouteGroupBandProps) {
  const { done, total, crew, vehicles, onSite } = stats
  const hasPlan = days.length > 0 || crew.length > 0 || vehicles.length > 0

  return (
    // Same heading treatment as the desktop grid's route row: sage band, a
    // forest spine, and the name in Fraunces rather than a tracked caps label.
    <div className="bg-accent text-accent-foreground shadow-[inset_3px_0_0_0_var(--primary)]">
      <div className="flex items-center gap-2 pl-5 pr-4 pt-2.5">
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold leading-tight text-foreground">
          {name}
        </span>

        {onSite && <OnSiteDot />}

        <RouteDoneCount done={done} total={total} />

        {canEdit && (
          <RouteGroupMenu
            name={name}
            items={[
              { label: 'Assign route…', onClick: onAssignRoute },
              {
                label: hasNote ? 'Edit this week’s note…' : 'Add a note for this week…',
                onClick: onEditNote,
              },
              { label: 'Route defaults…', onClick: onEditDefaults },
            ]}
          />
        )}
      </div>

      {/* The standing plan, muted and secondary. It used to be omitted entirely
          when a route had no plan — an unplanned route shouldn't pay a row to
          say nothing — but the sort switch belongs on this line, and every route
          has a sort. So the row renders whenever it has either to show. */}
      {(hasPlan || sortSlot) && (
        <div className="flex items-center gap-2 pl-5 pr-4 pb-2 pt-1 text-[11px] text-accent-foreground">
          {days.length > 0 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-semibold">
              {formatDays(days)}
            </span>
          )}
          <RouteCrewTruck crew={crew} vehicles={vehicles} />
          {sortSlot && <span className="ml-auto -mr-1.5">{sortSlot}</span>}
        </div>
      )}

      {!hasPlan && !sortSlot && <div className="pb-1.5" />}

      {noteSlot}

      {/* The progress bar IS the divider. A full row for a bar plus a number was
          the most expensive whitespace on the screen. */}
      <RouteProgressBar done={done} total={total} name={name} className="bg-primary/15" />
    </div>
  )
}

// ─── Pieces shared with the desktop grid's per-week route header cells ──────

export function OnSiteDot() {
  return (
    <span
      className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--clay)]"
      aria-label="A stop on this route is in progress"
    />
  )
}

function RouteDoneCount({ done, total }: { done: number; total: number }) {
  return (
    <span
      className="flex shrink-0 items-baseline tabular-nums"
      aria-label={`${done} of ${total} stops done`}
    >
      <span
        className={cn(
          'font-display text-[15px] font-semibold leading-none',
          total > 0 && done === total ? 'text-primary' : 'text-foreground',
        )}
      >
        {done}
      </span>
      <span className="ml-0.5 text-[11px] font-medium text-accent-foreground/70">/{total}</span>
    </span>
  )
}

/** Crew initials and truck. Renders nothing when neither is set. */
export function RouteCrewTruck({ crew, vehicles }: { crew: Employee[]; vehicles: string[] }) {
  const shownCrew = crew.slice(0, 3)
  const overflow = crew.length - shownCrew.length
  return (
    <>
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
    </>
  )
}

export function RouteProgressBar({
  done,
  total,
  name,
  className,
}: {
  done: number
  total: number
  name: string
  className?: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div
      className={cn('h-[3px] w-full bg-secondary-foreground/15', className)}
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
  )
}

/** The route's ⋯ menu. Popover, not a dropdown-menu — the repo has no
 *  dropdown-menu primitive and one overflow menu doesn't justify a dependency. */
export function RouteGroupMenu({
  name,
  items,
}: {
  name: string
  items: Array<{ label: string; onClick: () => void }>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="-mr-2 h-7 w-7 shrink-0 text-accent-foreground/70 hover:bg-primary/10 hover:text-accent-foreground"
          aria-label={`Actions for ${name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {items.map((item) => (
          <MenuItem
            key={item.label}
            label={item.label}
            onClick={() => {
              setMenuOpen(false)
              item.onClick()
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
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
