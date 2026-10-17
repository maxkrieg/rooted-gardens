import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Matches the Help page: header, the tours strip, search, then topic rows. */
export default function HelpLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <CardListSkeleton rows={6} height="h-14" />
    </div>
  )
}
