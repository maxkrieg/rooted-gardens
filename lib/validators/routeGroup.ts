import { z } from 'zod'

export const routeGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Route group name is required'),
})

export type RouteGroupFormValues = z.infer<typeof routeGroupFormSchema>

// Bulk assign payload for the Unrouted panel. z.guid(), not z.uuid(): dev seed ids fail
// RFC4122's version check, and Postgres doesn't enforce it either.
export const bulkAssignPropertiesSchema = z.object({
  propertyIds: z.array(z.guid()).min(1, 'Select at least one property'),
  routeGroupId: z.guid('Choose a route group'),
})
