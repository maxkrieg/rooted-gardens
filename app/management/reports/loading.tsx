import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors app/management/reports/page.tsx: header + year nav, then three chart cards. */
export default function ReportsLoading() {
  return (
    <div className="max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1.5 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
