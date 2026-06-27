import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'rooted-crew'
const DB_VERSION = 1

export type MutationType = 'completion' | 'photo' | 'job_start' | 'job_stop' | 'skip' | 'clock_in' | 'clock_out'

export interface QueuedMutation {
  id: string
  type: MutationType
  payload: unknown
  timestamp: string // ISO — captured on device, survives offline sync
  attempts: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', { keyPath: 'id' })
          store.createIndex('by-timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('rq-cache')) {
          db.createObjectStore('rq-cache')
        }
      },
    })
  }
  return dbPromise
}
