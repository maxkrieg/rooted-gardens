import { z } from 'zod'
import { PROPERTY_FREQUENCIES } from '@/types/app'

export const propertyFormSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  frequency: z.enum(PROPERTY_FREQUENCIES),
  // A string so an empty number input round-trips. Empty = frequency default. Max mirrors the
  // CHECK.
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
