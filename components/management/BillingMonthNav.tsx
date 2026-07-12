'use client'

import { useRouter } from 'next/navigation'
import { format, addMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BillingMonthNavProps {
  month: string // 'yyyy-MM'
  view: 'queue' | 'invoiced'
}

/** Prev/next month nav for the billing page — same shape as ScheduleNav, own
 *  component since it navigates a `?month=yyyy-MM` param rather than `?week=`.
 *  Always preserves `view` in the URLs it builds so navigating months doesn't
 *  silently bounce the Invoiced tab back to Queue. */
export function BillingMonthNav({ month, view }: BillingMonthNavProps) {
  const router = useRouter()
  const monthDate = parseISO(`${month}-01`)
  const currentMonth = format(new Date(), 'yyyy-MM')
  const isCurrentMonth = month === currentMonth

  function buildUrl(monthValue: string): string {
    const params = new URLSearchParams({ view, month: monthValue })
    return `/management/billing?${params.toString()}`
  }

  function navigate(delta: number) {
    const next = format(addMonths(monthDate, delta), 'yyyy-MM')
    router.push(buildUrl(next))
  }

  return (
    <div className="flex items-center gap-1.5">
      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => router.push(buildUrl(currentMonth))}
        >
          This month
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(-1)}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="font-display text-sm font-medium text-foreground px-1 min-w-[120px] text-center">
        {format(monthDate, 'MMMM yyyy')}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(1)}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
