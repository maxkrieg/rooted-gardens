import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors components/management/LeadsInbox: header, filters, then rows. */
export default function LeadsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      <CardListSkeleton rows={8} height="h-16" />
    </div>
  )
}
