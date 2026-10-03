'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRole } from '@/components/app/RoleProvider'
import { useMarkProgress, useOnboardingProgress, type ProgressMap } from '@/hooks/useOnboarding'
import { useMediaQuery } from '@/hooks/use-media-query'
import { subscribeTourEvents } from '@/lib/onboarding/events'
import {
  NEWS,
  TASKS,
  TOURS,
  WELCOMES,
  findTour,
  forRole,
  type NewsItem,
  type Task,
  type Tour,
  type TourStep,
} from '@/lib/onboarding/registry'
import type { Capabilities } from '@/lib/auth/access'
import { TourRunner } from '@/components/onboarding/TourRunner'
import { WelcomeTakeover } from '@/components/onboarding/WelcomeTakeover'
import { HelpSheet } from '@/components/onboarding/HelpSheet'
import { NewsBeacons } from '@/components/onboarding/NewsBeacons'

export type TourStatus = 'new' | 'updated' | 'done' | 'dismissed'

interface OnboardingContextValue {
  /** False until the progress query has data, so nothing flashes before it's known. */
  ready: boolean
  tours: Tour[]
  tasks: Task[]
  news: NewsItem[]
  progress: ProgressMap
  tourStatus: (tour: Tour) => TourStatus
  isTaskDone: (task: Task) => boolean
  isNewsDue: (item: NewsItem) => boolean
  dueNewsCount: number
  activeTourKey: string | null
  startTour: (key: string) => void
  dismissTour: (key: string) => void
  markTask: (task: Task) => void
  dismissChecklist: () => void
  checklistDismissed: boolean
  showNews: (item: NewsItem) => void
  openHelp: () => void
  showWelcome: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

const CHECKLIST_KEY = 'checklist.office'

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider> (mounted by AppShell)')
  return ctx
}

function stepsFor(tour: Tour, can: Capabilities, isWide: boolean): TourStep[] {
  return tour.steps.filter(
    (step) =>
      (!step.capability || can[step.capability]) &&
      (!step.breakpoint || step.breakpoint === (isWide ? 'desktop' : 'mobile')),
  )
}

/** Welcome, tours, checklist and What's new. Surfaces at most one thing at a time. */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { role, can, employeeId, isReconciling, impersonating } = useRole()
  const pathname = usePathname()
  const router = useRouter()
  // Same breakpoint as the nav: bottom bar below, sidebar above.
  const isWide = useMediaQuery('(min-width: 1024px)')
  const { data: progressData } = useOnboardingProgress()
  const mark = useMarkProgress()

  const [activeTourKey, setActiveTourKey] = useState<string | null>(null)
  const [activeNews, setActiveNews] = useState<NewsItem | null>(null)
  const [welcomeForced, setWelcomeForced] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const progress = useMemo(() => progressData ?? {}, [progressData])
  // Nothing pops up or ticks while a super admin is impersonating: it would spend the real
  // person's welcome, tours and checklist before they ever see them.
  const ready = !!progressData && !!employeeId && !isReconciling && !impersonating

  const tours = useMemo(
    () => forRole(TOURS, role).filter((t) => !t.capability || can[t.capability]),
    [role, can],
  )
  const tasks = useMemo(() => forRole(TASKS, role), [role])
  const welcome = useMemo(() => forRole(WELCOMES, role)[0], [role])

  // "Existing user" for news: someone whose first onboarding row predates the item.
  const firstSeenAt = useMemo(() => {
    const dates = Object.values(progress).map((row) => row.created_at)
    return dates.length > 0 ? dates.sort()[0] : null
  }, [progress])

  const isNewsDue = useCallback(
    (item: NewsItem) =>
      !progress[item.key] && !!firstSeenAt && firstSeenAt.slice(0, 10) < item.introduced,
    [progress, firstSeenAt],
  )
  const news = useMemo(() => forRole(NEWS, role).slice().reverse(), [role])
  const dueNewsCount = ready ? news.filter(isNewsDue).length : 0
  const beaconItems = useMemo(
    () =>
      news.filter(
        (item) => isNewsDue(item) && item.route && item.anchor && pathname.startsWith(item.route),
      ),
    [news, isNewsDue, pathname],
  )

  const tourStatus = useCallback(
    (tour: Tour): TourStatus => {
      const row = progress[tour.key]
      if (!row) return 'new'
      if (row.version < tour.version) return 'updated'
      return row.state === 'completed' ? 'done' : 'dismissed'
    },
    [progress],
  )

  const isTaskDone = useCallback(
    (task: Task) => {
      if (progress[task.key]?.state === 'completed') return true
      return typeof task.doneOn === 'object' && progress[task.doneOn.tour]?.state === 'completed'
    },
    [progress],
  )

  // Checklist tasks complete on real work, wherever in the app it happens.
  useEffect(() => {
    if (!ready) return
    return subscribeTourEvents((event) => {
      for (const task of tasks) {
        if (task.doneOn === event && !isTaskDone(task)) mark({ key: task.key, state: 'completed' })
      }
    })
  }, [ready, tasks, isTaskDone, mark])

  const welcomeDue =
    ready && !!welcome && (!progress[welcome.key] || progress[welcome.key].version < welcome.version)
  const welcomeOpen = (welcomeDue || welcomeForced) && !activeTourKey

  const startTour = useCallback(
    (key: string) => {
      const tour = findTour(key)
      if (!tour) return
      setHelpOpen(false)
      setActiveNews(null)
      if (!pathname.startsWith(tour.route)) router.push(tour.route)
      setActiveTourKey(key)
    },
    [pathname, router],
  )

  const activeTour = activeTourKey ? findTour(activeTourKey) : undefined

  // Leaving the tour's area ends it quietly: no progress written, it's still offered.
  useEffect(() => {
    if (activeTour && !pathname.startsWith(activeTour.route)) {
      // Give a replay's router.push a moment to land before judging the path.
      const t = setTimeout(() => {
        if (!window.location.pathname.startsWith(activeTour.route)) setActiveTourKey(null)
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [activeTour, pathname])

  function finishTour(tour: Tour) {
    mark({ key: tour.key, version: tour.version, state: 'completed' })
    // The tour taught whatever its news items announced.
    for (const item of NEWS) {
      if (item.parentTour === tour.key && !progress[item.key]) mark({ key: item.key, state: 'seen' })
    }
    setActiveTourKey(null)
  }

  function closeTour(tour: Tour) {
    mark({ key: tour.key, version: tour.version, state: 'dismissed' })
    setActiveTourKey(null)
  }

  const value: OnboardingContextValue = {
    ready,
    tours,
    tasks,
    news,
    progress,
    tourStatus,
    isTaskDone,
    isNewsDue,
    dueNewsCount,
    activeTourKey,
    startTour,
    dismissTour: (key) => {
      const tour = findTour(key)
      if (tour) mark({ key, version: tour.version, state: 'dismissed' })
    },
    markTask: (task) => mark({ key: task.key, state: 'completed' }),
    dismissChecklist: () => mark({ key: CHECKLIST_KEY, state: 'dismissed' }),
    checklistDismissed: !!progress[CHECKLIST_KEY],
    showNews: (item) => {
      setHelpOpen(false)
      if (item.route && item.anchor) {
        if (!pathname.startsWith(item.route)) router.push(item.route)
        setActiveNews(item)
      } else {
        mark({ key: item.key, state: 'seen' })
      }
    },
    openHelp: () => setHelpOpen(true),
    showWelcome: () => {
      setHelpOpen(false)
      setWelcomeForced(true)
    },
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}

      {welcome && (
        <WelcomeTakeover
          open={welcomeOpen}
          welcome={welcome}
          onFinish={(startTourKey) => {
            mark({ key: welcome.key, version: welcome.version, state: 'completed' })
            setWelcomeForced(false)
            if (startTourKey) startTour(startTourKey)
          }}
          onDismiss={() => {
            mark({ key: welcome.key, version: welcome.version, state: 'dismissed' })
            setWelcomeForced(false)
          }}
        />
      )}

      {activeTour && (
        <TourRunner
          key={`${activeTour.key}-${isWide}`}
          steps={stepsFor(activeTour, can, isWide)}
          isWide={isWide}
          label={`${activeTour.title} tour`}
          onFinish={() => finishTour(activeTour)}
          onClose={() => closeTour(activeTour)}
        />
      )}

      {activeNews && !activeTour && (
        <TourRunner
          key={activeNews.key}
          steps={[{ id: activeNews.key, anchor: activeNews.anchor, title: activeNews.title, body: activeNews.body }]}
          isWide={isWide}
          label="New"
          onFinish={() => {
            mark({ key: activeNews.key, state: 'seen' })
            setActiveNews(null)
          }}
          onClose={() => {
            mark({ key: activeNews.key, state: 'seen' })
            setActiveNews(null)
          }}
        />
      )}

      {ready && !activeTour && !activeNews && !welcomeOpen && (
        <NewsBeacons items={beaconItems} onOpen={setActiveNews} />
      )}

      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} isWide={isWide} />
    </OnboardingContext.Provider>
  )
}
