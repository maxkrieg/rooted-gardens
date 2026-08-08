import { format, parseISO } from 'date-fns'
import { LEAD_SERVICE_INTEREST_LABELS_FULL } from '@/lib/validators/lead'
import type { AccountFormValues } from '@/lib/validators/account'
import type { PropertyFormValues } from '@/lib/validators/property'
import type { JobApplicationDetails, LeadWithAssignee } from '@/types/app'

/**
 * The one-line "what are they after" summary shown in both the leads table
 * and LeadCard: a job application's position, or a service inquiry's
 * service_interest label. Shared so the two renderings can't drift.
 */
export function leadInterestOrPosition(lead: LeadWithAssignee): string | null {
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
 * Prefill for AccountForm when converting a service_inquiry lead to an
 * account (task 9.9). `status`/`billing_type` default to 'prospective' /
 * 'as_needed' — a website prospect hasn't been quoted yet, and
 * accountFormSchema requires a price for 'per_visit', which would block
 * conversion before the owner has a number to enter. Billing address fields
 * are left blank on purpose: `lead.address` is the *service* address (it
 * belongs on the property, via leadToPropertyDefaults below), not the
 * account's structured billing/mailing address.
 */
export function leadToAccountDefaults(lead: LeadWithAssignee): Partial<AccountFormValues> {
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
    billing_type: 'as_needed',
    notes: notesLines.join('\n'),
  }
}

/**
 * Prefill for PropertyForm when converting a service_inquiry lead (task 9.9).
 * Frequency is left at the form's own 'weekly' default — a lead's message
 * gives no reliable signal for it.
 */
export function leadToPropertyDefaults(lead: LeadWithAssignee): Partial<PropertyFormValues> {
  return {
    address: lead.address ?? '',
  }
}
