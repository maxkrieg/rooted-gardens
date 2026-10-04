'use client'

import { useCan } from '@/components/app/RoleProvider'
import { useWeekPlan } from '@/hooks/useGenerateWeek'
import { useScheduleSeen } from '@/hooks/useScheduleSeen'
import { scheduleExceptions } from '@/lib/utils/schedule'
import type { ScheduleWeek } from '@/types/app'

/**
 * Needs you for one week, minus the skips and reports this viewer has opened. Shared by Today's
 * list and the desktop board's count, so the two can't disagree.
 */
export function useNeedsYou(
  /** The week as shown, filters applied. */
  week: ScheduleWeek | undefined,
  /** The same week unfiltered: planning off a filtered week would skip whatever it hid. */
  unfilteredWeek: ScheduleWeek | undefined,
  weekStart: string,
) {
  const { editSchedule: canEdit } = useCan()
  const { isSeen, markSeen } = useScheduleSeen()
  const plan = useWeekPlan(weekStart, unfilteredWeek)
  const decisions = canEdit && !plan.isLoading && !plan.isError ? plan.decisions : []

  const items = scheduleExceptions(week, decisions, new Date()).filter((item) =>
    item.kind === 'skipped' || item.kind === 'crewReport' ? !isSeen(item.visit) : true,
  )

  return { items, markSeen, plan }
}
