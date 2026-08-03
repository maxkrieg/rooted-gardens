import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REPORTS_MIN_YEAR } from '@/lib/utils/reports'

/**
 * The reports page's single filter row. Plain `<Link>`s, so this stays a
 * server component (same trick as the billing tab strip). It sits above every
 * chart and scopes all of them — never one filter per card.
 */
export function ReportsYearNav({ year }: { year: number }) {
  const currentYear = new Date().getFullYear()
  const canGoBack = year > REPORTS_MIN_YEAR
  const canGoForward = year < currentYear

  const stepClasses =
    'inline-flex items-center justify-center h-11 w-11 rounded-lg border border-border bg-card text-muted-foreground transition-colors'

  return (
    <div className="flex items-center gap-2">
      {canGoBack ? (
        <Link
          href={`/management/reports?year=${year - 1}`}
          className={cn(stepClasses, 'hover:text-foreground hover:border-input')}
          aria-label={`View ${year - 1}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(stepClasses, 'opacity-40')} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      <span className="font-display text-lg font-semibold text-foreground tabular-nums min-w-[3.5rem] text-center">
        {year}
      </span>

      {canGoForward ? (
        <Link
          href={`/management/reports?year=${year + 1}`}
          className={cn(stepClasses, 'hover:text-foreground hover:border-input')}
          aria-label={`View ${year + 1}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(stepClasses, 'opacity-40')} aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}

      {year !== currentYear && (
        <Link
          href="/management/reports"
          className="inline-flex items-center h-11 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          This year
        </Link>
      )}
    </div>
  )
}
