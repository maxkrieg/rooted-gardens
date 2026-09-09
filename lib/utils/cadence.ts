import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Frequency, Property } from '@/types/app'

/**
 * How many days a frequency means when the owner hasn't overridden it.
 *
 * Monthly is 28, not 30, on purpose: this whole app is a Monday-to-Sunday week
 * grid, and 28 is four of them. A 30-day monthly would drift out of phase with
 * the week the schedule is generated into, and would push every monthly
 * property a week later than the planner has always put it.
 *
 * as_needed has no interval by design — nothing about "call us when you need
 * us" is overdue. An owner opts a property in by typing a number.
 */
export const FREQUENCY_DEFAULT_INTERVAL_DAYS: Record<Frequency, number | null> = {
  weekly: 7,
  biweekly: 14,
  monthly: 28,
  as_needed: null,
}

/** Fraction of the interval after which a property is "coming due" rather than fine. */
const DUE_SOON_RATIO = 0.8

export type CadenceProperty = Pick<Property, 'frequency' | 'preferred_interval_days'>

/**
 * 'due' is the last ~20% of the interval, 'over' is past it. 'ok' also covers
 * every case we can't judge — no interval, or no completed visit on record.
 */
export type CadenceState = 'ok' | 'due' | 'over'

export type Cadence = {
  /** null when the property has no interval at all (as_needed, no override). */
  intervalDays: number | null
  /** null when nothing has ever been completed here. Never treated as overdue. */
  daysSince: number | null
  /** yyyy-MM-dd. null whenever intervalDays or the last visit is missing. */
  nextDueOn: string | null
  state: CadenceState
  /** Days past the interval; 0 unless state is 'over'. The priority sort key. */
  overdueBy: number
}

/** The interval this property actually runs on: the override, else the frequency default. */
export function intervalDaysFor(property: CadenceProperty): number | null {
  if (property.preferred_interval_days != null) return property.preferred_interval_days
  return FREQUENCY_DEFAULT_INTERVAL_DAYS[property.frequency as Frequency] ?? null
}

/**
 * Where a property sits in its own cadence, as of `today`.
 *
 * Measured from today rather than from whichever week is on screen: this is a
 * fact about the property, so it reads the same on the schedule, the account
 * page, the routes page and the stop screen. A week-relative version would let
 * two surfaces disagree about the same property.
 *
 * `lastVisitOn` is the yyyy-MM-dd the property_last_visit view yields — keyed on
 * ended_at, so a skipped visit correctly doesn't count as a visit.
 */
export function cadenceFor(
  property: CadenceProperty,
  lastVisitOn: string | null | undefined,
  today: Date = new Date(),
): Cadence {
  const intervalDays = intervalDaysFor(property)
  const daysSince = lastVisitOn ? Math.max(0, differenceInCalendarDays(today, parseISO(lastVisitOn))) : null

  if (intervalDays === null || daysSince === null || !lastVisitOn) {
    return { intervalDays, daysSince, nextDueOn: null, state: 'ok', overdueBy: 0 }
  }

  const nextDueOn = format(addDays(parseISO(lastVisitOn), intervalDays), 'yyyy-MM-dd')

  if (daysSince > intervalDays) {
    return { intervalDays, daysSince, nextDueOn, state: 'over', overdueBy: daysSince - intervalDays }
  }
  if (daysSince >= Math.ceil(intervalDays * DUE_SOON_RATIO)) {
    return { intervalDays, daysSince, nextDueOn, state: 'due', overdueBy: 0 }
  }
  return { intervalDays, daysSince, nextDueOn, state: 'ok', overdueBy: 0 }
}

/**
 * Sort weight, highest first: overdue by the most days, then how far through the
 * interval, then everything we can't judge. Kept here rather than in the sort so
 * the badge and the ordering can't drift apart.
 */
export function cadencePriority(cadence: Cadence): number {
  if (cadence.state === 'over') return 2_000_000 + cadence.overdueBy
  if (cadence.intervalDays === null || cadence.daysSince === null) return -1
  return 1_000_000 * (cadence.state === 'due' ? 1 : 0) + cadence.daysSince / cadence.intervalDays
}

/** "Every 7 days" / "Every 10 days" / null when the property has no interval. */
export function formatInterval(intervalDays: number | null): string | null {
  return intervalDays === null ? null : `Every ${intervalDays} days`
}
