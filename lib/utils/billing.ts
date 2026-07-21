import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subDays,
} from 'date-fns'
import type { Account, VisitWithLocation } from '@/types/app'

export type AccountMonthGroup = {
  account: Account
  monthKey: string // 'yyyy-MM', from the visit's completion date
  monthLabel: string // 'May 2026'
  visits: VisitWithLocation[]
}

function completionMonthKey(visit: VisitWithLocation): string {
  return format(parseISO(visit.ended_at ?? visit.week_start), 'yyyy-MM')
}

/**
 * Clusters uninvoiced visits by (account, completion month) — the owner invoices
 * monthly, so a push must never combine two different months' visits into one
 * invoice (that would under-bill a contract account, whose flat rate is per
 * period, not per push). Sorted oldest-month-first, then by account name, so
 * the Queue can render one flat list and drop a divider whenever `monthKey`
 * changes between consecutive groups, with no separate nested structure.
 */
export function groupVisitsByAccountMonth(visits: VisitWithLocation[]): AccountMonthGroup[] {
  const map = new Map<string, AccountMonthGroup>()
  for (const visit of visits) {
    const monthKey = completionMonthKey(visit)
    const key = `${visit.account.id}::${monthKey}`
    const existing = map.get(key)
    if (existing) {
      existing.visits.push(visit)
    } else {
      map.set(key, {
        account: visit.account,
        monthKey,
        monthLabel: format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
        visits: [visit],
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    a.monthKey !== b.monthKey
      ? a.monthKey.localeCompare(b.monthKey)
      : a.account.name.localeCompare(b.account.name),
  )
}

export const DATE_RANGE_PRESETS = [
  'this_month',
  'last_month',
  'last_7_days',
  'this_year',
  'custom',
] as const
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_7_days: 'Last 7 days',
  this_year: 'This year',
  custom: 'Custom range',
}

export interface ResolvedDateRange {
  preset: DateRangePreset
  start: Date
  end: Date
  label: string
  /** Only set for `custom` — the raw 'yyyy-MM-dd' inputs, so the filter UI can
   *  restore exactly what the owner typed rather than round-tripping through Date. */
  customStart?: string
  customEnd?: string
}

/**
 * Resolves the History tab's date-range filter (replaces the old single-month
 * paging) from URL search params. `range` defaults to `this_month` — same
 * default window the tab always had. `start`/`end` (yyyy-MM-dd) only matter
 * when `range=custom`.
 */
export function resolveDateRange(params: {
  range?: string
  start?: string
  end?: string
}): ResolvedDateRange {
  const now = new Date()
  const preset: DateRangePreset = (DATE_RANGE_PRESETS as readonly string[]).includes(
    params.range ?? '',
  )
    ? (params.range as DateRangePreset)
    : 'this_month'

  switch (preset) {
    case 'last_month': {
      const lastMonth = subMonths(now, 1)
      return {
        preset,
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        label: format(lastMonth, 'MMMM yyyy'),
      }
    }
    case 'last_7_days': {
      return {
        preset,
        start: subDays(now, 7),
        end: now,
        label: DATE_RANGE_PRESET_LABELS.last_7_days,
      }
    }
    case 'this_year': {
      return {
        preset,
        start: startOfYear(now),
        end: endOfYear(now),
        label: format(now, 'yyyy'),
      }
    }
    case 'custom': {
      const start = params.start ? parseISO(params.start) : startOfMonth(now)
      const end = params.end ? parseISO(params.end) : endOfMonth(now)
      return {
        preset,
        start,
        end,
        label: `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`,
        customStart: params.start,
        customEnd: params.end,
      }
    }
    default: {
      return {
        preset: 'this_month',
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: format(now, 'MMMM yyyy'),
      }
    }
  }
}
