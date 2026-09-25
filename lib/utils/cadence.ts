import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Frequency, Property } from '@/types/app'

/**
 * Default days per frequency. Monthly is 28 (four schedule weeks) so it stays in phase.
 * as_needed has none; an owner opts in with an override.
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

/** 'due' is the last ~20% of the interval, 'over' past it; 'ok' also covers unknowns. */
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
 * Where a property sits in its cadence as of today, so every surface agrees. `lastVisitOn`
 * comes from property_last_visit (skips don't count).
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

/** Sort weight, highest first. Lives here so the badge and the sort can't drift. */
export function cadencePriority(cadence: Cadence): number {
  if (cadence.state === 'over') return 2_000_000 + cadence.overdueBy
  if (cadence.intervalDays === null || cadence.daysSince === null) return -1
  return 1_000_000 * (cadence.state === 'due' ? 1 : 0) + cadence.daysSince / cadence.intervalDays
}
