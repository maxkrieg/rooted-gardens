'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { leadAssigneeSchema, leadStatusSchema } from '@/lib/validators/lead'
import { toUserMessage } from '@/lib/errors'
import type { JobApplicationDetails } from '@/types/app'

/**
 * Leads inbox Server Actions (task 9.8). Owner/lead only — matches the
 * `leads` RLS policies (migration 20260804130000_leads.sql) exactly, so this
 * check is defense-in-depth the same way requireOwner() is in
 * app/management/team/actions.ts, not the real boundary.
 */
async function requireLeadAccess(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (employee?.role !== 'owner' && employee?.role !== 'lead') {
    return { error: 'Only owners and leads can manage the leads inbox' }
  }
  return {}
}

export async function updateLeadStatus(id: string, status: string): Promise<{ error?: string }> {
  const auth = await requireLeadAccess()
  if (auth.error) return { error: auth.error }

  const parsed = leadStatusSchema.safeParse(status)
  if (!parsed.success) return { error: 'Invalid status' }

  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ status: parsed.data }).eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not update the lead.', '[updateLeadStatus]') }
  }
  revalidatePath('/management/leads')
  return {}
}

export async function assignLead(
  id: string,
  employeeId: string | null,
): Promise<{ error?: string }> {
  const auth = await requireLeadAccess()
  if (auth.error) return { error: auth.error }

  const parsed = leadAssigneeSchema.safeParse(employeeId)
  if (!parsed.success) return { error: 'Invalid assignee' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: parsed.data })
    .eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not assign the lead.', '[assignLead]') }
  }
  revalidatePath('/management/leads')
  return {}
}

/**
 * Signed URL for a job application's résumé. Re-reads `details.resume_path`
 * from the DB rather than trusting a client-supplied path — the sheet only
 * ever passes a lead id.
 *
 * Uses the RLS-respecting server client, not the service-role client: the
 * `resumes` bucket's "owners and leads can read resumes" SELECT policy
 * (migration 20260806130000) is the real gate here, unlike 9.6's *upload*
 * path, which needed service-role because the uploader was an anonymous
 * public applicant with no session to scope a policy by. A signed-in
 * owner/lead reading their own résumé has a session, so RLS applies cleanly.
 *
 * Short expiry (5 min) — a résumé is PII, and this URL is fetched and used
 * immediately from the detail sheet, never stored.
 */
export async function getLeadResumeUrl(id: string): Promise<{ url?: string; error?: string }> {
  const auth = await requireLeadAccess()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('kind, details')
    .eq('id', id)
    .single()
  if (fetchErr || !lead) return { error: 'Lead not found' }
  if (lead.kind !== 'job_application') return { error: 'This lead has no résumé' }

  const details = lead.details as JobApplicationDetails | null
  const path = details?.resume_path
  if (!path) return { error: 'No résumé was attached' }

  const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    return {
      error: toUserMessage(error, 'Could not open the résumé.', '[getLeadResumeUrl]'),
    }
  }
  return { url: data.signedUrl }
}
