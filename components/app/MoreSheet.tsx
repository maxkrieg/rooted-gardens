'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut, Search, Smartphone } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ProfileEditSheet } from '@/components/crew/ProfileEditSheet'
import { isNavItemActive, type NavItem } from '@/components/app/nav-items'
import { useRole } from '@/components/app/RoleProvider'
import { cn } from '@/lib/utils'

interface MoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  pathname: string
  counts: Record<string, number>
  /** Omitted for a role that can't open an account — the palette only finds those. */
  onOpenSearch?: () => void
  onSignOut: () => void
}

/**
 * The bottom-bar overflow, and the home of everything the deleted crew Profile
 * page used to own: the SMS opt-out toggle and sign-out. Those need somewhere
 * to live; they don't need a page.
 *
 * A bottom sheet rather than the old left drawer — this opens from a bottom-bar
 * tab, and the top-left hamburger it replaces was the hardest target to reach
 * one-handed on a phone.
 */
export function MoreSheet({
  open,
  onOpenChange,
  items,
  pathname,
  counts,
  onOpenSearch,
  onSignOut,
}: MoreSheetProps) {
  const { employee, role } = useRole()
  const [profileOpen, setProfileOpen] = useState(false)

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : null
  const smsOptIn = employee ? !employee.sms_opt_out : false
  const initials = (employee?.name ?? '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="px-0 pb-0">
          <SheetHeader className="px-4 pb-3">
            <SheetTitle className="sr-only">More</SheetTitle>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
              >
                {initials || '—'}
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate font-display text-base font-semibold text-foreground">
                  {employee?.name ?? 'Signed in'}
                </span>
                {roleLabel && (
                  <span className="block text-xs text-muted-foreground">{roleLabel}</span>
                )}
              </span>
            </div>
          </SheetHeader>

          {onOpenSearch && (
            <div className="px-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onOpenSearch()
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Search className="h-[18px] w-[18px] shrink-0" />
                Search accounts &amp; stops
              </button>
            </div>
          )}

          {items.length > 0 && (
            <nav className="border-t border-border px-2 py-2">
              <ul>
                {items.map((item) => {
                  const active = isNavItemActive(item, pathname)
                  const count = counts[item.href] ?? 0
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span
                            className="shrink-0 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold tabular-nums text-primary-foreground"
                            aria-label={`${count} new`}
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
          )}

          <div className="border-t border-border px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              disabled={!employee}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <Smartphone className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">Text alerts</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  smsOptIn ? 'status-completed' : 'bg-secondary text-muted-foreground',
                )}
              >
                {smsOptIn ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {employee && (
        <ProfileEditSheet
          initialPhone={employee.phone ?? ''}
          initialSmsOptIn={smsOptIn}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
    </>
  )
}
