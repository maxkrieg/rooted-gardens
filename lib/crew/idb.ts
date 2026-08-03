import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'rooted-crew'
// v2 added `status` + `lastError` so a permanently failing mutation can be
// parked instead of retried forever.
const DB_VERSION = 2

export type MutationType =
  | 'completion'
  | 'photo'
  | 'photo_caption'
  | 'job_start'
  | 'job_stop'
  | 'skip'

/** 'failed' mutations are excluded from flushes, so a poisoned one stops burning
 *  a request on every app open, and surfaced so lost work can't stay invisible. */
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

        // v1 → v2: rows predate `status`. Default to 'pending' so work queued
        // before the update still syncs rather than being silently dropped.
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
