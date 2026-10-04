/**
 * Stop order within a route group: 'route' is sort_order, the drive order (the default);
 * 'priority' floats the longest-waiting first and writes nothing.
 */
export type ScheduleSortMode = 'route' | 'priority'

/**
 * A schedule-wide default plus per-group overrides. Changing the default clears the overrides,
 * so "all routes" really applies to all.
 */
export type ScheduleSortState = {
  all: ScheduleSortMode
  /** Keyed by route group id, plus UNGROUPED_SORT_KEY for the no-route bucket. */
  byGroup: Record<string, ScheduleSortMode>
}

/** The "Not on a route" bucket has no route_groups row, so it needs a stand-in key. */
export const UNGROUPED_SORT_KEY = '__ungrouped__'

export const SCHEDULE_SORT_KEY = 'rg-schedule-sort'

export const DEFAULT_SCHEDULE_SORT: ScheduleSortState = { all: 'route', byGroup: {} }

function isScheduleSortMode(value: unknown): value is ScheduleSortMode {
  return value === 'route' || value === 'priority'
}

export function sortModeForGroup(state: ScheduleSortState, groupKey: string): ScheduleSortMode {
  return state.byGroup[groupKey] ?? state.all
}

/** Set the schedule-wide mode, dropping every per-group override. */
export function setAllSortMode(mode: ScheduleSortMode): ScheduleSortState {
  return { all: mode, byGroup: {} }
}

/** Tolerant of anything in localStorage, including the older bare-string format. */
export function parseScheduleSortState(raw: string | null): ScheduleSortState | null {
  if (!raw) return null
  if (isScheduleSortMode(raw)) return { all: raw, byGroup: {} }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { all, byGroup } = parsed as { all?: unknown; byGroup?: unknown }
    if (!isScheduleSortMode(all)) return null

    const clean: Record<string, ScheduleSortMode> = {}
    if (typeof byGroup === 'object' && byGroup !== null) {
      for (const [key, value] of Object.entries(byGroup)) {
        if (isScheduleSortMode(value)) clean[key] = value
      }
    }
    return { all, byGroup: clean }
  } catch {
    return null
  }
}
