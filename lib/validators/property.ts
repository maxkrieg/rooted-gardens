import { z } from 'zod'
import { PROPERTY_FREQUENCIES } from '@/types/app'

export const propertyFormSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  frequency: z.enum(PROPERTY_FREQUENCIES),
  parking_notes: z.string().trim().optional(),
  access_notes: z.string().trim().optional(),
  crew_notes: z.string().trim().optional(),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>
