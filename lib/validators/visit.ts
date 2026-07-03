import { z } from 'zod'

export const routeAssignSchema = z.object({
  week_start: z.string(),
  employee_ids: z.array(z.string()),
  vehicle_id: z.string().nullable().optional(),
})

export type RouteAssignValues = z.infer<typeof routeAssignSchema>
