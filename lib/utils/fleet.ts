import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { MaintenanceLog } from '@/types/app'

/**
 * Service-due state derived from a maintenance log's next_service_due date.
 * Drives the ServiceDueBadge on the fleet cards (and, later, the dashboard):
 *   - 'overdue'  → next_service_due is in the past
 *   - 'due_soon' → within the next 14 days
 *   - null       → no due date, or comfortably in the future (no badge)
 */
export type ServiceDueState = 'overdue' | 'due_soon'

const DUE_SOON_DAYS = 14

export function serviceDueState(dueDate: string | null | undefined): ServiceDueState | null {
  if (!dueDate) return null
  const days = differenceInCalendarDays(parseISO(dueDate), new Date())
  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'due_soon'
  return null
}

/** The most-recent (by service_date) log from a list, or null. Logs arrive
 *  ordered service_date DESC from the page query, so the first is the latest. */
export function latestLog(logs: MaintenanceLog[]): MaintenanceLog | null {
  return logs[0] ?? null
}

// ─── Display labels ───────────────────────────────────────────────────────────

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In Use',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  truck: 'Truck',
  trailer: 'Trailer',
  other: 'Other',
}

export const EQUIPMENT_STATUS_LABELS = VEHICLE_STATUS_LABELS

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  mower: 'Mower',
  trimmer: 'Trimmer',
  blower: 'Blower',
  edger: 'Edger',
  other: 'Other',
}
