import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'

/** Mirrors components/management/TeamView: header + "Add" button, then employee cards. */
export default function TeamLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeaderSkeleton />
      <CardListSkeleton rows={6} height="h-20" />
    </div>
  )
}
