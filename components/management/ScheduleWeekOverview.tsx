'use client'

import { ChevronRight, Flag, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import {
  OnSiteDot,
  RouteCrewTruck,
  RouteDoneCount,
  RouteProgressBar,
  formatDays,
} from '@/components/management/RouteGroupBand'
import { useWeekNotes } from '@/hooks/useWeekNotes'
import { routeGroupStats, type RouteGroupStats } from '@/lib/utils/schedule'
import { UNGROUPED_SORT_KEY } from '@/lib/utils/schedule-sort'
import { cn } from '@/lib/utils'
import type { ScheduleWeek, Vehicle } from '@/types/app'

interface ScheduleWeekOverviewProps {
  /** The week on screen, already filtered. */
  week: ScheduleWeek | undefined
  vehicles: Vehicle[]
  filtered?: boolean
  /** Properties `planWeek` says are due and not yet on the week. Null hides the CTA. */
  dueCount: number | null
  onGenerate: () => void
  /** A route group id, or UNGROUPED_SORT_KEY for "Not on a route". */
  onOpenRoute: (routeKey: string) => void
  /** The route open beside it on the desktop board, marked current. */
  activeRouteKey?: string | null
  /** 'pane' = the desktop board's left column: a rounded card instead of a full-bleed list. */
  layout?: 'page' | 'pane'
}

/**
 * The phone Week view for seeDashboard roles: one row per route, then drill in. Replaces "every
 * property at once" — the stop rows live one tap down, in ScheduleListMobile's route view.
 */
export function ScheduleWeekOverview({
  week,
  vehicles,
  filtered,
  dueCount,
  onGenerate,
  onOpenRoute,
  activeRouteKey = null,
  layout = 'page',
}: ScheduleWeekOverviewProps) {
  const { data: weekNotes = [] } = useWeekNotes(week?.weekStart ?? '')
  const inPane = layout === 'pane'

  const cta =
    dueCount !== null && dueCount > 0 ? (
      <div className={cn('pb-3', !inPane && 'px-4')}>
        <Button
          data-tour="schedule.generateCta"
          className="h-12 w-full gap-2 text-[15px]"
          onClick={onGenerate}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate week · {dueCount} due
        </Button>
      </div>
    ) : null

  if (!week || (week.routeGroups.length === 0 && week.ungrouped.length === 0)) {
    return (
      <>
        {cta}
        <div className={cn(!inPane && 'px-4')}>
          <ScheduleEmptyState filtered={filtered} />
        </div>
      </>
    )
  }

  return (
    <>
      {cta}
      <div
        className={cn(
          'bg-card',
          inPane ? 'overflow-hidden rounded-2xl border border-border' : 'border-y border-border',
        )}
      >
        {week.routeGroups.map(({ routeGroup, rows }, index) => (
          <RouteOverviewRow
            key={routeGroup.id}
            // The tour's band step points at the first route; one anchor is enough.
            tourAnchor={index === 0}
            name={routeGroup.name}
            days={routeGroup.default_days ?? []}
            stats={routeGroupStats(
              rows.map((row) => row.visit),
              vehicles,
            )}
            note={weekNotes.find((n) => n.route_group_id === routeGroup.id)?.note ?? null}
            showTopBorder={index > 0}
            active={activeRouteKey === routeGroup.id}
            onOpen={() => onOpenRoute(routeGroup.id)}
          />
        ))}

        {week.ungrouped.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenRoute(UNGROUPED_SORT_KEY)}
            aria-current={activeRouteKey === UNGROUPED_SORT_KEY ? 'true' : undefined}
            className={cn(
              'flex min-h-14 w-full items-center gap-3 bg-[var(--clay)]/10 px-4 py-3 text-left text-[var(--clay)]',
              'transition-[filter] hover:brightness-[0.97] active:brightness-[0.94]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              week.routeGroups.length > 0 && 'border-t border-[var(--clay)]/30',
              activeRouteKey === UNGROUPED_SORT_KEY && 'bg-[var(--clay)]/20',
            )}
          >
            <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-widest">
              Not on a route · {week.ungrouped.length}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </>
  )
}

function RouteOverviewRow({
  tourAnchor,
  name,
  days,
  stats,
  note,
  showTopBorder,
  active,
  onOpen,
}: {
  tourAnchor: boolean
  name: string
  days: string[]
  stats: RouteGroupStats
  note: string | null
  showTopBorder: boolean
  active: boolean
  onOpen: () => void
}) {
  const { done, total, crew, vehicles, onSite, unscheduled, withoutCrew } = stats
  // Progress only means something once the week has started moving.
  const started = done > 0
  const stopsLabel = `${total} ${total === 1 ? 'stop' : 'stops'}`
  const scheduledLabel =
    total === 0 || unscheduled === 0
      ? null
      : unscheduled === total
        ? 'none scheduled'
        : `${unscheduled} not scheduled`

  return (
    <button
      type="button"
      data-tour={tourAnchor ? 'schedule.routeBand' : undefined}
      onClick={onOpen}
      aria-label={`Open ${name}`}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'relative flex min-h-14 w-full items-center gap-3 py-3 pl-4 pr-3 text-left',
        'transition-colors hover:bg-accent/50 active:bg-accent',
        active && 'bg-accent shadow-[inset_3px_0_0_0_var(--primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        showTopBorder && 'border-t border-border/60',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-[15px] font-semibold leading-snug text-foreground">
            {name}
          </span>
          {days.length > 0 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              {formatDays(days)}
            </span>
          )}
          {onSite && <OnSiteDot />}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            {stopsLabel}
            {scheduledLabel && ` · ${scheduledLabel}`}
          </span>
          {withoutCrew > 0 && (
            <span className="shrink-0 font-medium text-[var(--clay)] tabular-nums">
              {withoutCrew} without crew
            </span>
          )}
          <RouteCrewTruck crew={crew} vehicles={vehicles} />
        </span>

        {note && (
          <span className="mt-0.5 flex min-w-0 items-start gap-1 text-[12px] leading-snug text-[var(--clay)]">
            <Flag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="line-clamp-1">{note}</span>
          </span>
        )}
      </span>

      {started && <RouteDoneCount done={done} total={total} />}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

      {started && (
        <RouteProgressBar
          done={done}
          total={total}
          name={name}
          className="absolute inset-x-0 bottom-0 bg-transparent"
        />
      )}
    </button>
  )
}
