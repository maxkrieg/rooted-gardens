import { EmptyState } from '@/components/states/EmptyState'

/**
 * An empty grid means two different things — nothing set up yet, or filters
 * matched nothing — so they get different marks and copy. The "Clear" control
 * already lives in the filter bar above, so the filtered case only explains.
 */
export function ScheduleEmptyState({ filtered }: { filtered?: boolean }) {
  return filtered ? (
    <EmptyState
      variant="pruned"
      title="No stops match these filters"
      hint="Clear or widen them in the bar above to see the schedule."
      className="rounded-xl border border-border bg-card shadow-warm"
    />
  ) : (
    <EmptyState
      variant="seed"
      title="No route groups configured"
      hint="The schedule is built from route groups. Add properties to one to see it here."
      className="rounded-xl border border-border bg-card shadow-warm"
    />
  )
}
