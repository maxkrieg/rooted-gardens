'use client'

import { useCallback, useState } from 'react'
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

/** Per-viewer "seen" for Needs you's skips and crew reports, in localStorage. Changed reports come back. */
export function useScheduleSeen() {
  // Only mounted after ScheduleView's hydration gate, so reading storage up front is safe.
  const [seen, setSeen] = useState<SeenMap>(readSeen)

  const isSeen = useCallback(
    (visit: VisitWithCrew) => seen[visit.id] === seenSignature(visit),
    [seen],
  )

  const markSeen = useCallback((visit: VisitWithCrew) => {
    setSeen((prev) => {
      // Re-inserted last so the oldest entries are the ones trimmed.
      const rest = { ...prev }
      delete rest[visit.id]
      const entries = Object.entries({ ...rest, [visit.id]: seenSignature(visit) })
      const next = Object.fromEntries(entries.slice(-MAX_SEEN))
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      } catch {
        // Private mode or blocked storage: seen lasts for this visit to the page only.
      }
      return next
    })
  }, [])

  return { isSeen, markSeen }
}
