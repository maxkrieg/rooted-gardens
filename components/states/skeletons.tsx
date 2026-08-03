import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Route-shaped loading skeletons for the management `loading.tsx` files.
 *
 * The rule these follow: a skeleton mirrors the dimensions of the thing it stands
 * in for. Heights and widths here are copied from the real components (h1 is
 * `text-2xl`, cards are `rounded-2xl` with `p-4/5`, stat cards are a 2/4-column
 * grid) so that when data arrives nothing shifts. A generic spinner would be
 * less work and worse — owners open these routes on a phone, where a reflow
 * costs them the tap they had already started.
 */

/** `<h1 className="font-display text-2xl">` plus an optional right-hand control. */
export function PageHeaderSkeleton({
  withSubtitle = false,
  withAction = true,
}: {
  withSubtitle?: boolean
  withAction?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Skeleton className="h-8 w-40" />
        {withSubtitle && <Skeleton className="mt-1.5 h-4 w-56" />}
      </div>
      {withAction && <Skeleton className="h-10 w-32 shrink-0 rounded-md" />}
    </div>
  )
}

/** The dashboard's four tinted stat cards — 2 columns on phone, 4 on desktop. */
export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[86px] rounded-2xl" />
      ))}
    </div>
  )
}

/** A stack of bordered cards, as used by nearly every list view. */
export function CardListSkeleton({
  rows = 4,
  height = 'h-[74px]',
  className,
}: {
  rows?: number
  height?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('rounded-xl', height)} />
      ))}
    </div>
  )
}

/** A section label (`text-xs uppercase tracking-widest`) above a card list. */
export function SectionSkeleton({
  rows = 3,
  height,
}: {
  rows?: number
  height?: string
}) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-32" />
      <CardListSkeleton rows={rows} height={height} />
    </div>
  )
}

/** Header row plus body rows, for the accountant's wide billing tables. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Skeleton className="h-11 rounded-none" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-none" />
        ))}
      </div>
    </div>
  )
}
