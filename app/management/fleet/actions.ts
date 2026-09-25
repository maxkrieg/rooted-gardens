'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  vehicleFormSchema,
  equipmentFormSchema,
  maintenanceLogFormSchema,
  type VehicleFormValues,
  type EquipmentFormValues,
  type MaintenanceLogFormValues,
} from '@/lib/validators/fleet'
import { toUserMessage } from '@/lib/errors'

/** Fleet actions. RLS client (owner/lead write policies); each revalidates /management/fleet. */

function vehiclePayload(data: VehicleFormValues) {
  return {
    name: data.name,
    type: data.type,
    plate: data.plate?.trim() || null,
    status: data.status,
    notes: data.notes?.trim() || null,
  }
}

export async function createVehicle(values: VehicleFormValues): Promise<{ error?: string }> {
  const parsed = vehicleFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').insert(vehiclePayload(parsed.data))
  if (error) {
    return { error: toUserMessage(error, 'Could not add the vehicle.', '[createVehicle]') }
  }
  revalidatePath('/management/fleet')
  return {}
}

export async function updateVehicle(
  id: string,
  values: VehicleFormValues,
): Promise<{ error?: string }> {
  const parsed = vehicleFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').update(vehiclePayload(parsed.data)).eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not save the vehicle.', '[updateVehicle]') }
  }
  revalidatePath('/management/fleet')
  return {}
}

function equipmentPayload(data: EquipmentFormValues) {
  return {
    name: data.name,
    type: data.type,
    status: data.status,
    last_serviced: data.last_serviced?.trim() || null,
    notes: data.notes?.trim() || null,
  }
}

export async function createEquipment(values: EquipmentFormValues): Promise<{ error?: string }> {
  const parsed = equipmentFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('equipment').insert(equipmentPayload(parsed.data))
  if (error) {
    return { error: toUserMessage(error, 'Could not add the equipment.', '[createEquipment]') }
  }
  revalidatePath('/management/fleet')
  return {}
}

export async function updateEquipment(
  id: string,
  values: EquipmentFormValues,
): Promise<{ error?: string }> {
  const parsed = equipmentFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('equipment').update(equipmentPayload(parsed.data)).eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not save the equipment.', '[updateEquipment]') }
  }
  revalidatePath('/management/fleet')
  return {}
}

/** Log maintenance for one vehicle or equipment item. For equipment, also sets last_serviced. */
export async function logMaintenance(
  target: { vehicleId: string } | { equipmentId: string },
  values: MaintenanceLogFormValues,
): Promise<{ error?: string }> {
  const parsed = maintenanceLogFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('maintenance_logs').insert({
    vehicle_id: 'vehicleId' in target ? target.vehicleId : null,
    equipment_id: 'equipmentId' in target ? target.equipmentId : null,
    service_date: parsed.data.service_date,
    description: parsed.data.description,
    next_service_due: parsed.data.next_service_due?.trim() || null,
    cost: parsed.data.cost ?? null,
  })
  if (error) {
    return { error: toUserMessage(error, 'Could not log the maintenance.', '[logMaintenance]') }
  }

  if ('equipmentId' in target) {
    const { error: updErr } = await supabase
      .from('equipment')
      .update({ last_serviced: parsed.data.service_date })
      .eq('id', target.equipmentId)
    if (updErr) console.error('[logMaintenance] equipment last_serviced', updErr)
  }

  revalidatePath('/management/fleet')
  return {}
}
