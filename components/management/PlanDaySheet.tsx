'use client'

import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { CadenceBadge } from '@/components/management/badges'
import { formatDays } from '@/components/management/RouteGroupBand'
import { dayName } from '@/components/management/DayPicker'
import { useBulkScheduleActions, type BulkResult } from '@/hooks/useBulkScheduleActions'
import { sortRowsByPriority, weekdayKey } from '@/lib/utils/schedule'
import { UNGROUPED_SORT_KEY } from '@/lib/utils/schedule-sort'
import type { RouteGroup, ScheduleWeek, SchedulePropertyRow } from '@/types/app'

type Target = 'today' | 'tomorrow'

interface PlanDaySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current week, unfiltered: planning shouldn't silently skip filtered-out stops. */
  week: ScheduleWeek | undefined
  today: Date
  lastVisitByProperty: Record<string, string> | undefined
}

/**
 * The daily way to set days: tick what runs today or tomorrow from what's left this week.
 * Lists stops with no day, carried over, or already on the target; anything planned later stays put.
 */
export function PlanDaySheet({ open, onOpenChange, week, today, lastVisitByProperty }: PlanDaySheetProps) {
  const todayISO = format(today, 'yyyy-MM-dd')
  const tomorrowDate = addDays(today, 1)
  // Tomorrow only while it's still this week: a visit can't be planned outside its week.
  const hasTomorrow = week ? format(tomorrowDate, 'yyyy-MM-dd') <= format(addDays(parseISO(week.weekStart), 6), 'yyyy-MM-dd') : false
  const [chosenTarget, setTarget] = useState<Target>('tomorrow')
  const target: Target = hasTomorrow ? chosenTarget : 'today'
  const targetDate = target === 'today' ? today : tomorrowDate
  const targetISO = format(targetDate, 'yyyy-MM-dd')
  const targetDay = weekdayKey(targetDate)

  const groups = useMemo(() => {
    if (!week) return []
    const buckets: Array<{ key: string; routeGroup: RouteGroup | null; rows: SchedulePropertyRow[] }> = [
      ...week.routeGroups.map(({ routeGroup, rows }) => ({ key: routeGroup.id, routeGroup, rows })),
      { key: UNGROUPED_SORT_KEY, routeGroup: null, rows: week.ungrouped },
    ]
    return (
      buckets
        .map((bucket) => ({
          ...bucket,
          rows: sortRowsByPriority(
            bucket.rows.filter(({ visit }) => {
              if (visit?.status !== 'scheduled' || visit.started_at) return false
              return !visit.planned_date || visit.planned_date <= targetISO
            }),
            lastVisitByProperty,
            today,
          ),
        }))
        .filter((bucket) => bucket.rows.length > 0)
        // Routes that run on the target day first, then the rest in their usual order.
        .sort(
          (a, b) =>
            Number(Boolean(b.routeGroup?.default_days?.includes(targetDay))) -
            Number(Boolean(a.routeGroup?.default_days?.includes(targetDay))),
        )
    )
  }, [week, targetISO, targetDay, lastVisitByProperty, today])

  const allRows = groups.flatMap((g) => g.rows)
  const onTarget = new Set(
    allRows.filter((row) => row.visit?.planned_date === targetISO).map((row) => row.property.id),
  )
  // Ticks the user changed, as a diff from what's already on the target; reset per target.
  const [toggled, setToggled] = useState<{ target: string; ids: Set<string> }>({ target: '', ids: new Set() })
  const changedIds = toggled.target === targetISO ? toggled.ids : new Set<string>()
  const isChecked = (id: string) => onTarget.has(id) !== changedIds.has(id)

  const bulk = useBulkScheduleActions()
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    const next = new Set(changedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setToggled({ target: targetISO, ids: next })
  }

  const checkedCount = allRows.filter((row) => isChecked(row.property.id)).length
  const adds = allRows.filter((row) => changedIds.has(row.property.id) && !onTarget.has(row.property.id))
  const clears = allRows.filter((row) => changedIds.has(row.property.id) && onTarget.has(row.property.id))
  const dayLabel = target === 'today' ? 'today' : dayName(targetDay)

  async function save() {
    if (!week) return
    setSaving(true)
    try {
      const results: BulkResult[] = []
      const weekStart = week.weekStart
      if (adds.length > 0) {
        results.push(await bulk.setPlannedDay(adds.map((row) => ({ row, weekStart })), targetDay))
      }
      if (clears.length > 0) {
        results.push(await bulk.setPlannedDay(clears.map((row) => ({ row, weekStart })), null))
      }
      const undos = results.flatMap((r) => (r.undo ? [r.undo] : []))
      setToggled({ target: '', ids: new Set() })
      onOpenChange(false)
      toast.success(`${checkedCount} ${checkedCount === 1 ? 'stop' : 'stops'} on ${dayLabel}.`, {
        action:
          undos.length > 0
            ? {
                label: 'Undo',
                onClick: () => {
                  void Promise.all(undos.map((undo) => undo())).catch(() =>
                    toast.error('Could not undo', { description: 'The reversal is queued and will retry.' }),
                  )
                },
              }
            : undefined,
      })
    } catch (err) {
      toast.error('Some days did not save', {
        description: toUserMessage(err, 'They are queued and will retry.', '[PlanDaySheet.save]'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
          <SheetTitle className="font-display text-lg">
            Plan {target === 'today' ? 'today' : 'tomorrow'} · {format(targetDate, 'EEE MMM d')}
          </SheetTitle>
          <SheetDescription className="text-[13px]">
            What&rsquo;s left this week with no day, or carried over. Most overdue first.
          </SheetDescription>
          {hasTomorrow && (
            <div role="radiogroup" aria-label="Which day" className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
              {(['today', 'tomorrow'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={target === value}
                  onClick={() => setTarget(value)}
                  className={cn(
                    'h-10 rounded-md text-sm font-semibold transition-colors',
                    target === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {value === 'today' ? 'Today' : `Tomorrow · ${format(tomorrowDate, 'EEE')}`}
                </button>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Every stop left this week already has a day.
            </p>
          ) : (
            groups.map(({ key, routeGroup, rows }) => (
              <section key={key} aria-label={routeGroup?.name ?? 'Not on a route'}>
                <div className="flex items-center gap-2 bg-secondary/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="truncate text-foreground/80">{routeGroup?.name ?? 'Not on a route'}</span>
                  {routeGroup?.default_days && routeGroup.default_days.length > 0 && (
                    <span className="shrink-0 font-medium normal-case tracking-normal">
                      {formatDays(routeGroup.default_days)}
                    </span>
                  )}
                  <span className="ml-auto tabular-nums">{rows.length}</span>
                </div>
                {rows.map((row) => (
                  <PlanRow
                    key={row.property.id}
                    row={row}
                    checked={isChecked(row.property.id)}
                    flag={planFlag(row.visit?.planned_date ?? null, todayISO, targetISO)}
                    lastVisitOn={lastVisitByProperty?.[row.property.id] ?? null}
                    onToggle={() => toggle(row.property.id)}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <div className="border-t border-border bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3">
          <Button
            className="h-12 w-full text-[15px]"
            disabled={saving || changedIds.size === 0}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : `Put ${checkedCount} on ${dayLabel}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Why a stop with a day is on this list: it's overdue, or it's today's and could move to tomorrow. */
function planFlag(plannedDate: string | null, todayISO: string, targetISO: string): string | null {
  if (!plannedDate || plannedDate === targetISO) return null
  if (plannedDate < todayISO) return `Carried over from ${dayName(weekdayKey(parseISO(plannedDate)))}`
  return 'Planned today'
}

function PlanRow({
  row,
  checked,
  flag,
  lastVisitOn,
  onToggle,
}: {
  row: SchedulePropertyRow
  checked: boolean
  flag: string | null
  lastVisitOn: string | null
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex min-h-14 w-full items-start gap-3 border-t border-border/50 px-4 py-2.5 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        checked && 'bg-accent/40',
      )}
    >
      <CheckIndicator checked={checked} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-display text-[15px] font-semibold leading-snug text-foreground">
          {row.account.name}
        </span>
        <span className="truncate text-[13px] leading-snug text-muted-foreground">{row.property.address}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <CadenceBadge property={row.property} lastVisitOn={lastVisitOn} showDays />
          {flag && <span className="font-semibold text-[var(--clay)]">{flag}</span>}
        </span>
      </span>
    </button>
  )
}
