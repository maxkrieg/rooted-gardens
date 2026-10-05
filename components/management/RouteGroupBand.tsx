'use client'

import { useState } from 'react'
import { ChevronLeft, MoreHorizontal, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { emitTourEvent } from '@/lib/onboarding/events'
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
}

/**
 * Route header on the phone schedule: name on line one, the muted plan (days, crew, truck) on
 * line two, and a 3px progress strip as the bottom border. Crew and truck come from the visits,
 * falling back to the route's defaults.
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
  const { done, total, crew, vehicles, onSite } = stats

  return (
    // Stone band, not sage: green is kept for progress and done, so a header never reads as success.
    <div className="bg-secondary text-muted-foreground">
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

      <RoutePlanLine days={days} crew={crew} vehicles={vehicles} />

      {noteSlot}

      {/* The progress bar IS the divider. A full row for a bar plus a number was
          the most expensive whitespace on the screen. */}
      <RouteProgressBar done={done} total={total} name={name} className="bg-foreground/10" />
    </div>
  )
}

/**
 * The route view's header: back to the week, the route's name over its plan (days, crew, truck —
 * the week when there's no plan), a trailing control, and done/total, over the progress bar.
 * One 56px row, the most the ≤56px chrome rule allows, so the name can be a size up.
 */
export function RouteViewHeader({
  name,
  weekLabel,
  done,
  total,
  onSite,
  onBack,
  plan,
  trailing,
  tone = 'route',
}: {
  name: string
  weekLabel: string
  plan?: { days: string[]; crew: Employee[]; vehicles: string[] }
  /** e.g. the sort switch, before the done count. */
  trailing?: React.ReactNode
  done: number
  total: number
  onSite: boolean
  onBack: () => void
  /** 'unrouted' is the clay "Not on a route" bucket. */
  tone?: 'route' | 'unrouted'
}) {
  const unrouted = tone === 'unrouted'
  const hasPlan =
    !!plan && (plan.days.length > 0 || plan.crew.length > 0 || plan.vehicles.length > 0)
  return (
    // Sticky, so both tones must be opaque: the clay tint sits on a card-coloured base.
    <div
      className={cn(
        unrouted
          ? 'bg-card bg-linear-to-r from-[var(--clay)]/10 to-[var(--clay)]/10 text-[var(--clay)]'
          // Stone, not the list's card: the header reads as chrome above the stops, not a row.
          : 'bg-secondary text-muted-foreground',
      )}
    >
      <div className="flex h-14 items-center gap-1 pr-4">
        <button
          type="button"
          data-tour="schedule.routeBack"
          onClick={onBack}
          className="flex h-11 shrink-0 items-center gap-0.5 rounded-lg pl-2 pr-2.5 text-sm font-semibold transition-colors text-foreground hover:bg-foreground/5 active:bg-foreground/10"
          aria-label="Back to the week"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
          Week
        </button>
        <span className="min-w-0 flex-1">
          {/* A size up from the stop names (15px), so the route reads as their heading. */}
          <span className="block truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {name}
          </span>
          {hasPlan ? (
            <span className="flex min-w-0 items-center gap-2 text-[11px] leading-tight" title={weekLabel}>
              {plan.days.length > 0 && (
                <span className="shrink-0 font-semibold text-foreground/80">{formatDays(plan.days)}</span>
              )}
              <RouteCrewTruck crew={plan.crew} vehicles={plan.vehicles} />
            </span>
          ) : (
            <span className="block truncate text-[11px] leading-tight opacity-80">{weekLabel}</span>
          )}
        </span>
        {onSite && <OnSiteDot />}
        {trailing}
        {!unrouted && <RouteDoneCount done={done} total={total} />}
      </div>
      {!unrouted && (
        <RouteProgressBar done={done} total={total} name={name} className="bg-foreground/10" />
      )}
    </div>
  )
}

// ─── Pieces shared with the route view header, the overview and Today ──────

/** Days, crew and truck under a route's name. Keeps a little bottom space when there's no plan. */
export function RoutePlanLine({
  days,
  crew,
  vehicles,
}: {
  days: string[]
  crew: Employee[]
  vehicles: string[]
}) {
  const hasPlan = days.length > 0 || crew.length > 0 || vehicles.length > 0
  if (!hasPlan) return <div className="pb-1.5" />
  return (
    <div className="flex items-center gap-2 pl-5 pr-4 pb-2 pt-1 text-[11px] text-muted-foreground">
      {days.length > 0 && <DaysPill days={days} />}
      <RouteCrewTruck crew={crew} vehicles={vehicles} />
    </div>
  )
}

/** The route's standing days. An outline, not a fill: it's the plan, not a state. */
export function DaysPill({ days }: { days: string[] }) {
  return (
    <span className="shrink-0 rounded-full border border-foreground/15 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {formatDays(days)}
    </span>
  )
}

export function OnSiteDot() {
  return (
    <span
      className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--clay)]"
      aria-label="A stop on this route is in progress"
    />
  )
}

export function RouteDoneCount({ done, total }: { done: number; total: number }) {
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
      <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">/{total}</span>
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
    <Popover
      open={menuOpen}
      onOpenChange={(next) => {
        setMenuOpen(next)
        if (next) emitTourEvent('schedule.routeMenuOpened')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          data-tour="schedule.routeMenu"
          size="icon"
          variant="ghost"
          className="-mr-2 h-7 w-7 shrink-0 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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

/** `['tue','mon'] → 'Mon/Tue'`, in week order like the route sheet. */
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
