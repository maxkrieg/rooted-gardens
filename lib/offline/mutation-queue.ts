import { getDB, type MutationType, type QueuedMutation } from './idb'
import { createClient } from '@/lib/supabase/client'
import { toUserMessage } from '@/lib/errors'
import type { PhotoType } from '@/types/app'

// Payload types
export interface CompletionPayload {
  visitId: string
  employeeId: string       // the logger (audit trail)
  presentEmployeeIds: string[]  // all crew confirmed on site
  serviceTypes: string[]
  completionNote?: string
  // On-site timing now lives on the visit row. endedAt is always set on completion
  // (it's the completion timestamp, and the source of the visit's "date"). startedAt
  // is set only when the crew started the job (Start tap or a manual start time).
  startedAt?: string
  endedAt: string
}

export interface JobStartPayload {
  visitId: string
  startedAt: string
}

/** Undoes an in-progress Start — clears started_at. Offered only while in
 *  progress, so ended_at is already null; start is the only column to undo. */
export interface JobDiscardPayload {
  visitId: string
}

export interface PhotoPayload {
  visitId: string
  propertyId: string
  storagePath: string
  uploadedBy: string
  type?: string
  caption?: string
}

/** Caption edit for a photo row that ALREADY exists. A photo captured in the
 *  completion logger has no row until submit, so its caption rides along on the
 *  PhotoPayload above instead. */
export interface PhotoCaptionPayload {
  photoId: string
  caption: string | null
}

export interface SkipPayload {
  visitId: string
  skipReason?: string
  // If the visit was in progress when skipped, stop the on-site clock (set ended_at).
  endedAt?: string
}

/** Schedule a property for a week. `id` is minted on the device so the drawer can
 *  open on the new visit offline, and so a replay upserts instead of duplicating. */
export interface CreateVisitPayload {
  id: string
  accountId: string
  propertyId: string
  weekStart: string
}

export interface AssignCrewPayload {
  visitId: string
  employeeId: string
  action: 'add' | 'remove'
}

export interface SetVehiclePayload {
  visitId: string
  vehicleId: string | null
}

export interface CrewInstructionPayload {
  visitId: string
  instruction: string | null
}

/** Revert skipped/completed → scheduled. Clears skip_reason only; completion
 *  fields are left as-is, matching the online hook it replaces. */
export interface RevertStatusPayload {
  visitId: string
}

/** Narrow column patch, NOT the whole property form: updateProperty also writes
 *  address and frequency, and replaying that would clobber an address changed
 *  meanwhile. These three columns are safe to replay. */
export interface PropertyNotesPayload {
  propertyId: string
  crewNotes: string | null
  accessNotes: string | null
  parkingNotes: string | null
}

/** One dispatch note per route group per week — the route sheet's group-header
 *  note. Upserts on (route_group_id, week_start), which is what makes a replay
 *  safe; an empty note deletes the row rather than storing a blank. */
export interface RouteWeekNotePayload {
  routeGroupId: string
  weekStart: string
  note: string
}

/** Move one property onto a route group, or off every route group when
 *  `routeGroupId` is null. property_route_groups has a UNIQUE index on
 *  property_id, so a property sits on at most one route — which is what lets
 *  this upsert rather than delete-then-insert, and makes a replay idempotent. */
export interface AssignPropertyRoutePayload {
  propertyId: string
  routeGroupId: string | null
  /** Position within the route. Drive order — see buildScheduleWeek's sort. */
  sortOrder: number
}

export type MutationPayload =
  | { type: 'completion'; payload: CompletionPayload }
  | { type: 'job_start'; payload: JobStartPayload }
  | { type: 'job_discard'; payload: JobDiscardPayload }
  | { type: 'photo'; payload: PhotoPayload }
  | { type: 'photo_caption'; payload: PhotoCaptionPayload }
  | { type: 'skip'; payload: SkipPayload }
  | { type: 'create_visit'; payload: CreateVisitPayload }
  | { type: 'assign_crew'; payload: AssignCrewPayload }
  | { type: 'set_vehicle'; payload: SetVehiclePayload }
  | { type: 'crew_instruction'; payload: CrewInstructionPayload }
  | { type: 'revert_status'; payload: RevertStatusPayload }
  | { type: 'property_notes'; payload: PropertyNotesPayload }
  | { type: 'route_week_note'; payload: RouteWeekNotePayload }
  | { type: 'assign_property_route'; payload: AssignPropertyRoutePayload }

/**
 * Retries before a mutation is parked as 'failed'. `attempts` used to be
 * incremented and never read, so an RLS denial retried forever while the banner
 * sat on "Syncing 1 change…" and the crew member believed it had saved.
 */
export const MAX_ATTEMPTS = 5

/**
 * Queue-change subscribers. Without this the banner only recounts on mount and
 * on online/offline, so a mutation queued mid-session is invisible and the
 * "Syncing N changes…" state can never render.
 */
const queueListeners = new Set<() => void>()

export function subscribeToQueue(listener: () => void): () => void {
  queueListeners.add(listener)
  return () => queueListeners.delete(listener)
}

function notifyQueueChanged(): void {
  for (const listener of queueListeners) listener()
}

/** Generic over the discriminated union so a payload can't be paired with the
 *  wrong type — the flat signature let `enqueueMutation('skip', jobStart)` pass. */
export async function enqueueMutation<T extends MutationPayload['type']>(
  type: T,
  payload: Extract<MutationPayload, { type: T }>['payload'],
  label?: string,
): Promise<void> {
  const db = await getDB()
  const mutation: QueuedMutation = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    label,
  }
  await db.add('mutations', mutation)
  notifyQueueChanged()
}

/** Mutations still awaiting sync. Excludes parked ('failed') ones. */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDB()
  const all: QueuedMutation[] = await db.getAllFromIndex('mutations', 'by-timestamp')
  return all.filter((m) => m.status !== 'failed')
}

/** Mutations that gave up — what the review sheet lists. */
export async function getFailedMutations(): Promise<QueuedMutation[]> {
  const db = await getDB()
  const all: QueuedMutation[] = await db.getAllFromIndex('mutations', 'by-timestamp')
  return all.filter((m) => m.status === 'failed')
}

export interface QueueCounts {
  pending: number
  failed: number
}

export async function getQueueCounts(): Promise<QueueCounts> {
  const db = await getDB()
  const all: QueuedMutation[] = await db.getAll('mutations')
  return {
    pending: all.filter((m) => m.status !== 'failed').length,
    failed: all.filter((m) => m.status === 'failed').length,
  }
}

/** Back-compat shim — pending-only count, as callers already expect. */
export async function getPendingCount(): Promise<number> {
  return (await getQueueCounts()).pending
}

export async function markMutationDone(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('mutations', id)
  notifyQueueChanged()
}

/** Discard a parked mutation the crew member has decided to give up on. */
export async function discardMutation(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('mutations', id)
  notifyQueueChanged()
}

/** Move a parked mutation back into the queue for one more run of attempts. */
export async function retryMutation(id: string): Promise<void> {
  const db = await getDB()
  const mutation = (await db.get('mutations', id)) as QueuedMutation | undefined
  if (!mutation) return
  await db.put('mutations', {
    ...mutation,
    attempts: 0,
    status: 'pending',
    lastError: undefined,
  })
  notifyQueueChanged()
}

/** Records a failed attempt; parks the mutation past MAX_ATTEMPTS. Returns
 *  true when it was parked. */
async function recordFailure(mutation: QueuedMutation, err: unknown): Promise<boolean> {
  const db = await getDB()
  const attempts = mutation.attempts + 1
  const parked = attempts >= MAX_ATTEMPTS
  await db.put('mutations', {
    ...mutation,
    attempts,
    status: parked ? 'failed' : 'pending',
    lastError: toUserMessage(err, 'It could not be saved.', `[mutation-queue:${mutation.type}]`),
  })
  notifyQueueChanged()
  return parked
}

export interface FlushResult {
  /** Mutations that reached Supabase on this run. */
  synced: number
  /** Mutations parked as 'failed' on this run. */
  failed: number
  /** Mutations still queued afterwards (transient failures + anything skipped). */
  pending: number
  /** True when the flush didn't run because the device is offline. */
  offline: boolean
}

/**
 * Dispatches pending mutations to Supabase, on reconnect and on app mount.
 * Returns a summary rather than void so callers can report what actually
 * happened — SkipSheet and VisitLogger used to claim success unconditionally.
 */
export async function flushMutationQueue(): Promise<FlushResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const counts = await getQueueCounts()
    return { synced: 0, failed: 0, pending: counts.pending, offline: true }
  }

  const pending = await getPendingMutations()
  if (pending.length === 0) return { synced: 0, failed: 0, pending: 0, offline: false }

  let synced = 0
  let failed = 0
  const supabase = createClient()

  for (const mutation of pending) {
    try {
      switch (mutation.type) {
        case 'job_start': {
          const p = mutation.payload as JobStartPayload
          // Start the on-site clock on the visit itself; clear any prior end.
          await supabase
            .from('visits')
            .update({ started_at: p.startedAt, ended_at: null })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'job_discard': {
          const p = mutation.payload as JobDiscardPayload
          // Clear the on-site clock. Only offered while in progress, so
          // ended_at is already null — started_at is the only column to undo.
          await supabase
            .from('visits')
            .update({ started_at: null })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'completion': {
          const p = mutation.payload as CompletionPayload
          await supabase
            .from('visits')
            .update({
              status: 'completed',
              service_types: p.serviceTypes,
              completion_note: p.completionNote ?? null,
              // ended_at is the completion time and the visit's effective date.
              ended_at: p.endedAt,
              // Only set started_at when the crew actually started the job; never
              // overwrite an existing start with null.
              ...(p.startedAt ? { started_at: p.startedAt } : {}),
              // Clear any leftover skip reason — finishing a previously-skipped
              // stop fully un-skips it.
              skip_reason: null,
            })
            .eq('id', p.visitId)
            .throwOnError()
          // Replace all completed rows atomically: clear the old set, then insert
          // the new set from presentEmployeeIds. This handles initial completion and
          // edits (adding / removing crew) in one idempotent operation.
          await supabase
            .from('visit_crew')
            .delete()
            .eq('visit_id', p.visitId)
            .eq('relation', 'completed')
            .throwOnError()
          if (p.presentEmployeeIds.length > 0) {
            await supabase
              .from('visit_crew')
              .insert(
                p.presentEmployeeIds.map((empId) => ({
                  visit_id: p.visitId,
                  employee_id: empId,
                  relation: 'completed' as const,
                }))
              )
              .throwOnError()
          }
          break
        }
        case 'skip': {
          const p = mutation.payload as SkipPayload
          await supabase
            .from('visits')
            .update({
              status: 'skipped',
              skip_reason: p.skipReason ?? null,
              // If the visit was in progress when skipped, stop the on-site clock so
              // the "On site" indicator doesn't keep ticking on an abandoned visit.
              ...(p.endedAt ? { ended_at: p.endedAt } : {}),
            })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'photo':
          // photo row insert — implemented in task 4.5
          // the storage upload is already done optimistically; just insert the photos row
          {
            const p = mutation.payload as PhotoPayload
            await supabase.from('photos').insert({
              visit_id: p.visitId,
              property_id: p.propertyId,
              storage_path: p.storagePath,
              uploaded_by: p.uploadedBy,
              type: (p.type ?? 'visit') as PhotoType,
              caption: p.caption ?? null,
            }).throwOnError()
          }
          break
        case 'photo_caption': {
          const p = mutation.payload as PhotoCaptionPayload
          await supabase
            .from('photos')
            .update({ caption: p.caption })
            .eq('id', p.photoId)
            .throwOnError()
          break
        }
        case 'create_visit': {
          const p = mutation.payload as CreateVisitPayload
          // Upsert, not insert: markMutationDone runs after the write, so a crash
          // between them replays this. (property_id, week_start) is UNIQUE.
          await supabase
            .from('visits')
            .upsert(
              {
                id: p.id,
                account_id: p.accountId,
                property_id: p.propertyId,
                week_start: p.weekStart,
                status: 'scheduled',
              },
              { onConflict: 'property_id,week_start', ignoreDuplicates: true },
            )
            .throwOnError()
          break
        }
        case 'assign_crew': {
          const p = mutation.payload as AssignCrewPayload
          if (p.action === 'add') {
            // ignoreDuplicates so a replay doesn't park on the composite PK.
            await supabase
              .from('visit_crew')
              .upsert(
                { visit_id: p.visitId, employee_id: p.employeeId, relation: 'assigned' },
                { onConflict: 'visit_id,employee_id,relation', ignoreDuplicates: true },
              )
              .throwOnError()
          } else {
            await supabase
              .from('visit_crew')
              .delete()
              .eq('visit_id', p.visitId)
              .eq('employee_id', p.employeeId)
              .eq('relation', 'assigned')
              .throwOnError()
          }
          break
        }
        case 'set_vehicle': {
          const p = mutation.payload as SetVehiclePayload
          await supabase
            .from('visits')
            .update({ vehicle_id: p.vehicleId })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'crew_instruction': {
          const p = mutation.payload as CrewInstructionPayload
          await supabase
            .from('visits')
            .update({ crew_instruction: p.instruction })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'revert_status': {
          const p = mutation.payload as RevertStatusPayload
          await supabase
            .from('visits')
            .update({ status: 'scheduled', skip_reason: null })
            .eq('id', p.visitId)
            .throwOnError()
          break
        }
        case 'property_notes': {
          const p = mutation.payload as PropertyNotesPayload
          await supabase
            .from('properties')
            .update({
              crew_notes: p.crewNotes,
              access_notes: p.accessNotes,
              parking_notes: p.parkingNotes,
            })
            .eq('id', p.propertyId)
            .throwOnError()
          break
        }
        case 'route_week_note': {
          const p = mutation.payload as RouteWeekNotePayload
          // An emptied note is a deleted row, not a stored blank — a blank would
          // render an empty ribbon on the band for the rest of the week.
          if (p.note.trim().length === 0) {
            await supabase
              .from('route_group_week_notes')
              .delete()
              .eq('route_group_id', p.routeGroupId)
              .eq('week_start', p.weekStart)
              .throwOnError()
          } else {
            await supabase
              .from('route_group_week_notes')
              .upsert(
                { route_group_id: p.routeGroupId, week_start: p.weekStart, note: p.note },
                { onConflict: 'route_group_id,week_start' },
              )
              .throwOnError()
          }
          break
        }
        case 'assign_property_route': {
          const p = mutation.payload as AssignPropertyRoutePayload
          if (p.routeGroupId === null) {
            await supabase
              .from('property_route_groups')
              .delete()
              .eq('property_id', p.propertyId)
              .throwOnError()
          } else {
            await supabase
              .from('property_route_groups')
              .upsert(
                {
                  property_id: p.propertyId,
                  route_group_id: p.routeGroupId,
                  sort_order: p.sortOrder,
                },
                { onConflict: 'property_id' },
              )
              .throwOnError()
          }
          break
        }
        default:
          // Throw, don't warn-and-continue: falling through marked an unknown type
          // as synced and deleted it, so a queue written by a newer bundle and
          // flushed by an older one lost the write silently.
          throw new Error(`Unknown mutation type: ${(mutation as QueuedMutation).type}`)
      }
      await markMutationDone(mutation.id)
      synced++
    } catch (err) {
      console.error('[mutation-queue] flush error for', mutation.type, err)
      if (await recordFailure(mutation, err)) failed++
    }
  }

  const counts = await getQueueCounts()
  return { synced, failed, pending: counts.pending, offline: false }
}
