import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppAccessStatuses } from '@/lib/team/app-access'
import { TeamView } from '@/components/management/TeamView'
import { ErrorState } from '@/components/states/ErrorState'
import type { Employee } from '@/types/app'

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
  if (me?.role !== 'owner') redirect('/management/dashboard')

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
