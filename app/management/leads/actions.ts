'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { leadStatusSchema } from '@/lib/validators/lead'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import { buildAccountPayload } from '@/lib/utils/accounts'
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

/**
 * Convert a service_inquiry lead into an account (task 9.9) — step 1 of the
 * ConvertLeadSheet wizard. Creates the account, then marks the lead won and
 * links it back. Property creation (step 2) is a separate call to the
 * existing createProperty (app/app/(padded)/accounts/property-actions.ts) once
 * the caller has the new account id.
 *
 * Re-reads the lead server-side rather than trusting the client's `kind` /
 * conversion state — same "the client only ever passes an id" posture as
 * getLeadResumeUrl above — so a stale sheet or a double-click can't create a
 * duplicate account for an already-converted lead.
 *
 * If the account insert succeeds but the lead update fails, the account is
 * NOT rolled back (supabase-js has no cross-table transaction) — it's
 * returned via `accountId` with a `warning` rather than silently lost, so the
 * caller can still proceed to step 2 and surface the problem.
 */
export async function convertLeadToAccount(
  leadId: string,
  values: AccountFormValues,
): Promise<{ accountId?: string; warning?: string; error?: string }> {
  const auth = await requireLeadAccess()
  if (auth.error) return { error: auth.error }

  const parsed = accountFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('kind, converted_account_id')
    .eq('id', leadId)
    .single()
  if (fetchErr || !lead) return { error: 'Lead not found' }
  if (lead.kind !== 'service_inquiry') {
    return { error: 'Only service inquiries can be converted to an account' }
  }
  if (lead.converted_account_id) {
    return { error: 'This lead has already been converted to an account' }
  }

  const { data: account, error: insertErr } = await supabase
    .from('accounts')
    .insert(buildAccountPayload(parsed.data))
    .select('id')
    .single()
  if (insertErr || !account) {
    return { error: toUserMessage(insertErr, 'Could not create the account.', '[convertLeadToAccount]') }
  }

  const { error: updateErr } = await supabase
    .from('leads')
    .update({ status: 'won', converted_account_id: account.id })
    .eq('id', leadId)

  revalidatePath('/management/leads')
  revalidatePath('/app/accounts')

  if (updateErr) {
    console.error('[convertLeadToAccount] lead link', updateErr)
    return {
      accountId: account.id,
      warning: "Account created, but the lead wasn't marked converted. Update its status by hand.",
    }
  }

  return { accountId: account.id }
}
