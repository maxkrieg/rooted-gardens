'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Receipt,
  Route,
  Truck,
  UserCircle,
  Menu,
  LogOut,
  Leaf,
  Search,
} from 'lucide-react'
import { CommandPalette } from '@/components/management/CommandPalette'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/management/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/management/accounts', label: 'Accounts', icon: Users },
  { href: '/management/route-groups', label: 'Routes', icon: Route },
  { href: '/management/billing', label: 'Billing', icon: Receipt },
  { href: '/management/fleet', label: 'Fleet', icon: Truck },
  { href: '/management/team', label: 'Team', icon: UserCircle, ownerOnly: true },
]

const SIDEBAR_LOGO_CLASSES =
  'flex items-center gap-2 px-4 h-14 border-b border-border shrink-0'

type NavItem = (typeof NAV_ITEMS)[number]

interface NavLinksProps {
  pathname: string
  items: NavItem[]
  onNavigate?: () => void
}

function NavLinks({ pathname, items, onNavigate }: NavLinksProps) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <ul className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
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
    <div className="border-t border-border px-3 py-3 shrink-0">
      {userEmail && (
        <p className="text-xs text-muted-foreground truncate px-1 mb-2" title={userEmail}>
          {userEmail}
        </p>
      )}
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-sm h-9 text-muted-foreground hover:text-foreground px-2"
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
}

export function ManagementNav({ userEmail, role }: ManagementNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Owner-only items (e.g. Team, task 7.1) are hidden from other roles.
  const navItems = NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'owner')

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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
        <NavLinks pathname={pathname} items={navItems} />
        <SidebarFooter userEmail={userEmail} onLogout={handleLogout} />
      </aside>

      {/* Mobile top header — visible below lg */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-card border-b border-border z-40 flex items-center px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 -ml-1.5"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
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
          className="h-9 w-9 shrink-0"
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
          <NavLinks pathname={pathname} items={navItems} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter userEmail={userEmail} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>
    </>
  )
}
