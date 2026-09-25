import { z } from 'zod'
import { LEAD_STATUSES, SERVICE_SIDES, type LeadServiceInterest } from '@/types/app'

/**
 * Public inquiry form, shared by InquiryForm and submitInquiry. Caps mirror the `leads` CHECKs.
 * service_interest excludes 'other', which staff enter by hand.
 */
export const inquiryFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    email: z
      .string()
      .trim()
      .max(320)
      .optional()
      .refine((v) => !v || z.email().safeParse(v).success, {
        message: 'Invalid email address',
      }),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(500).optional(),
    service_interest: z.enum(SERVICE_SIDES, {
      error: 'Let us know which service you’re interested in',
    }),
    message: z.string().trim().max(5000).optional(),
    // Anti-spam fields (lib/leads/spam.ts), stripped before insert. Not `.default()`: that splits
    // zod's input/output types and breaks useForm's typing.
    website: z.string().max(200),
    elapsedMs: z.number().nonnegative(),
  })
  .refine((d) => Boolean(d.email?.trim()) || Boolean(d.phone?.trim()), {
    path: ['email'],
    message: 'Enter an email or phone number so we can reach you',
  })

export type InquiryFormValues = z.infer<typeof inquiryFormSchema>

/**
 * Job application form. Repeats the inquiry fields because a refined schema can't `.extend()`.
 * The resume File is validated separately by validateResumeFile.
 */
export const jobApplicationFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    email: z
      .string()
      .trim()
      .max(320)
      .optional()
      .refine((v) => !v || z.email().safeParse(v).success, {
        message: 'Invalid email address',
      }),
    phone: z.string().trim().max(40).optional(),
    // Free text: openings are owner-edited, and visitors may apply generally.
    position: z.string().trim().min(1, 'Let us know what role you’re interested in').max(150),
    message: z.string().trim().max(5000).optional(),
    website: z.string().max(200),
    elapsedMs: z.number().nonnegative(),
  })
  .refine((d) => Boolean(d.email?.trim()) || Boolean(d.phone?.trim()), {
    path: ['email'],
    message: 'Enter an email or phone number so we can reach you',
  })

export type JobApplicationFormValues = z.infer<typeof jobApplicationFormSchema>

/** Visitor-facing wording, unlike the staff SERVICE_SIDE_LABELS. */
export const LEAD_SERVICE_INTEREST_LABELS: Record<(typeof SERVICE_SIDES)[number], string> = {
  lawn: 'Lawn care',
  garden: 'Garden design & care',
  both: 'Both',
}

/** Includes staff-only 'other' for phone-in leads shown in the inbox. */
export const LEAD_SERVICE_INTEREST_LABELS_FULL: Record<LeadServiceInterest, string> = {
  ...LEAD_SERVICE_INTEREST_LABELS,
  other: 'Other',
}

/** Staff triage of an existing lead: just a status. */
export const leadStatusSchema = z.enum(LEAD_STATUSES)
