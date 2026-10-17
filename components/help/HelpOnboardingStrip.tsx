'use client'

import { format, parseISO } from 'date-fns'
import { Check, Leaf, PlayCircle, Sparkles } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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

/** Tours, Getting started and What's new, at the top of the Help page (formerly the Help & tours sheet). */
export function HelpOnboardingStrip() {
  const {
    tours,
    tasks,
    news,
    hasWelcome,
    tourStatus,
    isTaskDone,
    isNewsDue,
    dueNewsCount,
    startTour,
    showNews,
    showWelcome,
  } = useOnboarding()

  if (tours.length === 0 && tasks.length === 0 && news.length === 0) return null

  const tasksDone = tasks.filter(isTaskDone).length
  // Newest first here; the registry keeps them oldest first.
  const newsNewestFirst = [...news].reverse()

  return (
    <div className="rounded-2xl border border-border bg-card px-4 shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
      <Accordion type="multiple" defaultValue={dueNewsCount > 0 ? ['news'] : []}>
        {tours.length > 0 && (
          <AccordionItem value="tours" className="border-border/70">
            <AccordionTrigger className="min-h-12 py-3 hover:no-underline">
              <StripLabel icon={<PlayCircle className="h-4 w-4" />} title="Tours" detail="Walkthroughs on your real data" />
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {tours.map((tour) => {
                  const status = tourStatus(tour)
                  return (
                    <li key={tour.key}>
                      <button
                        type="button"
                        onClick={() => startTour(tour.key)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary"
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
              {hasWelcome && (
                <Button
                  variant="ghost"
                  className="mt-2 h-11 w-full justify-start gap-2 text-muted-foreground"
                  onClick={showWelcome}
                >
                  <Leaf className="h-4 w-4" />
                  Show the welcome again
                </Button>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {tasks.length > 0 && (
          <AccordionItem value="tasks" className="border-border/70">
            <AccordionTrigger className="min-h-12 py-3 hover:no-underline">
              <StripLabel
                icon={<Check className="h-4 w-4" />}
                title="Getting started"
                detail={`${tasksDone} of ${tasks.length} done`}
              />
            </AccordionTrigger>
            <AccordionContent>
              <ChecklistItems />
            </AccordionContent>
          </AccordionItem>
        )}

        {news.length > 0 && (
          <AccordionItem value="news" className="border-b-0">
            <AccordionTrigger className="min-h-12 py-3 hover:no-underline">
              <StripLabel
                icon={<Sparkles className={cn('h-4 w-4', dueNewsCount > 0 && 'text-[var(--ochre)]')} />}
                title="What’s new"
                detail={dueNewsCount > 0 ? `${dueNewsCount} new` : `${news.length} updates`}
              />
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {newsNewestFirst.map((item) => {
                  const due = isNewsDue(item)
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => showNews(item)}
                        className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary"
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
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}

function StripLabel({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold text-foreground">{title}</span>
      <span className="truncate text-sm font-normal text-muted-foreground">{detail}</span>
    </span>
  )
}
