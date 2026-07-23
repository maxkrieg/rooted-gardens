'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, Pencil, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  VehicleStatusBadge,
  EquipmentStatusBadge,
  ServiceDueBadge,
} from '@/components/management/badges'
import { VehicleForm } from '@/components/management/VehicleForm'
import { EquipmentForm } from '@/components/management/EquipmentForm'
import { MaintenanceLogForm } from '@/components/management/MaintenanceLogForm'
import { latestLog } from '@/lib/utils/fleet'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/utils/fleet'
import { cn } from '@/lib/utils'
import type { Vehicle, Equipment, MaintenanceLog } from '@/types/app'

type FleetItemCardProps =
  | { kind: 'vehicle'; item: Vehicle; logs: MaintenanceLog[] }
  | { kind: 'equipment'; item: Equipment; logs: MaintenanceLog[] }

export function FleetItemCard(props: FleetItemCardProps) {
  const { kind, item, logs } = props
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [logging, setLogging] = useState(false)

  const latest = latestLog(logs)
  // Last-service date: vehicles derive it from the latest log; equipment prefers
  // its own last_serviced column (kept in sync by logMaintenance), else the log.
  const lastServiceDate =
    kind === 'equipment' ? (item.last_serviced ?? latest?.service_date ?? null) : (latest?.service_date ?? null)

  const target =
    kind === 'vehicle'
      ? ({ vehicleId: item.id } as const)
      : ({ equipmentId: item.id } as const)

  return (
    <Card className="rounded-2xl border border-border shadow-warm">
      <CardContent className="p-4">
        {/* Header row — toggles expand */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full text-left flex items-start justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        >
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground truncate">
              {item.name}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {kind === 'vehicle'
                ? (item.plate ? item.plate : 'No plate')
                : EQUIPMENT_TYPE_LABELS[item.type] ?? item.type}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <ServiceDueBadge dueDate={latest?.next_service_due} />
              {kind === 'vehicle' ? (
                <VehicleStatusBadge status={item.status} />
              ) : (
                <EquipmentStatusBadge status={item.status} />
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
              aria-hidden
            />
          </div>
        </button>

        {/* Last-service summary line */}
        <p className="text-xs text-muted-foreground mt-2 tabular-nums">
          {lastServiceDate
            ? `Last service: ${format(parseISO(lastServiceDate), 'EEE MMM d, yyyy')}`
            : 'No maintenance logged yet'}
          {latest?.description ? ` — ${latest.description}` : ''}
        </p>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {!logging && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => setLogging(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log Maintenance
                </Button>
              )}
            </div>

            {/* Inline maintenance log form */}
            {logging && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <MaintenanceLogForm
                  target={target}
                  onSuccess={() => setLogging(false)}
                  onCancel={() => setLogging(false)}
                />
              </div>
            )}

            {/* Maintenance timeline */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Maintenance history
              </p>
              {logs.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Wrench className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  No maintenance logged yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {logs.map((log) => (
                    <li key={log.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{log.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            {format(parseISO(log.service_date), 'EEE MMM d, yyyy')}
                            {log.next_service_due && (
                              <span> · next due {format(parseISO(log.next_service_due), 'MMM d, yyyy')}</span>
                            )}
                          </p>
                        </div>
                        {log.cost != null && (
                          <span className="text-sm tabular-nums text-foreground shrink-0">
                            ${log.cost.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">
              Edit {kind === 'vehicle' ? 'Vehicle' : 'Equipment'}
            </SheetTitle>
            <SheetDescription>Update the details for {item.name}.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {kind === 'vehicle' ? (
              <VehicleForm vehicle={item} onSuccess={() => setEditOpen(false)} />
            ) : (
              <EquipmentForm equipment={item} onSuccess={() => setEditOpen(false)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
