/**
 * The schedule's empty state. An empty grid means two very different things:
 * nothing is set up yet, or the active filters matched nothing. The "Clear"
 * control lives in the filter bar directly above, so this only explains.
 */
export function ScheduleEmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-warm p-12 text-center">
      <p className="text-muted-foreground">
        {filtered
          ? 'No stops match these filters. Clear or widen them to see the schedule.'
          : 'No route groups configured. Add properties to a route group to see the schedule.'}
      </p>
    </div>
  )
}
