import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsInbox } from '@/components/management/LeadsInbox'
import { ErrorState } from '@/components/states/ErrorState'
import type { Employee, LeadWithAssignee } from '@/types/app'

/**
 * Leads inbox (task 9.8). Owner/lead only — the proxy gates /management/leads
 * to owner/lead (matching leads RLS exactly), and this re-checks as
 * defense-in-depth, the same posture as app/management/team/page.tsx.
 * Server Component: fetches leads (joined to their assignee) and the
 * candidate assignees, then hands both to the interactive LeadsInbox.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>
}) {
  const params = await searchParams
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
  if (me?.role !== 'owner' && me?.role !== 'lead') redirect('/management/dashboard')

  const [leadsRes, assigneesRes] = await Promise.all([
    supabase
      .from('leads')
      .select(
        '*, assigned:employees!leads_assigned_to_fkey(id, name), converted:accounts!leads_converted_account_id_fkey(id, name)',
      )
      .order('created_at', { ascending: false }),
    // Candidate assignees for the picker — same "leads" access as the inbox
    // itself, so the field can only ever be assigned to someone who can
    // actually see it. Inactive employees excluded, same as ScheduleFilterBar.
    supabase
      .from('employees')
      .select('*')
      .in('role', ['owner', 'lead'])
      .eq('active', true)
      .order('name'),
  ])

  if (leadsRes.error || assigneesRes.error) {
    console.error('[leads] list', leadsRes.error ?? assigneesRes.error)
    return <ErrorState title="Leads didn't load." hint="Check your connection, then try again." />
  }

  return (
    <LeadsInbox
      leads={(leadsRes.data ?? []) as unknown as LeadWithAssignee[]}
      assignees={(assigneesRes.data ?? []) as Employee[]}
      initialLeadId={params.lead}
    />
  )
}
