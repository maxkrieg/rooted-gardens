'use client'

import { useEffect, useState } from 'react'

/** Coarse on purpose: only the spam-timing check reads it. */
const ELAPSED_TICK_MS = 500

/**
 * Elapsed time since mount, for the public forms' too-fast check. A ticking counter, because a
 * Date.now() inside an RHF submit handler trips the react-hooks purity lint.
 */
export function useElapsedMs(): number {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsedMs((ms) => ms + ELAPSED_TICK_MS), ELAPSED_TICK_MS)
    return () => clearInterval(id)
  }, [])

  return elapsedMs
}
