'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, User, CalendarRange } from 'lucide-react'
import { OfflineBanner } from '@/components/crew/OfflineBanner'
import { flushMutationQueue } from '@/lib/crew/mutation-queue'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { useTodayTimeEntry } from '@/hooks/crew/useTodayTimeEntry'
import { useCrewRealtimeSync } from '@/hooks/crew/useCrewRealtimeSync'

const navItems = [
  { href: '/crew/schedule', label: 'Schedule', Icon: CalendarRange },
  { href: '/crew/history', label: 'History', Icon: Clock },
  { href: '/crew/profile', label: 'Profile', Icon: User },
]

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: employee } = useCurrentEmployee()
  const { data: todayEntries = [] } = useTodayTimeEntry(employee?.id)
  const isClockedIn = todayEntries.length > 0 && todayEntries[0].clock_out === null

  // Flush any mutations that were queued during a prior offline session
  useEffect(() => {
    flushMutationQueue()
  }, [])

  // Push schedule changes to the React Query cache in real time
  useCrewRealtimeSync(employee?.id)

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <OfflineBanner />
      {/* Main scrollable content — leaves room for the bottom nav */}
      <main className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="flex items-stretch h-14">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={[
                    'flex flex-col items-center justify-center h-full gap-0.5 text-xs font-sans font-medium transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  <div className="relative">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden
                    />
                    {href === '/crew/profile' && isClockedIn && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: 'var(--clay)' }}
                        />
                        <span
                          className="relative inline-flex rounded-full h-2 w-2"
                          style={{ backgroundColor: 'var(--clay)' }}
                        />
                      </span>
                    )}
                  </div>
                  <span className="leading-none">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
