import { capabilitiesFor } from '@/lib/auth/access'
import { TOURS, WELCOMES, forRole } from '@/lib/onboarding/registry'
import type { EmployeeRole } from '@/types/app'

export interface OnboardingSummary {
  toursDone: number
  toursTotal: number
  welcomeDone: boolean
}

type Row = { item_key: string; version: number; state: string }

/** For the Team page: how far one person is through what their role is taught. Null if nothing. */
export function summarizeOnboarding(role: EmployeeRole, rows: Row[]): OnboardingSummary | null {
  const can = capabilitiesFor(role)
  const tours = forRole(TOURS, role).filter((t) => !t.capability || can[t.capability])
  const welcome = forRole(WELCOMES, role)[0]
  if (tours.length === 0 && !welcome) return null

  const byKey = new Map(rows.map((row) => [row.item_key, row]))
  const toursDone = tours.filter((t) => {
    const row = byKey.get(t.key)
    return row?.state === 'completed' && row.version >= t.version
  }).length
  return { toursDone, toursTotal: tours.length, welcomeDone: !!welcome && byKey.has(welcome.key) }
}
