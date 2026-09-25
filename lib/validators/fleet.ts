import { z } from 'zod'
import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
} from '@/types/app'

/** Fleet form schemas, shared by the forms and the actions. */

export const vehicleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(VEHICLE_TYPES),
  plate: z.string().trim().optional(),
  status: z.enum(VEHICLE_STATUSES),
  notes: z.string().trim().optional(),
})
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export const equipmentFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(EQUIPMENT_TYPES),
  status: z.enum(EQUIPMENT_STATUSES),
  // ISO date string (yyyy-MM-dd) from a <input type="date">, or empty.
  last_serviced: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})
export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

export const maintenanceLogFormSchema = z.object({
  // ISO date string (yyyy-MM-dd) — the form defaults it to today.
  service_date: z.string().trim().min(1, 'Service date is required'),
  description: z.string().trim().min(1, 'Description is required'),
  next_service_due: z.string().trim().optional(),
  // Number only — the form converts '' → undefined on input change.
  cost: z.number().nonnegative('Must be zero or more').optional(),
})
export type MaintenanceLogFormValues = z.infer<typeof maintenanceLogFormSchema>
