import { createClient } from '@/lib/supabase/server'
import { FleetView } from '@/components/management/FleetView'
import type { Vehicle, Equipment, MaintenanceLog } from '@/types/app'

/**
 * Fleet & Equipment management page (tasks 6.1 + 6.3).
 * Server Component — fetches vehicles, equipment, and maintenance logs, groups
 * the logs by target in JS (the same merge-in-JS pattern as the accounts page),
 * then hands the merged data to the interactive FleetView client component.
 */
export default async function FleetPage() {
  const supabase = await createClient()

  const [vehiclesRes, equipmentRes, logsRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('name'),
    supabase.from('equipment').select('*').order('name'),
    supabase.from('maintenance_logs').select('*').order('service_date', { ascending: false }),
  ])

  if (vehiclesRes.error || equipmentRes.error || logsRes.error) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Could not load fleet — try refreshing.
      </div>
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
