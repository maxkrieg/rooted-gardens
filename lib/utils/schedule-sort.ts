/**
 * How the schedule orders stops within a route group.
 *
 * 'route' is property_route_groups.sort_order — the sequence the crew physically
 * drive, and the default for exactly that reason. 'priority' is a view over the
 * same rows that floats the longest-waiting properties to the top; it writes
 * nothing, and the owner flips back before dispatch.
 */
export type ScheduleSortMode = 'route' | 'priority'

/**
 * One schedule-wide default plus per-group overrides.
 *
 * Two levels because the two questions are different: "show me everything by
 * how late it is" is a planning sweep, while "this one route has drifted" is
 * about a single band. Changing the schedule-wide setting CLEARS the overrides —
 * a control labelled as applying to every route has to actually apply to every
 * route, or it silently does nothing on the group you were just looking at.
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

export function isScheduleSortMode(value: unknown): value is ScheduleSortMode {
  return value === 'route' || value === 'priority'
}

export function sortModeForGroup(state: ScheduleSortState, groupKey: string): ScheduleSortMode {
  return state.byGroup[groupKey] ?? state.all
}

/** Set the schedule-wide mode, dropping every per-group override. */
export function setAllSortMode(mode: ScheduleSortMode): ScheduleSortState {
  return { all: mode, byGroup: {} }
}

/**
 * Override one group. An override equal to the schedule-wide mode is deleted
 * rather than stored, so state that reads as "default" is stored as default —
 * otherwise a later change to `all` would silently skip that group.
 */
export function setGroupSortMode(
  state: ScheduleSortState,
  groupKey: string,
  mode: ScheduleSortMode,
): ScheduleSortState {
  const byGroup = { ...state.byGroup }
  if (mode === state.all) delete byGroup[groupKey]
  else byGroup[groupKey] = mode
  return { ...state, byGroup }
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
