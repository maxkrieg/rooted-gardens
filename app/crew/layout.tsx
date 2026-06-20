'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, User } from 'lucide-react'
import { OfflineBanner } from '@/components/crew/OfflineBanner'
import { flushMutationQueue } from '@/lib/crew/mutation-queue'

const navItems = [
  { href: '/crew/today', label: 'Today', Icon: Home },
  { href: '/crew/history', label: 'History', Icon: Clock },
  { href: '/crew/profile', label: 'Profile', Icon: User },
]

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Flush any mutations that were queued during a prior offline session
  useEffect(() => {
    flushMutationQueue()
  }, [])

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <OfflineBanner />
      {/* Main scrollable content — leaves room for the bottom nav */}
      <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
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
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden
                  />
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
