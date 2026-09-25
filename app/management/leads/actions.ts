'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/server-role'
import { leadStatusSchema } from '@/lib/validators/lead'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import { buildAccountPayload } from '@/lib/utils/accounts'
import { toUserMessage } from '@/lib/errors'
import type { JobApplicationDetails } from '@/types/app'

const requireLeadAccess = () =>
  requireRole(['owner', 'lead'], 'Only owners and leads can manage the leads inbox')

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
 * 5-minute signed URL for a résumé. The path is re-read server-side; the resumes SELECT policy
 * is the gate.
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
 * Convert an inquiry lead to an account, then mark it won. Re-reads the lead so a stale sheet
 * can't double-convert. If the lead update fails, returns the account with a `warning`.
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
