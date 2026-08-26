import { format } from 'date-fns'
import { parseWeekParam } from '@/lib/utils/schedule'
import { parseScheduleFilters } from '@/lib/utils/schedule-filters'
import { ScheduleView } from '@/components/management/ScheduleView'

/**
 * Thin shell. The schedule itself is client-first (ScheduleView) so it reads from
 * the persisted React Query cache and its writes go through the offline queue —
 * everyone runs this page from the field. All this does is seed the initial URL
 * state; capabilities come from the shell's RoleProvider.
 */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string
    routeGroup?: string
    account?: string
    crew?: string
    status?: string
    /** Deep link from a stop — opens this visit's detail sheet. */
    visit?: string
    /** 'today' | 'week'. Set by the retired /app/dashboard redirect. */
    view?: string
  }>
}) {
  const params = await searchParams

  return (
    <ScheduleView
      initialWeek={format(parseWeekParam(params.week), 'yyyy-MM-dd')}
      initialFilters={parseScheduleFilters(params)}
      initialVisitId={params.visit}
      initialViewMode={
        params.view === 'today' ? 'today' : params.view === 'week' ? 'week' : null
      }
    />
  )
}
