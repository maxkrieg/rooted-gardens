'use server'

import {
  startOfYear,
  endOfYear,
  format,
  parseISO,
  differenceInCalendarWeeks,
  addWeeks,
  isAfter,
  isBefore,
} from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getWeekStart, getWeeksInRange } from '@/lib/utils/schedule'
import { expectedVisitsForFrequency } from '@/lib/utils/reports'

/** How many trailing weeks the crew report covers. */
const CREW_WINDOW_WEEKS = 12

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Revenue by month — invoiced vs. paid
 * ──────────────────────────────────────────────────────────────────────────── */

export interface MonthlyRevenue {
  /** Short month label for the x-axis, e.g. "Jan". */
  label: string
  /** Full label for the tooltip and table view, e.g. "January 2026". */
  fullLabel: string
  /** Sum of invoices pushed to QBO in this month (`invoices.created_at`). */
  invoiced: number
  /** Sum of invoices QBO reported paid in this month (`invoices.paid_at`). */
  paid: number
}

/**
 * Twelve zero-filled Jan–Dec buckets for `year`, each carrying both the amount
 * invoiced and the amount collected.
 *
 * The query has to span *two* date columns because an invoice pushed in
 * December and paid in January belongs to both years — filtering on
 * `created_at` alone would silently drop that payment from the paid series.
 *
 * `invoices.amount` is the authoritative total for every billing type
 * (per_visit invoices already carry price x visit count; contract invoices
 * carry the flat rate), so a plain sum is correct with no per-billing-type
 * special-casing — see docs/INVOICING.md.
 */
export interface RevenueReport {
  months: MonthlyRevenue[]
  /** True when the query failed — see the note on CrewVisitsReport.loadError. */
  loadError?: boolean
}

export async function getRevenueByMonth(year: number): Promise<RevenueReport> {
  const supabase = await createClient()
  const start = startOfYear(new Date(year, 0, 1))
  const end = endOfYear(new Date(year, 0, 1))
  const s = start.toISOString()
  const e = end.toISOString()

  const months: MonthlyRevenue[] = Array.from({ length: 12 }, (_, i) => ({
    label: format(new Date(year, i, 1), 'MMM'),
    fullLabel: format(new Date(year, i, 1), 'MMMM yyyy'),
    invoiced: 0,
    paid: 0,
  }))

  const { data, error } = await supabase
    .from('invoices')
    .select('amount, created_at, paid_at')
    .or(
      `and(created_at.gte.${s},created_at.lte.${e}),and(paid_at.gte.${s},paid_at.lte.${e})`,
    )

  if (error) {
    console.error('[getRevenueByMonth]', error)
    return { months, loadError: true }
  }

  for (const row of (data ?? []) as {
    amount: number | null
    created_at: string
    paid_at: string | null
  }[]) {
    const amount = Number(row.amount ?? 0)

    const created = new Date(row.created_at)
    if (created.getFullYear() === year) {
      months[created.getMonth()].invoiced += amount
    }

    if (row.paid_at) {
      const paid = new Date(row.paid_at)
      if (paid.getFullYear() === year) {
        months[paid.getMonth()].paid += amount
      }
    }
  }

  return { months }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Completed visits per crew member, per week
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CrewWeeklyVisits {
  employeeId: string
  name: string
  total: number
  /** One entry per week in the window, oldest first, zero-filled. */
  weeks: { label: string; count: number }[]
}

export interface CrewVisitsReport {
  crew: CrewWeeklyVisits[]
  windowLabel: string
  /** Max weekly count across all crew — the shared y-scale for small multiples. */
  maxWeekly: number
  /** Query failed — the page says so instead of drawing a chart of zeroes,
   *  which would claim nobody did any work this year. */
  loadError?: boolean
}

/**
 * Completed visits per crew member across the trailing 12 weeks of `year`
 * (for a past year, that year's final 12 weeks).
 *
 * Credit follows `visit_crew.relation = 'completed'`, not `'assigned'` — who
 * actually did the work, matching how crew are displayed everywhere else in
 * the app. A visit worked by two people counts once for each, which is the
 * intended reading of "who's doing the most work".
 */
export async function getVisitsPerCrewByWeek(year: number): Promise<CrewVisitsReport> {
  const supabase = await createClient()

  // Anchor the window at this week for the current year, at the year's last
  // week for a past one, so a historical year shows its real end-of-season.
  const yearEndWeek = getWeekStart(endOfYear(new Date(year, 0, 1)))
  const thisWeek = getWeekStart(new Date())
  const lastWeek = isBefore(yearEndWeek, thisWeek) ? yearEndWeek : thisWeek
  const firstWeek = addWeeks(lastWeek, -(CREW_WINDOW_WEEKS - 1))

  const weekStarts = getWeeksInRange(firstWeek, lastWeek)
  const weekLabels = weekStarts.map((w) => format(w, 'MMM d'))
  const windowLabel = `${format(firstWeek, 'MMM d')} – ${format(lastWeek, 'MMM d, yyyy')}`
  const empty: CrewVisitsReport = { crew: [], windowLabel, maxWeekly: 0 }

  const { data, error } = await supabase
    .from('visits')
    .select('week_start, visit_crew!inner(relation, employee:employees(id, name))')
    .eq('status', 'completed')
    .eq('visit_crew.relation', 'completed')
    .gte('week_start', format(firstWeek, 'yyyy-MM-dd'))
    .lte('week_start', format(lastWeek, 'yyyy-MM-dd'))

  if (error) {
    console.error('[getVisitsPerCrewByWeek]', error)
    return { ...empty, loadError: true }
  }

  const weekIndex = new Map(weekStarts.map((w, i) => [format(w, 'yyyy-MM-dd'), i]))
  const byEmployee = new Map<string, CrewWeeklyVisits>()

  for (const visit of (data ?? []) as unknown as {
    week_start: string
    visit_crew: { relation: string; employee: { id: string; name: string } | null }[]
  }[]) {
    const i = weekIndex.get(visit.week_start)
    if (i === undefined) continue

    for (const link of visit.visit_crew) {
      const employee = link.employee
      if (!employee) continue

      let row = byEmployee.get(employee.id)
      if (!row) {
        row = {
          employeeId: employee.id,
          name: employee.name,
          total: 0,
          weeks: weekLabels.map((label) => ({ label, count: 0 })),
        }
        byEmployee.set(employee.id, row)
      }
      row.weeks[i].count += 1
      row.total += 1
    }
  }

  const crew = [...byEmployee.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  )
  const maxWeekly = crew.reduce(
    (max, c) => Math.max(max, ...c.weeks.map((w) => w.count)),
    0,
  )

  return { crew, windowLabel, maxWeekly }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Visit frequency vs. contracted frequency
 * ──────────────────────────────────────────────────────────────────────────── */

export interface AccountAdherence {
  accountId: string
  name: string
  expected: number
  actual: number
  /** actual − expected. Negative = under-served, the thing we're looking for. */
  delta: number
}

export interface AdherenceReport {
  accounts: AccountAdherence[]
  /** Count of accounts at or above target, excluded from the chart's top-N slice. */
  onTargetCount: number
  windowLabel: string
  weeks: number
  /** True when the query failed — see the note on CrewVisitsReport.loadError. */
  loadError?: boolean
}

/**
 * Per-account actual vs. expected visit count for `year`.
 *
 * The window is the **season, derived from the data** rather than a hardcoded
 * Apr–Oct constant: it runs from the first week that year with any completed
 * visit to the last (capped at the current week). Deriving it means a quiet
 * winter never counts against an account, and it self-calibrates if the
 * company's season shifts — but it does mean the denominator moves, so the
 * window is always stated in the card subtitle.
 *
 * `as_needed` properties and accounts are excluded outright: with no
 * contracted cadence there is no expectation to fall short of.
 */
export async function getFrequencyAdherence(year: number): Promise<AdherenceReport> {
  const supabase = await createClient()
  const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd')
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd')
  const emptyReport: AdherenceReport = {
    accounts: [],
    onTargetCount: 0,
    windowLabel: '',
    weeks: 0,
  }

  const [visitsResult, accountsResult] = await Promise.all([
    supabase
      .from('visits')
      .select('account_id, property_id, week_start')
      .eq('status', 'completed')
      .gte('week_start', yearStart)
      .lte('week_start', yearEnd),
    supabase
      .from('accounts')
      .select('id, name, billing_type, properties(id, frequency)')
      .eq('status', 'active')
      .eq('is_archived', false)
      .eq('properties.is_archived', false)
      .neq('billing_type', 'as_needed'),
  ])

  if (visitsResult.error || accountsResult.error) {
    console.error(
      '[getFrequencyAdherence]',
      visitsResult.error ?? accountsResult.error,
    )
    return { ...emptyReport, loadError: true }
  }

  const visits = (visitsResult.data ?? []) as {
    account_id: string
    property_id: string
    week_start: string
  }[]
  if (visits.length === 0) return emptyReport

  // Derive the season window from actual completed work.
  const weekStrings = visits.map((v) => v.week_start).sort()
  const seasonStart = parseISO(weekStrings[0])
  const observedEnd = parseISO(weekStrings[weekStrings.length - 1])
  const thisWeek = getWeekStart(new Date())
  const seasonEnd = isAfter(observedEnd, thisWeek) ? thisWeek : observedEnd
  const weeks =
    differenceInCalendarWeeks(seasonEnd, seasonStart, { weekStartsOn: 1 }) + 1
  const windowLabel = `${format(seasonStart, 'MMM d')} – ${format(seasonEnd, 'MMM d, yyyy')}`

  const actualByAccount = new Map<string, number>()
  for (const v of visits) {
    actualByAccount.set(v.account_id, (actualByAccount.get(v.account_id) ?? 0) + 1)
  }

  const accounts = (accountsResult.data ?? []) as unknown as {
    id: string
    name: string
    properties: { id: string; frequency: string }[]
  }[]

  const rows: AccountAdherence[] = []
  for (const account of accounts) {
    let expected = 0
    for (const property of account.properties ?? []) {
      const propertyExpected = expectedVisitsForFrequency(property.frequency, weeks)
      if (propertyExpected !== null) expected += propertyExpected
    }
    // No contracted cadence on any property → nothing to compare against.
    if (expected === 0) continue

    const actual = actualByAccount.get(account.id) ?? 0
    rows.push({
      accountId: account.id,
      name: account.name,
      expected,
      actual,
      delta: actual - expected,
    })
  }

  rows.sort((a, b) => a.delta - b.delta || a.name.localeCompare(b.name))

  return {
    accounts: rows,
    onTargetCount: rows.filter((r) => r.delta >= 0).length,
    windowLabel,
    weeks,
  }
}
