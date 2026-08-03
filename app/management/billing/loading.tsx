import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/states/skeletons'

/** Mirrors app/management/billing/page.tsx: header + QBO status, tab row, table. */
export default function BillingLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>
      <div className="flex gap-1.5 border-b border-border pb-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  )
}
