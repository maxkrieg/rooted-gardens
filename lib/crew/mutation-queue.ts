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

export interface JobStopPayload {
  visitId: string
  endedAt: string
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

type MutationPayload =
  | { type: 'completion'; payload: CompletionPayload }
  | { type: 'job_start'; payload: JobStartPayload }
  | { type: 'job_stop'; payload: JobStopPayload }
  | { type: 'job_discard'; payload: JobDiscardPayload }
  | { type: 'photo'; payload: PhotoPayload }
  | { type: 'photo_caption'; payload: PhotoCaptionPayload }
  | { type: 'skip'; payload: SkipPayload }

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

export async function enqueueMutation(
  type: MutationType,
  payload: MutationPayload['payload'],
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
        case 'job_stop': {
          const p = mutation.payload as JobStopPayload
          await supabase
            .from('visits')
            .update({ ended_at: p.endedAt })
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
        default:
          console.warn('[mutation-queue] unknown mutation type:', (mutation as QueuedMutation).type)
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
