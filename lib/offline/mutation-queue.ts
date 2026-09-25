import { getDB, type QueuedMutation } from './idb'
import { createClient } from '@/lib/supabase/client'
import { toUserMessage } from '@/lib/errors'
import type { PhotoType } from '@/types/app'

// Payload types
interface CompletionPayload {
  visitId: string
  employeeId: string       // the logger (audit trail)
  presentEmployeeIds: string[]  // all crew confirmed on site
  serviceTypes: string[]
  completionNote?: string
  // endedAt is always set on completion; startedAt only if the job was started.
  startedAt?: string
  endedAt: string
}

interface JobStartPayload {
  visitId: string
  startedAt: string
}

/** Undoes an in-progress Start — clears started_at. Offered only while in
 *  progress, so ended_at is already null; start is the only column to undo. */
interface JobDiscardPayload {
  visitId: string
}

interface PhotoPayload {
  visitId: string
  propertyId: string
  storagePath: string
  uploadedBy: string
  type?: string
  caption?: string
}

/** Caption edit for an existing photo row. New photos carry their caption in PhotoPayload. */
interface PhotoCaptionPayload {
  photoId: string
  caption: string | null
}

interface SkipPayload {
  visitId: string
  skipReason?: string
  // If the visit was in progress when skipped, stop the on-site clock (set ended_at).
  endedAt?: string
}

/** Schedule a property for a week. `id` is minted on the device so the drawer can
 *  open on the new visit offline, and so a replay upserts instead of duplicating. */
interface CreateVisitPayload {
  id: string
  accountId: string
  propertyId: string
  weekStart: string
}

interface AssignCrewPayload {
  visitId: string
  employeeId: string
  action: 'add' | 'remove'
}

interface SetVehiclePayload {
  visitId: string
  vehicleId: string | null
}

interface CrewInstructionPayload {
  visitId: string
  instruction: string | null
}

/** Revert skipped/completed → scheduled. Clears skip_reason only; completion
 *  fields are left as-is, matching the online hook it replaces. */
interface RevertStatusPayload {
  visitId: string
}

/**
 * Narrow patch, not the whole property form, so a replay can't clobber an address edit.
 * `preferredIntervalDays` is optional: phones may hold items queued before it existed.
 */
interface PropertyNotesPayload {
  propertyId: string
  crewNotes: string | null
  accessNotes: string | null
  parkingNotes: string | null
  preferredIntervalDays?: number | null
}

/** Upserts on (route_group_id, week_start) so replay is safe; empty note deletes the row. */
interface RouteWeekNotePayload {
  routeGroupId: string
  weekStart: string
  note: string
}

/**
 * Move a property onto a route (or off all, if null). UNIQUE property_id makes the upsert
 * idempotent.
 */
interface AssignPropertyRoutePayload {
  propertyId: string
  routeGroupId: string | null
  /** Position within the route. Drive order — see buildScheduleWeek's sort. */
  sortOrder: number
}

type MutationPayload =
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

/** Retries before a mutation is parked as 'failed' and shown in "Changes that didn't save". */
const MAX_ATTEMPTS = 5

/** Queue-change subscribers, so the banner recounts when something is queued mid-session. */
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
async function getPendingMutations(): Promise<QueuedMutation[]> {
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

interface QueueCounts {
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

async function markMutationDone(id: string): Promise<void> {
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

interface FlushResult {
  /** Mutations that reached Supabase on this run. */
  synced: number
  /** Mutations parked as 'failed' on this run. */
  failed: number
  /** Mutations still queued afterwards (transient failures + anything skipped). */
  pending: number
  /** True when the flush didn't run because the device is offline. */
  offline: boolean
}

/** Flushes pending mutations to Supabase; returns a summary so callers can report failures. */
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
          // Replace all completed rows (delete then insert): idempotent for first logs and edits.
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
              // Absent on items queued before the interval field shipped — those
              // must not null out a value the owner set since.
              ...(p.preferredIntervalDays !== undefined
                ? { preferred_interval_days: p.preferredIntervalDays }
                : {}),
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
          // Throw on unknown types: an older bundle must not mark a newer write as synced.
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
