import { z } from 'zod'
import { LEAD_STATUSES, SERVICE_SIDES, type LeadServiceInterest } from '@/types/app'

/**
 * Zod schema for the public inquiry form (task 9.5). Single source of truth
 * — used by both InquiryForm (client) and submitInquiry (Server Action), the
 * same drift-prevention idiom as lib/validators/account.ts.
 *
 * Length caps mirror the `char_length` CHECK constraints on `leads` from the
 * 9.1 migration exactly, so a bad submission is rejected here first —
 * Postgres's constraints are the backstop for a bypassed client, not the
 * first line of defense.
 *
 * `service_interest` is deliberately `SERVICE_SIDES` ('lawn' | 'garden' |
 * 'both'), not the full `LEAD_SERVICE_INTERESTS` — 'other' is a value staff
 * enter by hand for a phone-in lead that doesn't fit either service line; a
 * public visitor always means one of the two lines (or both).
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
    // Anti-spam fields — validated here so a bypassed client still trips
    // them, then stripped before the `leads` insert. See lib/leads/spam.ts.
    // Not `.optional()`/`.default()`: with zod's input/output types diverging
    // under `.default()`, react-hook-form's `useForm<InquiryFormValues>` and
    // zodResolver's inferred input type stop lining up. The form always
    // supplies both via RHF `defaultValues` / the submit handler instead.
    website: z.string().max(200),
    elapsedMs: z.number().nonnegative(),
  })
  .refine((d) => Boolean(d.email?.trim()) || Boolean(d.phone?.trim()), {
    path: ['email'],
    message: 'Enter an email or phone number so we can reach you',
  })

export type InquiryFormValues = z.infer<typeof inquiryFormSchema>

/**
 * Zod schema for the public job application form (task 9.6). A sibling of
 * `inquiryFormSchema`, not an `.extend()` of it — `inquiryFormSchema` is a
 * `ZodEffects` (its own `.refine()` above), which can't be extended, so the
 * shared fields (name/email/phone/message, the email-or-phone refine, and
 * the website/elapsedMs anti-spam pair with the same non-optional/no-
 * `.default()` gotcha noted above) are simply repeated here.
 *
 * Only the form's text fields go through this schema — the resume `File`
 * travels separately as part of the `FormData` `submitJobApplication`
 * receives (see app/(public)/jobs/actions.ts), validated by
 * `validateResumeFile` (lib/utils/resumes.ts) instead.
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
    // Free text, not an enum — open positions are a dynamic, owner-edited
    // list (the `job` collection), and a visitor should be able to apply
    // generally with no specific opening in mind. Cap mirrors
    // jobItemDataSchema's `title` (lib/validators/site-content.ts).
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

/** Visitor-facing wording — distinct from the staff-facing
 *  `SERVICE_SIDE_LABELS` in lib/utils/team.ts, which describes an
 *  employee's assignment rather than pitching a service to a prospect. */
export const LEAD_SERVICE_INTEREST_LABELS: Record<(typeof SERVICE_SIDES)[number], string> = {
  lawn: 'Lawn care',
  garden: 'Garden design & care',
  both: 'Both',
}

/** All four `LeadServiceInterest` values, including the staff-only 'other' —
 *  the inbox (task 9.8) can show a phone-in lead an owner tagged 'other', which
 *  a public visitor can never submit (see the comment on inquiryFormSchema
 *  above), so the visitor-facing map alone doesn't cover every value it renders. */
export const LEAD_SERVICE_INTEREST_LABELS_FULL: Record<LeadServiceInterest, string> = {
  ...LEAD_SERVICE_INTEREST_LABELS,
  other: 'Other',
}

/**
 * Staff-side schema (task 9.8) — a sibling of the public form schemas above,
 * not an extension of them: `inquiryFormSchema`/`jobApplicationFormSchema` are
 * visitor input for creating a lead; this validates an owner/lead triaging
 * one that already exists, a completely different shape (a bare status, not
 * a form's worth of contact fields).
 */
export const leadStatusSchema = z.enum(LEAD_STATUSES)
