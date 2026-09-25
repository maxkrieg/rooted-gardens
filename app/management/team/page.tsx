import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/management/TeamView'
import { ErrorState } from '@/components/states/ErrorState'
import type { Employee, AppAccessStatus } from '@/types/app'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Team management page (task 7.1). Owner-only — the proxy gates /management/team
 * to owner, and this re-checks as defense-in-depth (Server Components aren't
 * covered by RLS the way writes are, and the employees SELECT policy also allows
 * lead/accountant to read). Server Component: fetches the roster and hands it to
 * the interactive TeamView.
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
 * Resolve real app-access state for the Team page.
 *
 * `employees.user_id` is set by inviteEmployee the instant the invite email is
 * sent, so on its own it means "was invited", not "can get in" — an employee
 * whose invite link expired unclicked looks identical to one using the app
 * daily. The truth lives in auth.users, which only the admin API can read, so
 * this runs on the service client. Server-only: never import from a Client
 * Component.
 *
 * Degrades to `'active'` for any linked employee if the admin call fails — a
 * wrong-but-familiar label beats an error page on the roster.
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

/**
 * IDs of auth users who have signed in at least once. Paged rather than a single
 * large call — a silent truncation would mislabel someone as never-signed-in,
 * which is the exact bug this is meant to fix. At ~20 employees this is one
 * request; the cap is a runaway guard, not a real limit.
 */
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
