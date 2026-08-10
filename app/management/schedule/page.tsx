import { format, addWeeks } from 'date-fns'
import { cookies } from 'next/headers'
import { parseWeekParam } from '@/lib/utils/schedule'
import {
  filterScheduleWeeks,
  hasActiveScheduleFilters,
  parseScheduleFilters,
} from '@/lib/utils/schedule-filters'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import { createClient } from '@/lib/supabase/server'
import { getScheduleForWeek } from './actions'
import { ScheduleGrid } from '@/components/management/ScheduleGrid'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { ScheduleNav } from '@/components/management/ScheduleNav'
import { ScheduleFilterBar } from '@/components/management/ScheduleFilterBar'
import { SessionsProvider } from '@/components/management/SessionsProvider'
import { DeepLinkedVisitSheet } from '@/components/management/DeepLinkedVisitSheet'
import type { Account, EmployeeRole } from '@/types/app'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string
    routeGroup?: string
    account?: string
    crew?: string
    status?: string
    /** Deep link from the crew stop page — opens this visit's detail sheet on
     *  arrival. Paired with `week` so the right 4-week window is fetched. */
    visit?: string
  }>
}) {
  const params = await searchParams
  const base = parseWeekParam(params.week)
  const filters = parseScheduleFilters(params)
  const weekStarts = [0, 1, 2, 3].map((n) => addWeeks(base, n))

  const supabase = await createClient()

  const [weeks, employeesResult, vehiclesResult] = await Promise.all([
    Promise.all(weekStarts.map((w) => getScheduleForWeek(format(w, 'yyyy-MM-dd')))),
    supabase.from('employees').select('*').eq('active', true).order('name'),
    supabase.from('vehicles').select('*').neq('status', 'retired').order('name'),
  ])

  // Collect visit IDs across the 4-week window — passed to SessionsProvider
  // which fetches sessions client-side (avoids server-prop sync anti-pattern).
  // Derived from the unfiltered weeks so the realtime overlay stays complete.
  const visitIds = weeks
    .flatMap((w) => [
      ...w.routeGroups.flatMap((rg) => rg.rows.map((r) => r.visit?.id)),
      ...w.ungrouped.map((r) => r.visit?.id),
    ])
    .filter((id): id is string => Boolean(id))

  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'crew'

  // Not fatal — these only populate the crew/vehicle pickers. The schedule
  // itself still renders, and getScheduleForWeek reports its own failure.
  if (employeesResult.error) console.error('[schedule] employees', employeesResult.error)
  if (vehiclesResult.error) console.error('[schedule] vehicles', vehiclesResult.error)

  const employees = employeesResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const canEdit = role === 'owner' || role === 'lead'

  // Filter options come from the unfiltered window, so they never collapse as
  // filters narrow the view.
  const routeGroupOptions = weeks[0]?.routeGroups.map((g) => g.routeGroup) ?? []
  const accountOptions = dedupeAccounts(
    weeks.flatMap((w) => [
      ...w.routeGroups.flatMap((g) => g.rows.map((r) => r.account)),
      ...w.ungrouped.map((r) => r.account),
    ])
  )

  // Desktop grid keeps a row that matches in any of the 4 weeks; the phone list
  // shows one week, so it matches against that week alone.
  const gridWeeks = filterScheduleWeeks(weeks, filters)
  const mobileWeek = filterScheduleWeeks(weeks.slice(0, 1), filters)[0]
  const filtered = hasActiveScheduleFilters(filters)

  return (
    // No p-4 lg:p-6 here — the management layout already applies it, and
    // doubling it up cost every page 32px of usable width on a phone.
    <div>
      {/* Wraps rather than overflows: at 375px the title plus the nav
          (three 44px buttons + label, plus the conditional "Today" button)
          doesn't fit on one line. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
        <h1 className="min-w-0 truncate font-display text-2xl font-semibold text-foreground">
          Schedule
        </h1>
        <ScheduleNav windowStart={format(base, 'yyyy-MM-dd')} filters={filters} />
      </div>
      <div className="mb-6">
        <ScheduleFilterBar
          filters={filters}
          week={format(base, 'yyyy-MM-dd')}
          routeGroups={routeGroupOptions}
          accounts={accountOptions}
          employees={employees}
        />
      </div>
      <SessionsProvider visitIds={visitIds}>
        <div className="hidden lg:block">
          <ScheduleGrid
            weeks={gridWeeks}
            employees={employees}
            vehicles={vehicles}
            canEdit={canEdit}
            role={role as EmployeeRole}
            filtered={filtered}
          />
        </div>
        <div className="lg:hidden">
          <ScheduleListMobile
            week={mobileWeek}
            windowWeeks={weeks}
            employees={employees}
            vehicles={vehicles}
            canEdit={canEdit}
            role={role as EmployeeRole}
            filtered={filtered}
          />
        </div>
        {/* Rendered once, outside both layouts — both are always mounted, so
            giving each the deep link opened two stacked sheets. */}
        <DeepLinkedVisitSheet
          weeks={weeks}
          visitId={params.visit}
          role={role as EmployeeRole}
        />
      </SessionsProvider>
    </div>
  )
}

/** One entry per account, sorted by name — the account filter's option list. */
function dedupeAccounts(accounts: Account[]): Account[] {
  const byId = new Map<string, Account>()
  for (const account of accounts) {
    if (!byId.has(account.id)) byId.set(account.id, account)
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
