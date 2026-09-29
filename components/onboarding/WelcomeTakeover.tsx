'use client'

import { useState } from 'react'
import { Building2, CalendarRange, Leaf, Route, WifiOff, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Welcome } from '@/lib/onboarding/registry'
import { cn } from '@/lib/utils'

// One per slide, in order; extra slides fall back to the leaf.
const SLIDE_ICONS: LucideIcon[] = [CalendarRange, Route, Building2, WifiOff]

/** First sign-in: a few slides of the ideas the app is built on, then into the schedule tour. */
export function WelcomeTakeover({
  open,
  welcome,
  onFinish,
  onDismiss,
}: {
  open: boolean
  welcome: Welcome
  /** Finished the slides; `startTour` is set when they chose to take the tour now. */
  onFinish: (startTour?: string) => void
  onDismiss: () => void
}) {
  const [index, setIndex] = useState(0)
  const slide = welcome.slides[index]
  const isLast = index === welcome.slides.length - 1
  const Icon = SLIDE_ICONS[index] ?? Leaf

  function close(fn: () => void) {
    fn()
    setIndex(0)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close(onDismiss)}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 border-border bg-background p-0',
          // Full screen on a phone, a card on anything wider.
          'h-[100dvh] max-h-[100dvh] max-w-none rounded-none sm:h-auto sm:max-h-[85dvh] sm:max-w-md sm:rounded-2xl',
        )}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-6 pt-12 text-center">
          <p className="mb-8 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Leaf className="h-3.5 w-3.5 text-primary" aria-hidden />
            Welcome to Rooted Gardens
          </p>
          <span
            aria-hidden
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Icon className="h-9 w-9" strokeWidth={1.5} />
          </span>
          <DialogTitle className="font-display text-2xl font-semibold leading-snug text-foreground">
            {slide.title}
          </DialogTitle>
          <DialogDescription className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
            {slide.body}
          </DialogDescription>
        </div>

        <div className="flex justify-center gap-1.5 pb-5" aria-hidden>
          {welcome.slides.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>

        <div className="space-y-2 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
          {isLast ? (
            <>
              {welcome.startTour && (
                <Button className="h-12 w-full" onClick={() => close(() => onFinish(welcome.startTour))}>
                  Show me the schedule
                </Button>
              )}
              <Button variant="ghost" className="h-11 w-full" onClick={() => close(() => onFinish())}>
                I’ll look around myself
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              {index > 0 ? (
                <Button variant="outline" className="h-12 flex-1" onClick={() => setIndex(index - 1)}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" className="h-12 flex-1" onClick={() => close(onDismiss)}>
                  Skip
                </Button>
              )}
              <Button className="h-12 flex-1" onClick={() => setIndex(index + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
