import { LEAD_SERVICE_INTEREST_LABELS_FULL } from '@/lib/validators/lead'
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
