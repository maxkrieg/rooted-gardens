'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Inbox,
  Receipt,
  Route,
  BarChart3,
  Truck,
  UserCircle,
  Menu,
  LogOut,
  Leaf,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { CommandPalette } from '@/components/management/CommandPalette'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LEAD_KIND_LABELS } from '@/types/app'
import type { LeadKind } from '@/types/app'

// `roles` gates a nav item to specific roles — undefined means every
// management role sees it. Leads is owner/lead (matching leads RLS exactly);
// Team is owner-only (task 7.1), converted from the old `ownerOnly: true`
// flag to the same mechanism so there's a single way to gate a nav item.
const NAV_ITEMS = [
  { href: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/management/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/management/accounts', label: 'Accounts', icon: Users },
  { href: '/management/leads', label: 'Leads', icon: Inbox, roles: ['owner', 'lead'] },
  { href: '/management/routes', label: 'Routes', icon: Route },
  { href: '/management/billing', label: 'Billing', icon: Receipt },
  { href: '/management/reports', label: 'Reports', icon: BarChart3 },
  { href: '/management/fleet', label: 'Fleet', icon: Truck },
  { href: '/management/team', label: 'Team', icon: UserCircle, roles: ['owner'] },
]

const SIDEBAR_LOGO_CLASSES =
  'flex items-center gap-2 px-4 h-14 border-b border-border shrink-0'

type NavItem = (typeof NAV_ITEMS)[number]

interface NavLinksProps {
  pathname: string
  items: NavItem[]
  onNavigate?: () => void
  /** Live count of status='new' leads (task 9.7) — rendered as a pill on the
   *  Leads item only. 0/undefined renders no badge. */
  newLeadCount?: number
}

function NavLinks({ pathname, items, onNavigate, newLeadCount = 0 }: NavLinksProps) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <ul className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const badge = href === '/management/leads' && newLeadCount > 0 ? newLeadCount : null
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 pointer-coarse:py-3 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{label}</span>
                {badge !== null && (
                  <span
                    className="ml-auto shrink-0 rounded-full bg-primary px-1.5 min-w-5 text-center text-[11px] font-semibold text-primary-foreground tabular-nums"
                    aria-label={`${badge} new lead${badge === 1 ? '' : 's'}`}
                  >
                    {badge > 9 ? '9+' : badge}
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

interface SidebarFooterProps {
  userEmail?: string | null
  onLogout: () => void
}

function SidebarFooter({ userEmail, onLogout }: SidebarFooterProps) {
  return (
    // Bottom safe-area padding: the mobile drawer renders this hard against the
    // home indicator on notched devices with no other footer below it.
    <div className="border-t border-border px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0">
      {userEmail && (
        <p className="text-xs text-muted-foreground truncate px-1 mb-2" title={userEmail}>
          {userEmail}
        </p>
      )}
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground px-2"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sign out
      </Button>
    </div>
  )
}

interface ManagementNavProps {
  userEmail?: string | null
  role?: string | null
  /** Server-fetched starting count of status='new' leads (task 9.7) — avoids
   *  a flash of "0" while the realtime effect's first count query is in
   *  flight. See app/management/layout.tsx. */
  initialNewLeadCount?: number
}

export function ManagementNav({ userEmail, role, initialNewLeadCount = 0 }: ManagementNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newLeadCount, setNewLeadCount] = useState(initialNewLeadCount)
  const lastToastAt = useRef<number>(0)

  // Role-gated items (Leads = owner/lead, Team = owner-only) are hidden from
  // everyone else.
  const navItems = NAV_ITEMS.filter((item) => !item.roles || (!!role && item.roles.includes(role)))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // New-lead notification (task 9.7, in-app half only — see CLAUDE.md on the
  // 8.2 SMS deferral). Owned here rather than a dedicated provider: this is
  // the one management client component mounted on every route, and the
  // badge is its only consumer. Re-queries the live count on every event
  // rather than incrementing a local counter, so it stays correct when
  // another owner/lead triages a lead from their own session — a Server
  // Action's revalidatePath('/management/leads') doesn't reach this sidebar,
  // which lives in the layout, not the page.
  useEffect(() => {
    if (role !== 'owner' && role !== 'lead') return

    const supabase = createClient()

    async function refreshCount() {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      setNewLeadCount(count ?? 0)
    }

    const channel = supabase
      .channel('management_leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          refreshCount()

          if (payload.eventType !== 'INSERT') return

          // Debounce — a burst of INSERTs (unlikely, but matches the
          // useCrewRealtimeSync precedent) shouldn't stack toasts.
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
  }, [role, router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // replace, not push — Back after signing out shouldn't re-enter the
    // authenticated shell just to be bounced by the proxy.
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar — fixed, visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 bg-card border-r border-border z-40">
        <div className={SIDEBAR_LOGO_CLASSES}>
          <Leaf className="h-5 w-5 text-primary shrink-0" />
          <span className="font-display text-[1.1rem] font-semibold text-foreground tracking-tight leading-tight">
            Rooted Gardens
          </span>
        </div>
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
        <NavLinks pathname={pathname} items={navItems} newLeadCount={newLeadCount} />
        <SidebarFooter userEmail={userEmail} onLogout={handleLogout} />
      </aside>

      {/* Mobile top header — visible below lg. Fixed height is the bar plus the
          notch inset, with padding-top absorbing the inset so the bar itself
          stays 3.5rem tall; the main content offset in layout.tsx matches. */}
      <header
        className="lg:hidden fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] bg-card border-b border-border z-40 flex items-center px-4 gap-3"
      >
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0 -ml-1.5"
          onClick={() => setMobileOpen(true)}
          aria-label={
            newLeadCount > 0
              ? `Open navigation menu — ${newLeadCount} new lead${newLeadCount === 1 ? '' : 's'}`
              : 'Open navigation menu'
          }
        >
          <Menu className="h-5 w-5" />
          {/* The drawer is closed by default, so a badge only inside it is
              invisible on a phone — the owners' primary device. This dot is
              the mobile-header-visible half of the same 9.7 count. */}
          {newLeadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Leaf className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-semibold text-foreground">
            Rooted Gardens
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search accounts"
        >
          <Search className="h-5 w-5" />
        </Button>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Mobile nav drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-64 bg-card flex flex-col gap-0 border-r border-border"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className={SIDEBAR_LOGO_CLASSES}>
            <Leaf className="h-5 w-5 text-primary shrink-0" />
            <span className="font-display text-[1.1rem] font-semibold text-foreground tracking-tight leading-tight">
              Rooted Gardens
            </span>
          </div>
          <NavLinks
            pathname={pathname}
            items={navItems}
            onNavigate={() => setMobileOpen(false)}
            newLeadCount={newLeadCount}
          />
          <SidebarFooter userEmail={userEmail} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>
    </>
  )
}
