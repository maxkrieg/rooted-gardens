'use client'

import { usePathname } from 'next/navigation'
import { PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'

/** "New to Routes? Quick tour" — a soft offer on the first visit, and again when a tour changes. */
export function TourOffer() {
  const pathname = usePathname()
  const { ready, tours, tourStatus, activeTourKey, startTour, dismissTour } = useOnboarding()
  if (!ready || activeTourKey) return null

  const tour = tours.find(
    (t) => t.route === pathname && ['new', 'updated'].includes(tourStatus(t)),
  )
  if (!tour) return null
  const updated = tourStatus(tour) === 'updated'

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent px-4 py-2.5 text-accent-foreground">
      <PlayCircle className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium">
        {updated ? `${tour.title} has changed. Quick tour?` : `New to ${tour.title}? Take a quick tour.`}
      </p>
      <Button variant="ghost" className="h-11 shrink-0 px-3" onClick={() => dismissTour(tour.key)}>
        Not now
      </Button>
      <Button className="h-11 shrink-0 px-4" onClick={() => startTour(tour.key)}>
        Start
      </Button>
    </div>
  )
}
