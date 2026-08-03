import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors components/management/AccountsTable: header, search, then rows. */
export default function AccountsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      <CardListSkeleton rows={8} height="h-16" />
    </div>
  )
}
