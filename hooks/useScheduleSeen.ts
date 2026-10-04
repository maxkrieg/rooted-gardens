'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { VisitWithCrew } from '@/types/app'

const SEEN_KEY = 'rg-schedule-seen'
/** Weeks of skips and reports. A trimmed one only resurfaces if someone pages back that far. */
const MAX_SEEN = 500

type SeenMap = Record<string, string>

/**
 * What crew sent back, as one string. Keyed on content, not updated_at: invoicing or a crew edit
 * by the office bumps updated_at too, and shouldn't resurface a report already read.
 */
function seenSignature(visit: VisitWithCrew): string {
  return [visit.status, visit.skip_reason ?? '', visit.completion_note ?? '', visit.photo_count ?? 0].join('|')
}

function readSeen(): SeenMap {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {}
  } catch {
    return {}
  }
}

// One store per page, so the desktop board's Needs you count and Today's list agree.
let store: SeenMap | null = null
const listeners = new Set<() => void>()
const EMPTY: SeenMap = {}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): SeenMap {
  store ??= readSeen()
  return store
}

/** Per-viewer "seen" for Needs you's skips and crew reports, in localStorage. Changed reports come back. */
export function useScheduleSeen() {
  const seen = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)

  const isSeen = useCallback(
    (visit: VisitWithCrew) => seen[visit.id] === seenSignature(visit),
    [seen],
  )

  const markSeen = useCallback((visit: VisitWithCrew) => {
    // Re-inserted last so the oldest entries are the ones trimmed.
    const rest = { ...getSnapshot() }
    delete rest[visit.id]
    const entries = Object.entries({ ...rest, [visit.id]: seenSignature(visit) })
    store = Object.fromEntries(entries.slice(-MAX_SEEN))
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(store))
    } catch {
      // Private mode or blocked storage: seen lasts for this visit to the page only.
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { isSeen, markSeen }
}
