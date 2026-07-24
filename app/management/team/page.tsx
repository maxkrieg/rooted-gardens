import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/management/TeamView'
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
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Could not load the team — try refreshing.
      </div>
    )
  }

  return <TeamView employees={(employees ?? []) as Employee[]} />
}
