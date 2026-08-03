import { EmptyState } from '@/components/states/EmptyState'

/**
 * The schedule's empty state. An empty grid means two very different things:
 * nothing is set up yet, or the active filters matched nothing — so the two get
 * different marks and different copy. The "Clear" control lives in the filter bar
 * directly above, so the filtered case explains rather than duplicating it.
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
