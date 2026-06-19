import { format, addWeeks, parseISO } from 'date-fns'
import { cookies } from 'next/headers'
import { getWeekStart } from '@/lib/utils/schedule'
import { createClient } from '@/lib/supabase/server'
import { getScheduleForWeek } from './actions'
import { ScheduleGrid } from '@/components/management/ScheduleGrid'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { ScheduleNav } from '@/components/management/ScheduleNav'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const base = week ? getWeekStart(parseISO(week)) : getWeekStart(new Date())
  const weekStarts = [0, 1, 2, 3].map((n) => addWeeks(base, n))

  const supabase = await createClient()

  const [weeks, employeesResult, vehiclesResult] = await Promise.all([
    Promise.all(weekStarts.map((w) => getScheduleForWeek(format(w, 'yyyy-MM-dd')))),
    supabase.from('employees').select('*').eq('active', true).order('name'),
    supabase.from('vehicles').select('*').neq('status', 'retired').order('name'),
  ])

  const cookieStore = await cookies()
  const role = cookieStore.get('rg-role')?.value ?? 'crew'

  const employees = employeesResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const canEdit = role === 'owner' || role === 'lead'

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Schedule</h1>
        <ScheduleNav windowStart={format(base, 'yyyy-MM-dd')} />
      </div>
      <div className="hidden lg:block">
        <ScheduleGrid
          weeks={weeks}
          employees={employees}
          vehicles={vehicles}
          canEdit={canEdit}
        />
      </div>
      <div className="lg:hidden">
        <ScheduleListMobile
          weeks={weeks}
          employees={employees}
          vehicles={vehicles}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
