'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Receipt,
  Truck,
  UserCircle,
  Menu,
  LogOut,
  Leaf,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/accounts', label: 'Accounts', icon: Users },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/fleet', label: 'Fleet', icon: Truck },
  { href: '/team', label: 'Team', icon: UserCircle },
]

const SIDEBAR_LOGO_CLASSES =
  'flex items-center gap-2 px-4 h-14 border-b border-border shrink-0'

interface NavLinksProps {
  pathname: string
  onNavigate?: () => void
}

function NavLinks({ pathname, onNavigate }: NavLinksProps) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
}

export function ManagementNav({ userEmail }: ManagementNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

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
        <NavLinks pathname={pathname} />
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
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-semibold text-foreground">
            Rooted Gardens
          </span>
        </div>
      </header>

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
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter userEmail={userEmail} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>
    </>
  )
}
