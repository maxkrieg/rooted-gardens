import { Skeleton } from '@/components/ui/skeleton'

/** First-load placeholder for ScheduleView. Shares its shape with
 *  app/management/schedule/loading.tsx, which covers the RSC shell. */
export function ScheduleSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-56 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, row) => (
              <Skeleton key={row} className="h-14 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
