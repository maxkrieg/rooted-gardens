import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'rooted-crew'
// v2 (task 8.5) added `status` + `lastError` to queued mutations so a permanently
// failing one can be parked instead of retried forever. See the upgrade handler.
const DB_VERSION = 2

export type MutationType =
  | 'completion'
  | 'photo'
  | 'photo_caption'
  | 'job_start'
  | 'job_stop'
  | 'skip'

/**
 * 'pending' — still to be sent, will be retried on the next flush.
 * 'failed'  — gave up after MAX_ATTEMPTS. Excluded from flushes so a poisoned
 *             mutation stops burning a request on every app open, and surfaced
 *             to the crew member so a lost completion can't stay invisible.
 */
export type MutationStatus = 'pending' | 'failed'

export interface QueuedMutation {
  id: string
  type: MutationType
  payload: unknown
  timestamp: string // ISO — captured on device, survives offline sync
  attempts: number
  status: MutationStatus
  /** User-facing reason the last attempt failed. Never a raw Postgres string. */
  lastError?: string
  /** Address of the property this mutation belongs to, captured at enqueue time
   *  so the review sheet can name the stop even when offline. */
  label?: string
}

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', { keyPath: 'id' })
          store.createIndex('by-timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('rq-cache')) {
          db.createObjectStore('rq-cache')
        }

        // v1 → v2: rows predate `status`. Default them to 'pending' so work a
        // crew member queued before the update still syncs — dropping it would
        // silently lose completions, the exact failure this change exists to fix.
        if (oldVersion > 0 && oldVersion < 2) {
          const store = tx.objectStore('mutations')
          store.openCursor().then(function assign(cursor): unknown {
            if (!cursor) return
            const value = cursor.value as Partial<QueuedMutation>
            if (!value.status) cursor.update({ ...value, status: 'pending' })
            return cursor.continue().then(assign)
          })
        }
      },
    })
  }
  return dbPromise
}
