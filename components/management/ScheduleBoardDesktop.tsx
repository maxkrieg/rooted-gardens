'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, MousePointerClick, Sparkles, Sun } from 'lucide-react'
import { ScheduleWeekOverview } from '@/components/management/ScheduleWeekOverview'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { TodayView } from '@/components/management/TodayView'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import {
  ScheduleViewToggle,
  type ScheduleViewMode,
} from '@/components/management/ScheduleViewToggle'
import { CachedNotice } from '@/components/states/CachedNotice'
import { useNeedsYou } from '@/hooks/useNeedsYou'
import type { OpenVisit } from '@/hooks/useScheduleInteractions'
import { findVisitInWeeks, routeGroupStats } from '@/lib/utils/schedule'
import type { ScheduleFilterValues } from '@/lib/utils/schedule-filters'
import {
  UNGROUPED_SORT_KEY,
  type ScheduleSortMode,
  type ScheduleSortState,
} from '@/lib/utils/schedule-sort'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import { emitTourEvent } from '@/lib/onboarding/events'
import { cn } from '@/lib/utils'
import type { Employee, SchedulePropertyRow, ScheduleWeek, Vehicle } from '@/types/app'

interface ScheduleBoardDesktopProps {
  viewMode: ScheduleViewMode
  onViewModeChange: (mode: ScheduleViewMode) => void
  windowStart: string
  /** Week's week, filtered — the left pane's routes and the middle pane's stops. */
  week: ScheduleWeek | undefined
  /** The unfiltered window, for the route's Crew and Truck counts. */
  windowWeeks: ScheduleWeek[]
  /** Today's week (always the current one), filtered and not, for the Needs you count. */
  todayWeek: ScheduleWeek | undefined
  todayWeekUnfiltered: ScheduleWeek | undefined
  todayWeekStart: string
  /** Every loaded week, unfiltered: where `?visit=` and the open stop are looked up. */
  lookupWeeks: ScheduleWeek[]
  filters: ScheduleFilterValues
  filtered: boolean
  isStale: boolean
  employees: Employee[]
  vehicles: Vehicle[]
  dueCount: number | null
  onGenerate: () => void
  activeRoute: string | null
  onOpenRoute: (routeKey: string, weekStart?: string) => void
  onCloseRoute: () => void
  onShowWeek: (weekStart: string) => void
  selectMode: boolean
  onExitSelectMode: () => void
  onStartSelect: (() => void) | undefined
  sortState: ScheduleSortState
  onSortChange: (mode: ScheduleSortMode) => void
  initialVisitId: string | undefined
}

interface PaneState {
  visitId: string
  row: SchedulePropertyRow
  weekStart: string
}

/**
 * The schedule at `lg` and up, for office roles: routes → stops → stop, side by side, like a mail
 * client. The phone's navigation shown all at once, on the same URL state (`?route=`, `?visit=`).
 */
export function ScheduleBoardDesktop({
  viewMode,
  onViewModeChange,
  windowStart,
  week,
  windowWeeks,
  todayWeek,
  todayWeekUnfiltered,
  todayWeekStart,
  lookupWeeks,
  filters,
  filtered,
  isStale,
  employees,
  vehicles,
  dueCount,
  onGenerate,
  activeRoute,
  onOpenRoute,
  onCloseRoute,
  onShowWeek,
  selectMode,
  onExitSelectMode,
  onStartSelect,
  sortState,
  onSortChange,
  initialVisitId,
}: ScheduleBoardDesktopProps) {
  const middleRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<Element | null>(null)

  // The board fills the viewport below wherever it starts. Measured, not assumed: a tour offer
  // or the impersonation banner above it would otherwise push its bottom off-screen.
  const [boardTop, setBoardTop] = useState<number | null>(null)
  const boardRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const measure = () => setBoardTop(el.getBoundingClientRect().top + window.scrollY)
    measure()
    // Banners come and go above the board, and each one resizes the body.
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])
  const { items: needsYou } = useNeedsYou(todayWeek, todayWeekUnfiltered, todayWeekStart)

  const [pane, setPane] = useState<PaneState | null>(null)
  // `?visit=` opens in the right pane, once, when its week has loaded. Not DeepLinkedVisitSheet:
  // that would stack a sheet over the pane.
  const [deepLinkDone, setDeepLinkDone] = useState(!initialVisitId)
  if (!deepLinkDone && initialVisitId) {
    const found = findVisitInWeeks(lookupWeeks, initialVisitId)
    if (found) {
      setDeepLinkDone(true)
      setPane({ visitId: initialVisitId, ...found })
    }
  }
  // The cached row moves with realtime and edits; the stored one covers a visit that left the window.
  const paneRow = pane ? (findVisitInWeeks(lookupWeeks, pane.visitId)?.row ?? pane.row) : null

  const openVisit: OpenVisit = (row, visit, weekStart) => {
    returnFocus.current = document.activeElement
    setPane({ visitId: visit.id, row, weekStart })
    syncVisitUrlParam(visit.id, windowStart)
  }

  const closePane = useCallback(() => {
    setPane(null)
    syncVisitUrlParam(null)
    emitTourEvent('schedule.visitClosed')
    // Back to the stop that opened it, so ↑/↓ carries on from there.
    const el = returnFocus.current
    returnFocus.current = null
    if (el instanceof HTMLElement && el.isConnected) requestAnimationFrame(() => el.focus())
  }, [])

  // Picking from the left pane is choosing Week; a Today card keeps Today underneath, as on a phone.
  function pickRoute(routeKey: string) {
    if (pane) closePane()
    if (viewMode !== 'week') onViewModeChange('week')
    if (routeKey !== activeRoute) onOpenRoute(routeKey)
  }

  function changeView(mode: ScheduleViewMode) {
    if (pane) closePane()
    if (activeRoute) onCloseRoute()
    onViewModeChange(mode)
  }

  const paneOpen = pane !== null && paneRow !== null

  // ↑/↓ walk the middle pane's stops, Enter opens (the rows are buttons), Esc closes the pane.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target instanceof HTMLElement ? e.target : null
      // Leave typing, open dialogs and menus to themselves.
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return

      if (e.key === 'Escape' && paneOpen) {
        e.preventDefault()
        closePane()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      // From the stops, or straight after picking a route on the left.
      const middle = middleRef.current
      const fromLeft = Boolean(target && leftRef.current?.contains(target))
      if (!middle || (target && target !== document.body && !fromLeft && !middle.contains(target))) return
      const rows = [...middle.querySelectorAll<HTMLElement>('[data-stop-row]')]
      if (rows.length === 0) return
      e.preventDefault()
      const at = fromLeft ? -1 : rows.indexOf(document.activeElement as HTMLElement)
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next =
        at === -1 ? (step === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + step))
      rows[next].focus()
      rows[next].scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paneOpen, closePane])

  return (
    // A container, not a breakpoint: the left pane folds to a rail when the stop pane needs its room.
    <div
      ref={boardRef}
      className="@container flex min-h-[480px] gap-3"
      // 1.5rem is the page's lg:p-6 bottom padding.
      style={{
        height:
          boardTop === null
            ? 'calc(100dvh - var(--schedule-sticky-h, 0px) - 3.75rem)'
            : `calc(100dvh - ${boardTop}px - 1.5rem)`,
      }}
    >
      {/* Left: view, what needs you, every route this week. */}
      <aside
        ref={leftRef}
        aria-label="Routes"
        className={cn('flex shrink-0 flex-col overflow-y-auto', paneOpen ? 'w-14 @5xl:w-[280px]' : 'w-[280px]')}
      >
        <div className={cn('flex-col gap-3', paneOpen ? 'hidden @5xl:flex' : 'flex')}>
          <ScheduleViewToggle value={viewMode} onChange={changeView} />
          <NeedsYouCount
            count={needsYou.length}
            active={viewMode === 'today'}
            onOpen={() => changeView('today')}
          />
          <ScheduleWeekOverview
            week={week}
            vehicles={vehicles}
            filtered={filtered}
            dueCount={dueCount}
            onGenerate={onGenerate}
            onOpenRoute={pickRoute}
            activeRouteKey={viewMode === 'week' ? activeRoute : null}
            layout="pane"
          />
        </div>
        {paneOpen && (
          <RouteRail
            className="flex @5xl:hidden"
            viewMode={viewMode}
            onViewModeChange={changeView}
            needsYouCount={needsYou.length}
            dueCount={dueCount}
            onGenerate={onGenerate}
            week={week}
            vehicles={vehicles}
            activeRoute={viewMode === 'week' ? activeRoute : null}
            onOpenRoute={pickRoute}
          />
        )}
      </aside>

      {/* Middle: Today, or the open route's stops. */}
      <div
        ref={middleRef}
        className={cn(
          'min-w-0 flex-1 overflow-y-auto',
          viewMode === 'week' && 'rounded-2xl border border-border bg-card',
        )}
      >
        {viewMode === 'today' ? (
          <TodayView
            filters={filters}
            vehicles={vehicles}
            onOpenRoute={(routeKey, weekStart) => {
              if (pane) closePane()
              onOpenRoute(routeKey, weekStart)
            }}
            onShowWeek={onShowWeek}
            onOpenVisit={openVisit}
          />
        ) : activeRoute ? (
          <>
            {isStale && <CachedNotice className="m-3" />}
            <ScheduleListMobile
              layout="pane"
              week={week}
              windowWeeks={windowWeeks}
              employees={employees}
              vehicles={vehicles}
              filtered={filtered}
              selectMode={selectMode}
              onExitSelectMode={onExitSelectMode}
              sortState={sortState}
              onSortChange={onSortChange}
              routeGroupId={activeRoute}
              onBack={onCloseRoute}
              onStartSelect={onStartSelect}
              onOpenVisit={openVisit}
              activeVisitId={pane?.visitId}
            />
          </>
        ) : (
          <PickRoutePrompt />
        )}
      </div>

      {/* Right: the open stop. */}
      {pane && paneRow && (
        <div className="w-[360px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-warm @5xl:w-[420px]">
          <VisitDetailSheet
            inline
            open
            onOpenChange={(next) => !next && closePane()}
            row={paneRow}
            weekStart={pane.weekStart}
          />
        </div>
      )}
    </div>
  )
}

function NeedsYouCount({
  count,
  active,
  onOpen,
}: {
  count: number
  active: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        count > 0
          ? 'border-[var(--clay)]/30 bg-[var(--clay)]/10 text-[var(--clay)] hover:bg-[var(--clay)]/15'
          : 'border-border bg-card text-muted-foreground hover:bg-accent/50',
      )}
    >
      {count > 0 ? (
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      )}
      {count > 0 ? (
        <span>
          Needs you · <span className="tabular-nums">{count}</span>
        </span>
      ) : (
        <span>Nothing needs you</span>
      )}
    </button>
  )
}

/** The left pane folded to initials, so a 1024px laptop fits three panes without scrolling. */
function RouteRail({
  className,
  viewMode,
  onViewModeChange,
  needsYouCount,
  dueCount,
  onGenerate,
  week,
  vehicles,
  activeRoute,
  onOpenRoute,
}: {
  className?: string
  viewMode: ScheduleViewMode
  onViewModeChange: (mode: ScheduleViewMode) => void
  needsYouCount: number
  dueCount: number | null
  onGenerate: () => void
  week: ScheduleWeek | undefined
  vehicles: Vehicle[]
  activeRoute: string | null
  onOpenRoute: (routeKey: string) => void
}) {
  const railButton =
    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <nav aria-label="Routes" className={cn('flex-col items-center gap-1.5', className)}>
      <div
        role="tablist"
        aria-label="Schedule view"
        data-tour="schedule.viewToggle"
        className="flex flex-col gap-1 rounded-xl bg-secondary p-0.5"
      >
        {(
          [
            ['today', Sun],
            ['week', CalendarDays],
          ] as const
        ).map(([mode, Icon]) => (
          <button
            key={mode}
            role="tab"
            type="button"
            aria-selected={viewMode === mode}
            aria-label={mode === 'today' ? 'Today' : 'Week'}
            title={mode === 'today' ? 'Today' : 'Week'}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              railButton,
              'h-10 w-10',
              viewMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>

      {needsYouCount > 0 && (
        <button
          type="button"
          onClick={() => onViewModeChange('today')}
          aria-label={`Needs you: ${needsYouCount}`}
          title={`Needs you · ${needsYouCount}`}
          className={cn(railButton, 'bg-[var(--clay)]/10 text-[var(--clay)] tabular-nums hover:bg-[var(--clay)]/15')}
        >
          {needsYouCount}
        </button>
      )}

      {dueCount !== null && dueCount > 0 && (
        <button
          type="button"
          onClick={onGenerate}
          aria-label={`Generate week: ${dueCount} due`}
          title={`Generate week · ${dueCount} due`}
          className={cn(railButton, 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
        </button>
      )}

      <div className="my-1 h-px w-8 bg-border" aria-hidden />

      {week?.routeGroups.map(({ routeGroup, rows }, index) => {
        const { onSite, withoutCrew } = routeGroupStats(
          rows.map((row) => row.visit),
          vehicles,
        )
        const active = activeRoute === routeGroup.id
        return (
          <button
            key={routeGroup.id}
            type="button"
            data-tour={index === 0 ? 'schedule.routeBand' : undefined}
            onClick={() => onOpenRoute(routeGroup.id)}
            aria-label={`Open ${routeGroup.name}`}
            aria-current={active ? 'true' : undefined}
            title={routeGroup.name}
            className={cn(
              railButton,
              'font-display text-[13px]',
              active ? 'bg-secondary text-foreground ring-2 ring-foreground/70' : 'bg-card text-foreground hover:bg-secondary',
            )}
          >
            {initials(routeGroup.name)}
            {onSite && (
              <span className="absolute top-1 right-1 h-2 w-2 animate-pulse rounded-full bg-[var(--clay)]" aria-hidden />
            )}
            {!onSite && withoutCrew > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full border border-[var(--clay)]" aria-hidden />
            )}
          </button>
        )
      })}

      {week && week.ungrouped.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenRoute(UNGROUPED_SORT_KEY)}
          aria-label={`Open Not on a route (${week.ungrouped.length})`}
          aria-current={activeRoute === UNGROUPED_SORT_KEY ? 'true' : undefined}
          title={`Not on a route · ${week.ungrouped.length}`}
          className={cn(
            railButton,
            'bg-[var(--clay)]/10 text-[var(--clay)] tabular-nums',
            activeRoute === UNGROUPED_SORT_KEY && 'ring-2 ring-[var(--clay)]',
          )}
        >
          {week.ungrouped.length}
        </button>
      )}
    </nav>
  )
}

function PickRoutePrompt() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <MousePointerClick className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="font-display text-lg font-semibold text-foreground">Pick a route</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Its stops open here. <kbd className="font-sans font-semibold">↑</kbd>{' '}
        <kbd className="font-sans font-semibold">↓</kbd> move between them,{' '}
        <kbd className="font-sans font-semibold">Enter</kbd> opens one,{' '}
        <kbd className="font-sans font-semibold">Esc</kbd> closes it, and{' '}
        <kbd className="font-sans font-semibold">S</kbd> schedules an empty one without opening it.
      </p>
    </div>
  )
}

/** "New Hampshire" → "NH", "Wilder" → "Wi". */
function initials(name: string): string {
  const words = name.split(/[\s\-–·/]+/).filter((w) => /[A-Za-z0-9]/.test(w))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2)
  return (words[0][0] + words[1][0]).toUpperCase()
}
