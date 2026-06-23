import { getDB, type MutationType, type QueuedMutation } from './idb'
import { createClient } from '@/lib/supabase/client'

// Payload types — filled in as tasks 4.4 and 4.10 are implemented
export interface CompletionPayload {
  visitId: string
  employeeId: string       // the logger (audit trail)
  presentEmployeeIds: string[]  // all crew confirmed on site
  actualDate: string
  serviceTypes: string[]
  completionNote?: string
}

export interface JobStartPayload {
  visitId: string
  employeeId: string
  startedAt: string
}

export interface JobStopPayload {
  sessionId: string
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

type MutationPayload =
  | { type: 'completion'; payload: CompletionPayload }
  | { type: 'job_start'; payload: JobStartPayload }
  | { type: 'job_stop'; payload: JobStopPayload }
  | { type: 'photo'; payload: PhotoPayload }

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
          await supabase.from('visit_sessions').insert({
            visit_id: p.visitId,
            employee_id: p.employeeId,
            started_at: p.startedAt,
            ended_at: null,
            source: 'crew_app',
          })
          break
        }
        case 'job_stop': {
          const p = mutation.payload as JobStopPayload
          await supabase
            .from('visit_sessions')
            .update({ ended_at: p.endedAt })
            .eq('id', p.sessionId)
          break
        }
        case 'completion': {
          const p = mutation.payload as CompletionPayload
          await supabase
            .from('visits')
            .update({
              status: 'completed',
              actual_date: p.actualDate,
              service_types: p.serviceTypes,
              completion_note: p.completionNote ?? null,
            })
            .eq('id', p.visitId)
          // Upsert a completed row for every crew member confirmed on site.
          // Fall back to just the logger for any mutations queued before this field existed.
          const presentIds = p.presentEmployeeIds?.length ? p.presentEmployeeIds : [p.employeeId]
          await supabase.from('visit_crew').upsert(
            presentIds.map((empId) => ({
              visit_id: p.visitId,
              employee_id: empId,
              relation: 'completed' as const,
            }))
          )
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
            })
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
