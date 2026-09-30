import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors components/management/AuditLogView: header, filters, then rows. */
export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} withSubtitle />
      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <CardListSkeleton rows={10} height="h-14" />
    </div>
  )
}
