import { Skeleton } from '@/components/ui/skeleton'
import { CardListSkeleton } from '@/components/states/skeletons'

/** Mirrors components/management/FleetView: title, then Vehicles and Equipment sections. */
export default function FleetLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
          <CardListSkeleton rows={3} height="h-20" />
        </div>
      ))}
    </div>
  )
}
