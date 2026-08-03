import { Skeleton } from '@/components/ui/skeleton'
import { SectionSkeleton, StatRowSkeleton } from '@/components/states/skeletons'

/** Mirrors app/management/dashboard/page.tsx: header, stat row, then two sections. */
export default function DashboardLoading() {
  return (
    <div className="max-w-3xl space-y-8 p-4 lg:p-6">
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-1.5 h-4 w-44" />
      </div>
      <section className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <StatRowSkeleton />
      </section>
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={2} height="h-[70px]" />
    </div>
  )
}
