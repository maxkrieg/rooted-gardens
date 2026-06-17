import { format, addWeeks } from 'date-fns'
import { getWeekStart } from '@/lib/utils/schedule'
import { getScheduleForWeek } from './actions'
import { ScheduleGrid } from '@/components/management/ScheduleGrid'

export default async function SchedulePage() {
  const base = getWeekStart(new Date())
  const weekStarts = [0, 1, 2, 3].map((n) => addWeeks(base, n))
  const weeks = await Promise.all(
    weekStarts.map((w) => getScheduleForWeek(format(w, 'yyyy-MM-dd')))
  )

  return (
    <div className="p-4 lg:p-6">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-6">Schedule</h1>
      <ScheduleGrid weeks={weeks} />
    </div>
  )
}
