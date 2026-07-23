'use client'

import { useState } from 'react'
import { Plus, Truck, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FleetItemCard } from '@/components/management/FleetItemCard'
import { VehicleForm } from '@/components/management/VehicleForm'
import { EquipmentForm } from '@/components/management/EquipmentForm'
import type { Vehicle, Equipment, MaintenanceLog } from '@/types/app'

interface FleetViewProps {
  vehicles: Vehicle[]
  equipment: Equipment[]
  logsByVehicle: Record<string, MaintenanceLog[]>
  logsByEquipment: Record<string, MaintenanceLog[]>
}

export function FleetView({ vehicles, equipment, logsByVehicle, logsByEquipment }: FleetViewProps) {
  const [newVehicleOpen, setNewVehicleOpen] = useState(false)
  const [newEquipmentOpen, setNewEquipmentOpen] = useState(false)

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Truck className="h-5 w-5 text-primary shrink-0" />
        <h1 className="font-display text-2xl font-semibold text-foreground">Fleet &amp; Equipment</h1>
      </div>

      {/* ── Vehicles ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Vehicles
          </h2>
          <Button className="gap-2 h-10" onClick={() => setNewVehicleOpen(true)}>
            <Plus className="h-4 w-4" />
            New Vehicle
          </Button>
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-10 w-10 text-muted-foreground/30 mb-4" />}
            title="No vehicles yet."
            hint="Add your trucks and trailers to track their status and maintenance."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <FleetItemCard key={v.id} kind="vehicle" item={v} logs={logsByVehicle[v.id] ?? []} />
            ))}
          </div>
        )}
      </section>

      {/* ── Equipment ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Equipment
          </h2>
          <Button className="gap-2 h-10" onClick={() => setNewEquipmentOpen(true)}>
            <Plus className="h-4 w-4" />
            New Equipment
          </Button>
        </div>

        {equipment.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-10 w-10 text-muted-foreground/30 mb-4" />}
            title="No equipment yet."
            hint="Add mowers, trimmers, and blowers to track service schedules."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.map((e) => (
              <FleetItemCard key={e.id} kind="equipment" item={e} logs={logsByEquipment[e.id] ?? []} />
            ))}
          </div>
        )}
      </section>

      {/* New Vehicle sheet */}
      <Sheet open={newVehicleOpen} onOpenChange={setNewVehicleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">New Vehicle</SheetTitle>
            <SheetDescription>Add a truck or trailer to the fleet.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <VehicleForm onSuccess={() => setNewVehicleOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* New Equipment sheet */}
      <Sheet open={newEquipmentOpen} onOpenChange={setNewEquipmentOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">New Equipment</SheetTitle>
            <SheetDescription>Add a mower, trimmer, or other equipment item.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EquipmentForm onSuccess={() => setNewEquipmentOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl">
      {icon}
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>
    </div>
  )
}
