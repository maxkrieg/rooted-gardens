/**
 * Labels for the action codes written by the `audit_row_change()` trigger
 * (supabase/migrations/20260930120000_audit_log.sql). Keep the two in step.
 */

export const AUDIT_GROUPS = [
  'Visits',
  'Crew',
  'Accounts',
  'Properties',
  'Routes',
  'Photos',
  'Billing',
  'Team',
  'Fleet',
  'Leads',
  'Website',
] as const

export type AuditGroup = (typeof AUDIT_GROUPS)[number]

export const AUDIT_ACTIONS: Record<string, { label: string; group: AuditGroup }> = {
  'visit.created': { label: 'Visit scheduled', group: 'Visits' },
  'visit.started': { label: 'Visit started', group: 'Visits' },
  'visit.stopped': { label: 'Visit stopped', group: 'Visits' },
  'visit.start_discarded': { label: 'Start discarded', group: 'Visits' },
  'visit.completed': { label: 'Visit completed', group: 'Visits' },
  'visit.skipped': { label: 'Visit skipped', group: 'Visits' },
  'visit.reverted': { label: 'Visit reset to scheduled', group: 'Visits' },
  'visit.times_edited': { label: 'Visit times edited', group: 'Visits' },
  'visit.instruction_changed': { label: 'Crew instruction changed', group: 'Visits' },
  'visit.vehicle_changed': { label: 'Vehicle changed', group: 'Visits' },
  'visit.invoiced': { label: 'Visit invoiced', group: 'Visits' },
  'visit.updated': { label: 'Visit updated', group: 'Visits' },
  'visit.deleted': { label: 'Visit deleted', group: 'Visits' },

  'crew.assigned': { label: 'Crew assigned', group: 'Crew' },
  'crew.unassigned': { label: 'Crew unassigned', group: 'Crew' },

  'account.created': { label: 'Account created', group: 'Accounts' },
  'account.updated': { label: 'Account updated', group: 'Accounts' },
  'account.archived': { label: 'Account archived', group: 'Accounts' },
  'account.qbo_linked': { label: 'Linked to QuickBooks', group: 'Accounts' },
  'account.deleted': { label: 'Account deleted', group: 'Accounts' },

  'property.created': { label: 'Property added', group: 'Properties' },
  'property.updated': { label: 'Property updated', group: 'Properties' },
  'property.notes_updated': { label: 'Property notes updated', group: 'Properties' },
  'property.archived': { label: 'Property archived', group: 'Properties' },
  'property.route_assigned': { label: 'Property added to route', group: 'Properties' },
  'property.route_removed': { label: 'Property removed from route', group: 'Properties' },
  'property.deleted': { label: 'Property deleted', group: 'Properties' },

  'route.created': { label: 'Route created', group: 'Routes' },
  'route.renamed': { label: 'Route renamed', group: 'Routes' },
  'route.reordered': { label: 'Route moved', group: 'Routes' },
  'route.stops_reordered': { label: 'Route stops reordered', group: 'Routes' },
  'route.defaults_changed': { label: 'Route defaults changed', group: 'Routes' },
  'route.default_crew_added': { label: 'Regular crew added', group: 'Routes' },
  'route.default_crew_removed': { label: 'Regular crew removed', group: 'Routes' },
  'route.week_note_set': { label: 'Week note set', group: 'Routes' },
  'route.week_note_cleared': { label: 'Week note cleared', group: 'Routes' },
  'route.updated': { label: 'Route updated', group: 'Routes' },
  'route.deleted': { label: 'Route deleted', group: 'Routes' },

  'photo.added': { label: 'Photo added', group: 'Photos' },
  'photo.updated': { label: 'Photo edited', group: 'Photos' },
  'photo.deleted': { label: 'Photo deleted', group: 'Photos' },

  'invoice.created': { label: 'Invoice pushed to QuickBooks', group: 'Billing' },
  'invoice.status_synced': { label: 'Invoice status changed', group: 'Billing' },
  'invoice.updated': { label: 'Invoice updated', group: 'Billing' },
  'invoice.deleted': { label: 'Invoice deleted', group: 'Billing' },
  'quickbooks.connected': { label: 'QuickBooks connected', group: 'Billing' },
  'quickbooks.disconnected': { label: 'QuickBooks disconnected', group: 'Billing' },

  'employee.created': { label: 'Employee added', group: 'Team' },
  'employee.updated': { label: 'Employee updated', group: 'Team' },
  'employee.invited': { label: 'Employee invited', group: 'Team' },
  'employee.sms_pref_changed': { label: 'Text preference changed', group: 'Team' },
  'employee.deleted': { label: 'Employee deleted', group: 'Team' },

  'vehicle.created': { label: 'Vehicle added', group: 'Fleet' },
  'vehicle.updated': { label: 'Vehicle updated', group: 'Fleet' },
  'vehicle.deleted': { label: 'Vehicle deleted', group: 'Fleet' },
  'equipment.created': { label: 'Equipment added', group: 'Fleet' },
  'equipment.updated': { label: 'Equipment updated', group: 'Fleet' },
  'equipment.deleted': { label: 'Equipment deleted', group: 'Fleet' },
  'maintenance.logged': { label: 'Maintenance logged', group: 'Fleet' },
  'maintenance.updated': { label: 'Maintenance updated', group: 'Fleet' },
  'maintenance.deleted': { label: 'Maintenance deleted', group: 'Fleet' },

  'lead.created': { label: 'Lead added', group: 'Leads' },
  'lead.status_changed': { label: 'Lead status changed', group: 'Leads' },
  'lead.converted': { label: 'Lead converted to account', group: 'Leads' },
  'lead.updated': { label: 'Lead updated', group: 'Leads' },
  'lead.deleted': { label: 'Lead deleted', group: 'Leads' },

  'site.content_edited': { label: 'Website text edited', group: 'Website' },
  'site.item_added': { label: 'Website item added', group: 'Website' },
  'site.item_updated': { label: 'Website item edited', group: 'Website' },
  'site.item_reordered': { label: 'Website item moved', group: 'Website' },
  'site.item_deleted': { label: 'Website item deleted', group: 'Website' },
}

/** Unknown codes (a trigger action added without a label) show raw rather than break. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action]?.label ?? action
}

/** Human names for the column keys that show up in `changes`. */
const FIELD_LABELS: Record<string, string> = {
  crew_instruction: 'crew instruction',
  vehicle_id: 'vehicle',
  default_vehicle_id: 'default vehicle',
  route_group_id: 'route',
  service_types: 'service types',
  completion_note: 'completion note',
  skip_reason: 'skip reason',
  started_at: 'start time',
  ended_at: 'end time',
  invoice_id: 'invoice',
  qbo_customer_id: 'QuickBooks customer',
  is_archived: 'archived',
  sms_opt_out: 'texts off',
  user_id: 'app login',
  preferred_interval_days: 'preferred interval',
}

/** Columns whose values are ids or blobs, so only the field name is useful. */
const NAME_ONLY = new Set([
  'vehicle_id',
  'default_vehicle_id',
  'route_group_id',
  'invoice_id',
  'user_id',
  'value',
  'data',
  'started_at',
  'ended_at',
  'realm_id',
])

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ').replaceAll('_', ' ') : '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  const text = String(value).replaceAll('_', ' ')
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

/** One-line summary of an UPDATE's changed columns, e.g. "status: scheduled → completed; vehicle". */
export function summarizeChanges(changes: unknown): string | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null

  const parts = Object.entries(changes as Record<string, unknown>).map(([key, pair]) => {
    const name = FIELD_LABELS[key] ?? key.replaceAll('_', ' ')
    if (NAME_ONLY.has(key) || !Array.isArray(pair)) return name
    return `${name}: ${formatValue(pair[0])} → ${formatValue(pair[1])}`
  })
  return parts.length ? parts.join('; ') : null
}
