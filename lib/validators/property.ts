import { z } from 'zod'

export const propertyFormSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  parking_notes: z.string().trim().optional(),
  access_notes: z.string().trim().optional(),
  crew_notes: z.string().trim().optional(),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>
