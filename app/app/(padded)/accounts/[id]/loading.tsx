import { Skeleton } from '@/components/ui/skeleton'
import { CardListSkeleton } from '@/components/states/skeletons'

/** Mirrors the account detail page: back link, name + badges, tab row, tab body. */
export default function AccountDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex gap-1.5 border-b border-border pb-px">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <CardListSkeleton rows={4} />
    </div>
  )
}
