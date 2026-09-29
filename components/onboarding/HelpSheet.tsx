'use client'

import { format, parseISO } from 'date-fns'
import { Check, Leaf, PlayCircle, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useOnboarding, type TourStatus } from '@/components/onboarding/OnboardingProvider'
import { ChecklistItems } from '@/components/onboarding/GettingStartedCard'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<TourStatus, string> = {
  new: 'Not taken',
  updated: 'Updated',
  done: 'Done',
  dismissed: 'Skipped',
}

/** Every tour for this role, the getting-started checklist, and What's new. */
export function HelpSheet({
  open,
  onOpenChange,
  isWide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isWide: boolean
}) {
  const { tours, tasks, news, tourStatus, isNewsDue, startTour, showNews, showWelcome } =
    useOnboarding()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 p-0', isWide ? 'w-full sm:max-w-md' : 'max-h-[88dvh]')}
      >
        <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
          <SheetTitle className="font-display text-xl">Help &amp; tours</SheetTitle>
          <SheetDescription>Short walkthroughs on your real data. Nothing is changed for you.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {tours.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tours
              </h3>
              <ul className="space-y-2">
                {tours.map((tour) => {
                  const status = tourStatus(tour)
                  return (
                    <li key={tour.key}>
                      <button
                        type="button"
                        onClick={() => startTour(tour.key)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                      >
                        {status === 'done' ? (
                          <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <PlayCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[15px] font-semibold text-foreground">
                            {tour.title}
                          </span>
                          <span className="block text-[13px] text-muted-foreground">{tour.summary}</span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            status === 'done' && 'status-completed',
                            status === 'updated' && 'bg-[var(--ochre)]/20 text-[#9A6B16]',
                            (status === 'new' || status === 'dismissed') && 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {status === 'done' ? 'Replay' : STATUS_LABEL[status]}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {tasks.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Getting started
              </h3>
              <ChecklistItems onNavigate={() => onOpenChange(false)} />
            </section>
          )}

          {news.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What’s new
              </h3>
              <ul className="space-y-2">
                {news.map((item) => {
                  const due = isNewsDue(item)
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => showNews(item)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                      >
                        <Sparkles
                          className={cn('mt-0.5 h-4 w-4 shrink-0', due ? 'text-[var(--ochre)]' : 'text-muted-foreground')}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{item.title}</span>
                            {due && <span className="h-2 w-2 rounded-full bg-[var(--ochre)]" aria-label="New" />}
                          </span>
                          <span className="block text-[13px] text-muted-foreground">{item.body}</span>
                          <span className="block text-[11px] text-muted-foreground/70">
                            {format(parseISO(item.introduced), 'MMM d, yyyy')}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <Button variant="ghost" className="h-11 w-full justify-start gap-2 text-muted-foreground" onClick={showWelcome}>
            <Leaf className="h-4 w-4" />
            Show the welcome again
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
