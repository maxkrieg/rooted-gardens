import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'

/** Mirrors app/management/route-groups/page.tsx: header + "New group", then group cards. */
export default function RouteGroupsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeaderSkeleton />
      <CardListSkeleton rows={5} height="h-28" />
    </div>
  )
}
