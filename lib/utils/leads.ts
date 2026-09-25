import { format, parseISO } from 'date-fns'
import { LEAD_SERVICE_INTEREST_LABELS_FULL } from '@/lib/validators/lead'
import type { AccountFormValues } from '@/lib/validators/account'
import type { PropertyFormValues } from '@/lib/validators/property'
import type { JobApplicationDetails, LeadWithConverted } from '@/types/app'

/** The one-line "what are they after": position or service interest. */
export function leadInterestOrPosition(lead: LeadWithConverted): string | null {
  if (lead.kind === 'job_application') {
    return (lead.details as JobApplicationDetails | null)?.position ?? null
  }
  if (!lead.service_interest) return null
  return (
    LEAD_SERVICE_INTEREST_LABELS_FULL[
      lead.service_interest as keyof typeof LEAD_SERVICE_INTEREST_LABELS_FULL
    ] ?? lead.service_interest
  )
}

/**
 * AccountForm prefill for a converted inquiry: prospective, per_visit. price_per_visit is left
 * blank on purpose, so the owner must set a rate before the account exists. lead.address is the
 * service address; it goes on the property.
 */
export function leadToAccountDefaults(lead: LeadWithConverted): Partial<AccountFormValues> {
  const interest = leadInterestOrPosition(lead)
  const receivedOn = format(parseISO(lead.created_at), 'MMM d, yyyy')
  const notesLines = [
    `Website inquiry — ${receivedOn}`,
    interest ? `Interested in: ${interest}` : null,
    lead.message ? `\n${lead.message}` : null,
  ].filter((line): line is string => Boolean(line))

  return {
    name: lead.name,
    contact_name: lead.name,
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    status: 'prospective',
    billing_type: 'per_visit',
    notes: notesLines.join('\n'),
  }
}

/** PropertyForm prefill. Frequency stays at the form default; a message isn't a reliable signal. */
export function leadToPropertyDefaults(lead: LeadWithConverted): Partial<PropertyFormValues> {
  return {
    address: lead.address ?? '',
  }
}
