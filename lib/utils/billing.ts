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

/** Deep link to an invoice in QuickBooks Online by its QBO invoice id. */
export function qboInvoiceUrl(qboInvoiceId: string): string {
  return `https://app.qbo.intuit.com/app/invoice?txnId=${qboInvoiceId}`
}

/** Deep link to a customer in QuickBooks Online by its QBO customer id. */
export function qboCustomerUrl(qboCustomerId: string): string {
  return `https://app.qbo.intuit.com/app/customerdetail?nameId=${qboCustomerId}`
}

export type AccountGroup = {
  account: Account
  visits: VisitWithLocation[]
}

/**
 * Clusters uninvoiced visits by account only (not by month) — one group per
 * account, which maps to exactly one QBO invoice per account when pushed. The
 * owner now decides which visits land on which invoice (via the account-row
 * "bazooka" push or the per-account selective drawer), so the queue no longer
 * force-splits a push by calendar month. Sorted by account name.
 */
export function groupVisitsByAccount(visits: VisitWithLocation[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>()
  for (const visit of visits) {
    const existing = map.get(visit.account.id)
    if (existing) {
      existing.visits.push(visit)
    } else {
      map.set(visit.account.id, { account: visit.account, visits: [visit] })
    }
  }
  return [...map.values()].sort((a, b) => a.account.name.localeCompare(b.account.name))
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
