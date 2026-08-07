'use server'

import { toUserMessage } from '@/lib/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { checkLeadSpamSignals, enforceLeadRateLimit, getClientIp, hashIp } from '@/lib/leads/spam'
import { inquiryFormSchema, type InquiryFormValues } from '@/lib/validators/lead'

/**
 * Public, unauthenticated Server Action backing InquiryForm (task 9.5).
 * Deliberately a separate file from app/(public)/actions.ts — that file is
 * the owner-only content editor and every action in it starts with
 * `requireOwner()`; this one is the opposite by design, since the whole
 * point is that an anonymous visitor can reach it.
 */
export async function submitInquiry(values: InquiryFormValues): Promise<{ error?: string }> {
  const parsed = inquiryFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }

  // Honeypot / too-fast bot signals: pretend success without writing a row.
  // Telling a bot it was caught just teaches it to adapt; a silent no-op
  // costs it nothing to learn from.
  const spamSignal = checkLeadSpamSignals({
    website: parsed.data.website,
    elapsedMs: parsed.data.elapsedMs,
  })
  if (spamSignal) {
    console.warn('[submitInquiry] spam signal', spamSignal)
    return {}
  }

  const ip = await getClientIp()
  const ipHash = hashIp(ip ?? 'unknown')
  const { limited } = await enforceLeadRateLimit(ipHash, 'service_inquiry')
  if (limited) {
    return {
      error: "We've already got a few messages from you. Give us a little time to reply, then try again.",
    }
  }

  const supabase = createPublicClient()
  // No `.select()` chained — `anon` has INSERT but no SELECT on `leads`
  // (task 9.1), and PostgREST needs SELECT visibility to return a row via
  // RETURNING even from an INSERT. `status`/`source` come from their DB
  // defaults ('new' / 'website'), matching the `leads_insert_anon` policy's
  // WITH CHECK exactly.
  const { error } = await supabase.from('leads').insert({
    kind: 'service_inquiry',
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    service_interest: parsed.data.service_interest,
    message: parsed.data.message || null,
  })

  if (error) {
    return { error: toUserMessage(error, 'Could not send your message.', '[submitInquiry]') }
  }

  return {}
}
