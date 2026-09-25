import type { Frequency } from '@/types/app'

/** Earliest year the reports page will page back to. */
export const REPORTS_MIN_YEAR = 2020

/** Resolve `?year=`, clamped to [REPORTS_MIN_YEAR, current year]. */
export function resolveReportYear(value: string | null | undefined): number {
  const currentYear = new Date().getFullYear()
  if (!value) return currentYear
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return currentYear
  return Math.min(Math.max(parsed, REPORTS_MIN_YEAR), currentYear)
}

/**
 * Expected visits for `frequency` over `weeks` weeks. as_needed returns null (no expectation),
 * so callers skip it. Monthly uses 52/12 weeks per month.
 */
export function expectedVisitsForFrequency(
  frequency: Frequency | string,
  weeks: number,
): number | null {
  if (weeks <= 0) return frequency === 'as_needed' ? null : 0
  switch (frequency) {
    case 'weekly':
      return weeks
    case 'biweekly':
      return Math.floor(weeks / 2)
    case 'monthly':
      return Math.floor(weeks / 4.345)
    case 'as_needed':
      return null
    default:
      return null
  }
}

/** Signed delta formatted for a direct label: `+2`, `−4`, `0`. */
export function formatDelta(delta: number): string {
  if (delta === 0) return '0'
  // U+2212 minus, not a hyphen — it aligns with digits at chart-label sizes.
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
}
