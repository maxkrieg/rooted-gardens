import { z } from 'zod'
import { PROPERTY_FREQUENCIES } from '@/types/app'

export const propertyFormSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  frequency: z.enum(PROPERTY_FREQUENCIES),
  // Kept as a string field so react-hook-form's number input round-trips an
  // empty box cleanly. Empty means "follow the frequency default"; the action
  // is what turns it into a number or null. Upper bound mirrors the DB CHECK.
  preferred_interval_days: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 365),
      'Enter a whole number of days between 1 and 365',
    ),
  parking_notes: z.string().trim().optional(),
  access_notes: z.string().trim().optional(),
  crew_notes: z.string().trim().optional(),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>
