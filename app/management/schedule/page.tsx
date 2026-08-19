import { format } from 'date-fns'
import { cookies } from 'next/headers'
import { parseWeekParam } from '@/lib/utils/schedule'
import { parseScheduleFilters } from '@/lib/utils/schedule-filters'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import { ScheduleView } from '@/components/management/ScheduleView'
import type { EmployeeRole } from '@/types/app'

/**
 * Thin shell. The schedule itself is client-first (ScheduleView) so it reads from
 * the persisted React Query cache and its writes go through the offline queue —
 * owners run this page from the field. All this does is seed the initial URL
 * state and the role, which only the server can read.
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
    /** Deep link from the crew stop page — opens this visit's detail sheet. */
    visit?: string
  }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const role = (parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'crew') as EmployeeRole

  return (
    <ScheduleView
      initialWeek={format(parseWeekParam(params.week), 'yyyy-MM-dd')}
      initialFilters={parseScheduleFilters(params)}
      initialVisitId={params.visit}
      role={role}
    />
  )
}
