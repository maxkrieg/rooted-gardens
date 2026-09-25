import { EmptyState } from '@/components/states/EmptyState'

/** Nothing set up vs. filtered out get different copy. "Clear" lives in the filter bar. */
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
