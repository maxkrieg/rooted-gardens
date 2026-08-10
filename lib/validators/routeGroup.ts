import { z } from 'zod'

export const routeGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Route group name is required'),
})

export type RouteGroupFormValues = z.infer<typeof routeGroupFormSchema>

// Bulk "put N properties on a route" payload — the Unrouted panel's
// select-all-then-assign flow. A single property_id is still validated
// inline by assignProperty; this covers the multi-id bulk action.
//
// z.guid(), not z.uuid(): z.uuid() enforces the RFC4122 version/variant
// nibbles, which rejects the friendly seed IDs this app uses in dev
// (e.g. '00000000-0000-0000-0002-000000000001' — version nibble '0' isn't
// in the allowed [1-8] range). Postgres's uuid column doesn't enforce that
// either, so z.guid() (8-4-4-4-12 hex shape only) matches what the database
// actually accepts.
export const bulkAssignPropertiesSchema = z.object({
  propertyIds: z.array(z.guid()).min(1, 'Select at least one property'),
  routeGroupId: z.guid('Choose a route group'),
})

export type BulkAssignPropertiesValues = z.infer<typeof bulkAssignPropertiesSchema>
