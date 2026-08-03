import type { Frequency } from '@/types/app'

/** Earliest year the reports page will page back to. */
export const REPORTS_MIN_YEAR = 2020

/**
 * Resolve the `?year=` query param for the reports page. Falls back to the
 * current year when missing or unparseable, and clamps into
 * [REPORTS_MIN_YEAR, currentYear] so a hand-typed URL can't ask for a future
 * year (which would render three empty charts and look like a bug).
 * Same defensive shape as `resolveDateRange` in `lib/utils/billing.ts`.
 */
export function resolveReportYear(value: string | null | undefined): number {
  const currentYear = new Date().getFullYear()
  if (!value) return currentYear
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return currentYear
  return Math.min(Math.max(parsed, REPORTS_MIN_YEAR), currentYear)
}

/**
 * How many visits a property on `frequency` is expected to receive across
 * `weeks` weeks — the denominator for the frequency-adherence report.
 *
 * `as_needed` returns null rather than 0: those properties have no contracted
 * cadence, so they have no expectation to fall short of. Callers must skip
 * them entirely rather than treat them as "expected 0" (which would score every
 * one of them as over-served).
 *
 * `monthly` divides by 4.345 (52/12) rather than 4, so a full season doesn't
 * accumulate a phantom extra visit.
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
