import { getDB, type MutationType, type QueuedMutation } from './idb'
import { createClient } from '@/lib/supabase/client'

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

export interface PhotoPayload {
  visitId: string
  propertyId: string
  storagePath: string
  uploadedBy: string
  type?: string
  caption?: string
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
  | { type: 'photo'; payload: PhotoPayload }
  | { type: 'skip'; payload: SkipPayload }

export async function enqueueMutation(
  type: MutationType,
  payload: MutationPayload['payload']
): Promise<void> {
  const db = await getDB()
  const mutation: QueuedMutation = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
    attempts: 0,
  }
  await db.add('mutations', mutation)
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDB()
  return db.getAllFromIndex('mutations', 'by-timestamp')
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB()
  return db.count('mutations')
}

export async function markMutationDone(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('mutations', id)
}

async function incrementAttempts(mutation: QueuedMutation): Promise<void> {
  const db = await getDB()
  await db.put('mutations', { ...mutation, attempts: mutation.attempts + 1 })
}

// Dispatches each pending mutation to Supabase. Called on reconnect and on app mount.
// Handlers for 'completion' and 'photo' are stubs until tasks 4.4 / 4.5 land.
export async function flushMutationQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const pending = await getPendingMutations()
  if (pending.length === 0) return

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
              type: (p.type ?? 'visit') as 'visit' | 'how_to' | 'customer_request' | 'before' | 'after',
              caption: p.caption ?? null,
            }).throwOnError()
          }
          break
        default:
          console.warn('[mutation-queue] unknown mutation type:', (mutation as QueuedMutation).type)
      }
      await markMutationDone(mutation.id)
    } catch (err) {
      console.error('[mutation-queue] flush error for', mutation.type, err)
      await incrementAttempts(mutation)
    }
  }
}
