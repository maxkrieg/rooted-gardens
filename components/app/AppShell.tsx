'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Leaf, LogOut, MoreHorizontal, Search } from 'lucide-react'
import { toast } from 'sonner'
import { OfflineBanner } from '@/components/crew/OfflineBanner'
import { InstallPrompt } from '@/components/crew/InstallPrompt'
import { SessionNotice } from '@/components/crew/SessionNotice'
import { CommandPalette } from '@/components/management/CommandPalette'
import { MoreSheet } from '@/components/app/MoreSheet'
import { RoleProvider, useRole } from '@/components/app/RoleProvider'
import { isNavItemActive, navFor, type NavItem } from '@/components/app/nav-items'
import { canAccessRoute } from '@/lib/auth/access'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { useCrewRealtimeSync } from '@/hooks/crew/useCrewRealtimeSync'
import { navLeadCountKey, useNewLeadCount, useUnroutedCount } from '@/hooks/useNavCounts'
import { flushMutationQueue } from '@/lib/offline/mutation-queue'
import { clearPersistedQueryCache } from '@/components/providers'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LEAD_KIND_LABELS, type EmployeeRole, type LeadKind } from '@/types/app'
import { Button } from '@/components/ui/button'

/** Per-item aria-label for a badge — a bare number tells a screen reader nothing. */
function navBadgeLabel(href: string, count: number): string {
  if (href === '/management/leads') return `${count} new lead${count === 1 ? '' : 's'}`
  if (href === '/app/routes') {
    return `${count} propert${count === 1 ? 'y' : 'ies'} not on a route`
  }
  return `${count}`
}

/** Routes gets the clay "gap to close" tone; everything else the primary pill. */
function badgeToneClass(href: string): string {
  return href === '/app/routes' ? 'bg-[var(--clay)] text-white' : 'bg-primary text-primary-foreground'
}

/**
 * The one shell for every signed-in surface, replacing CrewShell,
 * ManagementShell, and ManagementNav.
 *
 * `initialRole` is the httpOnly `rg-role` cookie read server-side — see
 * RoleProvider for why it's a seed rather than the truth.
 */
export function AppShell({
  initialRole,
  userId,
  userEmail,
  children,
}: {
  initialRole: EmployeeRole | null
  userId?: string | null
  userEmail?: string | null
  children: React.ReactNode
}) {
  return (
    <RoleProvider initialRole={initialRole} userId={userId}>
      <AppShellInner userEmail={userEmail}>{children}</AppShellInner>
    </RoleProvider>
  )
}

function AppShellInner({
  userEmail,
  children,
}: {
  userEmail?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { role, employeeId, can } = useRole()
  const { data: employee, isError: employeeError } = useCurrentEmployee()
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const lastToastAt = useRef(0)

  const { data: newLeadCount = 0 } = useNewLeadCount(role)
  const { data: unroutedCount = 0 } = useUnroutedCount()
  const counts: Record<string, number> = {
    '/management/leads': newLeadCount,
    '/app/routes': unroutedCount,
  }

  const { bar, more, all } = navFor(role)
  // The More tab carries one dot summarising every badge it hides, the same
  // job the old mobile hamburger's dot did.
  const moreBadgeCount = more.reduce((sum, item) => sum + (counts[item.href] ?? 0), 0)
  // The palette only finds accounts and opens /app/accounts/:id, so offering it
  // to crew is a dead end — every result would bounce off the proxy gate.
  const canSearch = !!role && canAccessRoute('/app/accounts', role)

  // Flush anything queued during a prior offline session. Both old shells did
  // this; a surface that enqueues without it queues writes that never sync.
  useEffect(() => {
    flushMutationQueue()
  }, [])

  useCrewRealtimeSync(employeeId ?? undefined)

  useEffect(() => {
    if (!canSearch) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canSearch])

  // New-lead toast (task 9.7, in-app half only). Invalidates the count rather
  // than tracking a delta, so it stays correct when another owner triages.
  useEffect(() => {
    if (!can.seeLeads) return

    const supabase = createClient()
    const channel = supabase
      .channel('app_leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: navLeadCountKey })
          if (payload.eventType !== 'INSERT') return

          const now = Date.now()
          if (now - lastToastAt.current < 3_000) return
          lastToastAt.current = now

          const lead = payload.new as { id: string; name: string; kind: string }
          toast('New website inquiry', {
            description: `${lead.name} — ${LEAD_KIND_LABELS[lead.kind as LeadKind] ?? lead.kind}`,
            action: {
              label: 'View',
              onClick: () => router.push(`/management/leads?lead=${lead.id}`),
            },
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [can.seeLeads, router, queryClient])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Wipe the cache before leaving, in that order: `current-employee` is
    // persisted to IndexedDB, so leaving it behind hands the next person to
    // sign in on this phone the previous person's role and cached accounts.
    // The offline mutation queue lives in a different store and is untouched.
    queryClient.clear()
    await clearPersistedQueryCache()
    // replace, not push — Back after signing out shouldn't re-enter the
    // authenticated shell just to be bounced by the proxy.
    router.replace('/login')
    router.refresh()
  }

  return (
    // dvh, not vh — iOS Safari's collapsing URL bar makes 100vh taller than the
    // visible viewport, leaving a sliver of dead space at the bottom.
    <div className="min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 bg-card border-r border-border z-40">
        <Link
          href="/"
          title="Visit the public Rooted Gardens site"
          className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0"
        >
          <Leaf className="h-5 w-5 text-primary shrink-0" />
          <span className="font-display text-[1.1rem] font-semibold text-foreground tracking-tight leading-tight">
            Rooted Gardens
          </span>
        </Link>
        {canSearch && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-input transition-colors"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">Search…</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70 font-mono bg-muted px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>
          </div>
        )}
        <SidebarLinks pathname={pathname} items={all} counts={counts} />
        <div className="border-t border-border px-3 pt-3 pb-3 shrink-0">
          {userEmail && (
            <p className="text-xs text-muted-foreground truncate px-1 mb-2" title={userEmail}>
              {userEmail}
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground px-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Content. No mobile top bar any more — that 56px header, and the
          top-left hamburger in it, is what the bottom bar replaces. */}
      <main
        className={cn(
          'lg:ml-56 min-h-[100dvh]',
          'pt-[env(safe-area-inset-top,0px)] lg:pt-0',
          'pb-[calc(3.5rem+0.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0',
        )}
      >
        <OfflineBanner />
        <InstallPrompt />
        {/* Silent failure here breaks "My stops", the roster, and realtime at once. */}
        {employeeError && !employee && <SessionNotice />}
        {children}
      </main>

      {/* Bottom bar — phone only; desktop uses the sidebar above. */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="flex items-stretch h-14">
          {bar.map((item) => (
            <li key={item.href} className="flex-1">
              <BottomTab
                item={item}
                active={isNavItemActive(item, pathname)}
                count={counts[item.href] ?? 0}
              />
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label={
                moreBadgeCount > 0 ? `More — ${moreBadgeCount} needing attention` : 'More'
              }
              className="relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-sans font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden />
              <span className="leading-none">More</span>
              {moreBadgeCount > 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-[calc(50%-1.25rem)] h-2 w-2 rounded-full bg-primary ring-2 ring-card"
                />
              )}
            </button>
          </li>
        </ul>
      </nav>

      {canSearch && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={more}
        pathname={pathname}
        counts={counts}
        onOpenSearch={canSearch ? () => setPaletteOpen(true) : undefined}
        onSignOut={handleSignOut}
      />
    </div>
  )
}

function BottomTab({
  item,
  active,
  count,
}: {
  item: NavItem
  active: boolean
  count: number
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-sans font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
      <span className="leading-none">{item.label}</span>
      {count > 0 && (
        <span
          className={cn(
            'absolute top-1 right-[calc(50%-1.4rem)] rounded-full px-1 min-w-4 text-center text-[10px] font-semibold tabular-nums ring-2 ring-card',
            badgeToneClass(item.href),
          )}
          aria-label={navBadgeLabel(item.href, count)}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}

function SidebarLinks({
  pathname,
  items,
  counts,
}: {
  pathname: string
  items: NavItem[]
  counts: Record<string, number>
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname)
          const count = counts[item.href] ?? 0
          const Icon = item.icon
          // A hairline before the first desk route keeps the field/desk split
          // legible on desktop, matching what the bottom bar makes obvious.
          const startsDeskGroup = item.href === '/management/leads'
          return (
            <li key={item.href} className={startsDeskGroup ? 'mt-2 pt-2 border-t border-border' : undefined}>
              <Link
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 pointer-coarse:py-3 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded-full px-1.5 min-w-5 text-center text-[11px] font-semibold tabular-nums',
                      badgeToneClass(item.href),
                    )}
                    aria-label={navBadgeLabel(item.href, count)}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
