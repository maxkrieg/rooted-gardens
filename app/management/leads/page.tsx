import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsInbox } from '@/components/management/LeadsInbox'
import { ErrorState } from '@/components/states/ErrorState'
import type { LeadWithConverted } from '@/types/app'

/**
 * Leads inbox (task 9.8). Owner/lead only — the proxy gates /management/leads
 * to owner/lead (matching leads RLS exactly), and this re-checks as
 * defense-in-depth, the same posture as app/management/team/page.tsx.
 * Server Component: fetches leads (joined to the account each converted
 * into, if any) and hands them to the interactive LeadsInbox.
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
  if (me?.role !== 'owner' && me?.role !== 'lead') redirect('/app/dashboard')

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, converted:accounts!leads_converted_account_id_fkey(id, name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[leads] list', error)
    return <ErrorState title="Leads didn't load." hint="Check your connection, then try again." />
  }

  return (
    <LeadsInbox
      leads={(leads ?? []) as unknown as LeadWithConverted[]}
      initialLeadId={params.lead}
    />
  )
}
