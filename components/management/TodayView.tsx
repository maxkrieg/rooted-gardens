'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, Flag, WifiOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { GettingStartedCard } from '@/components/onboarding/GettingStartedCard'
import { NeedsYouList } from '@/components/management/NeedsYouList'
import { FieldActivityList } from '@/components/management/FieldActivityList'
import { GenerateWeekSheet } from '@/components/management/GenerateWeekSheet'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import {
  RouteCrewTruck,
  RouteDoneCount,
  RouteProgressBar,
  formatDays,
} from '@/components/management/RouteGroupBand'
import { CachedNotice } from '@/components/states/CachedNotice'
import { SectionError } from '@/components/states/ErrorState'
import { SectionSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagementSchedule, scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import { useGenerateWeek } from '@/hooks/useGenerateWeek'
import { useWeekNotes } from '@/hooks/useWeekNotes'
import { useScheduleInteractions, type OpenVisit } from '@/hooks/useScheduleInteractions'
import { useNeedsYou } from '@/hooks/useNeedsYou'
import { useIsOnline } from '@/hooks/use-hydrated'
import {
  fieldActivity,
  getWeekStart,
  routeGroupStats,
  routesRunningToday,
  weekdayKey,
  type RunningRoute,
  type ScheduleException,
} from '@/lib/utils/schedule'
import { filterScheduleWeeks, type ScheduleFilterValues } from '@/lib/utils/schedule-filters'
import { DEFAULT_SCHEDULE_SORT } from '@/lib/utils/schedule-sort'
import { formatElapsed } from '@/lib/utils/visits'
import { cn } from '@/lib/utils'
import type { SchedulePropertyRow, Vehicle } from '@/types/app'

interface TodayViewProps {
  filters: ScheduleFilterValues
  vehicles: Vehicle[]
  /** A route group id or UNGROUPED_SORT_KEY, opened in this week's route drill-in. */
  onOpenRoute: (routeKey: string, weekStart: string) => void
  onShowWeek: (weekStart: string) => void
  /** The desktop board shows stops in its right pane. Absent, Today opens its own sheet. */
  onOpenVisit?: OpenVisit
}

/**
 * Run the day: what needs you, the routes out today, what crews sent back. Always the current
 * week, from the schedule's cached query, so it works offline and stays live through realtime.
 */
export function TodayView({
  filters,
  vehicles,
  onOpenRoute,
  onShowWeek,
  onOpenVisit,
}: TodayViewProps) {
  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => format(getWeekStart(today), 'yyyy-MM-dd'), [today])
  const weekStarts = useMemo(() => [weekStart], [weekStart])
  const isOnline = useIsOnline()
  const queryClient = useQueryClient()

  const { weeks, isLoading, isError, isStale, hasData } = useManagementSchedule(weekStarts)
  const week = useMemo(() => filterScheduleWeeks(weeks, filters)[0], [weeks, filters])
  const { data: weekNotes = [] } = useWeekNotes(weekStart)
  // Sheet state, drive order, and the 30s tick that keeps the on-site timers moving.
  const { orderRows, sheetOpen, sheetRow, sheetWeek, openSheet, handleSheetOpenChange } =
    useScheduleInteractions({
      selectMode: false,
      sortState: DEFAULT_SCHEDULE_SORT,
      windowStart: weekStart,
      onOpenVisit,
    })
  const { items: needsYou, markSeen, plan } = useNeedsYou(week, weeks[0], weekStart)
  const generateWeek = useGenerateWeek(weekStart)
  const [generateOpen, setGenerateOpen] = useState(false)

  if (isLoading && !hasData) return <TodaySkeleton />

  const failed = isError && !hasData
  const activity = fieldActivity(week)
  const { running, otherCount } = routesRunningToday(week, weekdayKey(today), orderRows)
  // Realtime writes bump this too, so it's "when we last heard", which is what offline needs.
  const lastHeardAt = queryClient.getQueryState(scheduleVisitsKey(weekStart))?.dataUpdatedAt

  function openException(item: ScheduleException) {
    if (item.kind === 'noCrew') return onOpenRoute(item.routeKey, weekStart)
    if (item.kind === 'dueUnscheduled') return setGenerateOpen(true)
    if (item.kind !== 'longOnSite') markSeen(item.visit)
    openSheet(item.row, item.visit, weekStart)
  }

  return (
    <div className="lg:max-w-3xl">
      <h1 className="mb-3 font-display text-xl font-semibold text-foreground">
        {format(today, 'EEE MMM d')}
      </h1>

      <GettingStartedCard className="mb-6" />

      {isStale && <CachedNotice />}

      {failed ? (
        <SectionError
          title="Today didn't load."
          hint="It'll be back once the connection recovers."
        />
      ) : (
        // -mx-4 cancels page padding so the lists run edge to edge on a phone, like Week.
        <div className="-mx-4 flex flex-col gap-5 lg:mx-0">
          <NeedsYouList items={needsYou} onOpen={openException} />

          <section aria-labelledby="running-today-heading">
            <h2
              id="running-today-heading"
              className="px-4 pb-1.5 text-xs font-semibold uppercase tracking-widest text-foreground"
            >
              Running today
            </h2>
            {running.length === 0 ? (
              <p className="px-4 py-2 text-[13px] text-muted-foreground">
                No routes run on {format(today, 'EEEE')}s. A route&rsquo;s days are set in its
                Route defaults.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 px-4">
                {running.map((route) => (
                  <RunningRouteCard
                    key={route.key}
                    route={route}
                    vehicles={vehicles}
                    note={
                      route.routeGroup
                        ? (weekNotes.find((n) => n.route_group_id === route.routeGroup!.id)?.note ??
                          null)
                        : null
                    }
                    isOnline={isOnline}
                    lastHeardAt={lastHeardAt}
                    onOpen={() => onOpenRoute(route.key, weekStart)}
                  />
                ))}
              </div>
            )}
            {otherCount > 0 && (
              <button
                type="button"
                onClick={() => onShowWeek(weekStart)}
                className="mt-1 flex min-h-11 w-full items-center gap-1 px-4 text-left text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                Other routes this week · {otherCount}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </section>

          <FieldActivityList
            items={activity}
            onOpen={({ row, visit }) => {
              markSeen(visit)
              openSheet(row, visit, weekStart)
            }}
          />
        </div>
      )}

      <GenerateWeekSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        weekStart={weekStart}
        decisions={plan.decisions}
        isLoading={plan.isLoading}
        isError={plan.isError}
        onConfirm={generateWeek}
      />

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          row={sheetRow}
          weekStart={sheetWeek}
        />
      )}
    </div>
  )
}

function RunningRouteCard({
  route,
  vehicles,
  note,
  isOnline,
  lastHeardAt,
  onOpen,
}: {
  route: RunningRoute
  vehicles: Vehicle[]
  note: string | null
  isOnline: boolean
  lastHeardAt: number | undefined
  onOpen: () => void
}) {
  const { routeGroup, rows, now, next } = route
  const stats = routeGroupStats(
    rows.map((row) => row.visit),
    vehicles,
  )
  const name = routeGroup?.name ?? 'Not on a route'
  const days = routeGroup?.default_days ?? []
  const scheduled = stats.total - stats.unscheduled
  const allSettled = scheduled > 0 && stats.done === scheduled

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${name}`}
      className={cn(
        'flex w-full flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-warm',
        'transition-colors hover:bg-accent/40 active:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'truncate font-display text-[16px] font-semibold leading-snug',
            routeGroup ? 'text-foreground' : 'text-[var(--clay)]',
          )}
        >
          {name}
        </span>
        {days.length > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            {formatDays(days)}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <RouteDoneCount done={stats.done} total={stats.total} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      </span>

      {(stats.crew.length > 0 || stats.vehicles.length > 0) && (
        <span className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
          <RouteCrewTruck crew={stats.crew} vehicles={stats.vehicles} />
        </span>
      )}

      <RouteProgressBar
        done={stats.done}
        total={stats.total}
        name={name}
        className="rounded-full bg-primary/15"
      />

      {note && (
        <span className="flex min-w-0 items-start gap-1 text-[12px] leading-snug text-[var(--clay)]">
          <Flag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-1">{note}</span>
        </span>
      )}

      <span className="flex flex-col gap-1 text-[13px] leading-snug">
        {now.length > 0 && (
          <NowLine
            row={now[0]}
            rows={rows}
            more={now.length - 1}
            isOnline={isOnline}
            lastHeardAt={lastHeardAt}
          />
        )}
        {next ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next
            </span>
            <span className="truncate text-foreground">{stopLabel(next, rows)}</span>
          </span>
        ) : allSettled ? (
          <span className="text-[12px] font-medium text-primary">Every stop settled</span>
        ) : scheduled === 0 ? (
          <span className="text-[12px] text-muted-foreground">Nothing scheduled this week</span>
        ) : null}
      </span>
    </button>
  )
}

/** On site now. Offline it says when we last heard, rather than ticking a clock over stale data. */
function NowLine({
  row,
  rows,
  more,
  isOnline,
  lastHeardAt,
}: {
  row: SchedulePropertyRow
  rows: SchedulePropertyRow[]
  more: number
  isOnline: boolean
  lastHeardAt: number | undefined
}) {
  const startedAt = row.visit?.started_at
  if (!startedAt) return null
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--clay)]">
          Now
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground">
          {stopLabel(row, rows)}
          {more > 0 && <span className="text-muted-foreground"> +{more} more</span>}
        </span>
        {isOnline && (
          <span className="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-[var(--clay)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--clay)]" aria-hidden />
            {formatElapsed(startedAt)}
          </span>
        )}
      </span>
      {!isOnline && (
        <span className="ml-[46px] flex items-center gap-1 text-[12px] text-muted-foreground">
          <WifiOff className="h-3 w-3 shrink-0" aria-hidden />
          {lastHeardAt
            ? `Last seen on site at ${format(lastHeardAt, 'h:mm a')}`
            : 'Last seen on site'}
        </span>
      )}
    </span>
  )
}

/** The account, or its address when the account has more than one stop on the route. */
function stopLabel(row: SchedulePropertyRow, rows: SchedulePropertyRow[]): string {
  const shared = rows.filter((r) => r.account.id === row.account.id).length > 1
  return shared ? `${row.account.name} · ${row.property.address}` : row.account.name
}

function TodaySkeleton() {
  return (
    <div className="space-y-6 lg:max-w-3xl">
      <Skeleton className="h-7 w-32" />
      <SectionSkeleton rows={2} />
      <SectionSkeleton rows={3} height="h-[120px]" />
    </div>
  )
}
