import { createClient } from '@/lib/supabase/server'
import { FleetView } from '@/components/management/FleetView'
import { ErrorState } from '@/components/states/ErrorState'
import type { Vehicle, Equipment, MaintenanceLog } from '@/types/app'

/** Fleet page: vehicles, equipment and maintenance logs, merged in JS for FleetView. */
export default async function FleetPage() {
  const supabase = await createClient()

  const [vehiclesRes, equipmentRes, logsRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('name'),
    supabase.from('equipment').select('*').order('name'),
    supabase.from('maintenance_logs').select('*').order('service_date', { ascending: false }),
  ])

  if (vehiclesRes.error || equipmentRes.error || logsRes.error) {
    console.error(
      '[fleet]',
      vehiclesRes.error ?? equipmentRes.error ?? logsRes.error,
    )
    return (
      <ErrorState
        title="Fleet and equipment didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

  // Group logs by their target (already ordered service_date DESC → newest first).
  const logsByVehicle: Record<string, MaintenanceLog[]> = {}
  const logsByEquipment: Record<string, MaintenanceLog[]> = {}
  for (const log of (logsRes.data ?? []) as MaintenanceLog[]) {
    if (log.vehicle_id) (logsByVehicle[log.vehicle_id] ??= []).push(log)
    else if (log.equipment_id) (logsByEquipment[log.equipment_id] ??= []).push(log)
  }

  return (
    <FleetView
      vehicles={(vehiclesRes.data ?? []) as Vehicle[]}
      equipment={(equipmentRes.data ?? []) as Equipment[]}
      logsByVehicle={logsByVehicle}
      logsByEquipment={logsByEquipment}
    />
  )
}
