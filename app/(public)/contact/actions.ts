'use server'

import { toUserMessage } from '@/lib/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { checkLeadSpamSignals, enforceLeadRateLimit, getClientIp, hashIp } from '@/lib/leads/spam'
import { inquiryFormSchema, type InquiryFormValues } from '@/lib/validators/lead'

/** Public inquiry form action, anonymous by design (unlike the owner-only ../actions.ts). */
export async function submitInquiry(values: InquiryFormValues): Promise<{ error?: string }> {
  const parsed = inquiryFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }

  // Bot signals: pretend success and write nothing.
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
  // No `.select()`: anon can't SELECT leads, so RETURNING fails. status/source use DB defaults.
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
