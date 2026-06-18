import { z } from 'zod'
import { VISIT_STATUSES } from '@/types/app'

export const visitUpdateSchema = z.object({
  status: z.enum(VISIT_STATUSES),
  crew_instruction: z.string().trim().nullable().optional(),
  vehicle_id: z.string().nullable().optional(),
  assigned_crew_ids: z.array(z.string()),
})

export type VisitUpdateValues = z.infer<typeof visitUpdateSchema>
