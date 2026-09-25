import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/management/TeamView'
import { ErrorState } from '@/components/states/ErrorState'
import type { Employee, AppAccessStatus } from '@/types/app'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Team page, owner-only. Rechecked here since the employees SELECT policy also allows lead
 * and accountant.
 */
export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (me?.role !== 'owner') redirect('/app/dashboard')

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('active', { ascending: false })
    .order('name')

  if (error) {
    console.error('[team] employees', error)
    return (
      <ErrorState
        title="The team didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

  const roster = (employees ?? []) as Employee[]
  const accessStatuses = await getAppAccessStatuses(roster)

  return <TeamView employees={roster} accessStatuses={accessStatuses} />
}

/**
 * Real app-access state from auth.users (user_id only proves an invite was sent). Uses the
 * service client; falls back to 'active' if the admin call fails.
 */
async function getAppAccessStatuses(
  employees: Employee[],
): Promise<Record<string, AppAccessStatus>> {
  const statuses: Record<string, AppAccessStatus> = {}
  for (const e of employees) {
    statuses[e.id] = e.user_id ? 'active' : 'none'
  }

  const linked = employees.filter((e) => e.user_id)
  if (linked.length === 0) return statuses

  let signedIn: Set<string>
  try {
    signedIn = await fetchSignedInUserIds()
  } catch (err) {
    console.error('[getAppAccessStatuses] listUsers', err)
    return statuses
  }

  for (const e of linked) {
    statuses[e.id] = signedIn.has(e.user_id!) ? 'active' : 'invited'
  }
  return statuses
}

/** Auth user ids that have signed in. Paged so a truncated list can't mislabel anyone. */
async function fetchSignedInUserIds(): Promise<Set<string>> {
  const service = createServiceClient()
  const perPage = 200
  const maxPages = 25
  const signedIn = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    for (const user of data.users) {
      if (user.last_sign_in_at) signedIn.add(user.id)
    }
    if (data.users.length < perPage) break
  }

  return signedIn
}
