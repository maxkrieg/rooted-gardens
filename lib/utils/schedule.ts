import { startOfWeek, addWeeks, differenceInDays, isBefore } from 'date-fns'
import type { ServiceZone } from '@/types/app'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = []
  let current = getWeekStart(start)
  while (!isBefore(end, current)) {
    weeks.push(current)
    current = addWeeks(current, 1)
  }
  return weeks
}

export function isZoneDueThisWeek(
  zone: ServiceZone,
  weekStart: Date,
  lastVisitDate?: Date | null
): boolean {
  if (!zone.active) return false
  switch (zone.frequency) {
    case 'weekly':
      return true
    case 'as_needed':
      return false
    case 'biweekly':
      if (!lastVisitDate) return true
      return differenceInDays(weekStart, lastVisitDate) >= 14
    case 'monthly':
      if (!lastVisitDate) return true
      return differenceInDays(weekStart, lastVisitDate) >= 28
    default:
      return false
  }
}
