import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors app/management/routes/page.tsx: header + "New group", the Unrouted
 * panel, then group cards. The panel gets its own clay-tinted placeholder so
 * the layout doesn't jump once real data (with or without unrouted
 * properties) lands.
 */
export default function RoutesLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-2xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.06] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-8" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <CardListSkeleton rows={5} height="h-28" />
    </div>
  )
}
