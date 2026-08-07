'use client'

import { useEffect, useState } from 'react'

/** How often the counter advances. Coarse on purpose: callers only use this
 *  for a spam-timing check (was the form open at least a couple seconds),
 *  not anything needing millisecond precision. */
const ELAPSED_TICK_MS = 500

/**
 * Ticks a plain counter up by `ELAPSED_TICK_MS` on an interval, starting
 * from mount — used by the public lead forms (InquiryForm, task 9.5;
 * JobApplicationForm, task 9.6) to time how long the form has been open
 * before submit, without calling `Date.now()` anywhere in the render path.
 *
 * A direct `Date.now()` read (on mount, or inside the `react-hook-form`
 * submit handler) trips this repo's `react-hooks/purity`/`refs` ESLint
 * rules: a function passed into `form.handleSubmit(...)` is analyzed as
 * reachable during render, so any impure call or ref read inside it gets
 * flagged — unlike a handler assigned directly to a JSX `on*` prop. Ticking
 * a counter via `setInterval`/`setState` (the same pattern already used by
 * `ScheduleGrid`/`CrewsOnSitePanel` for their 30s "tick") sidesteps that
 * entirely: no impure call is ever reachable from render or from an
 * RHF-wrapped submit handler, only from the interval callback itself.
 */
export function useElapsedMs(): number {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsedMs((ms) => ms + ELAPSED_TICK_MS), ELAPSED_TICK_MS)
    return () => clearInterval(id)
  }, [])

  return elapsedMs
}
