import { z } from 'zod'
import { ZONE_FREQUENCIES } from '@/types/app'

export const serviceZoneFormSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required'),
  frequency: z.enum(ZONE_FREQUENCIES),
  notes: z.string().trim().optional(),
  // sort_order is managed server-side (auto-increment on create, swap on reorder)
  // active is toggled via setZoneActive, not included in the create/edit form schema
})

export type ServiceZoneFormValues = z.infer<typeof serviceZoneFormSchema>
