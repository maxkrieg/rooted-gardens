import { format, addWeeks } from 'date-fns'
import { cookies } from 'next/headers'
import { getWeekStart } from '@/lib/utils/schedule'
import { createClient } from '@/lib/supabase/server'
import { getScheduleForWeek } from './actions'
import { ScheduleGrid } from '@/components/management/ScheduleGrid'

export default async function SchedulePage() {
  const supabase = await createClient()

  const base = getWeekStart(new Date())
  const weekStarts = [0, 1, 2, 3].map((n) => addWeeks(base, n))

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

  console.log('SchedulePage', { role, canEdit, employees, vehicles })

  return (
    <div className="p-4 lg:p-6">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-6">Schedule</h1>
      <ScheduleGrid
        weeks={weeks}
        employees={employees}
        vehicles={vehicles}
        canEdit={canEdit}
      />
    </div>
  )
}
