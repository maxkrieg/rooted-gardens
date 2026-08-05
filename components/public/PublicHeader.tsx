'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Leaf, Menu } from 'lucide-react'
import { PUBLIC_NAV } from '@/lib/content/routes'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Sticky top nav for the public marketing site (`app/(public)/*`). Mirrors the
 * active-link and mobile-drawer idiom of `components/management/ManagementNav.tsx`,
 * but there's no role gating — every link here is reachable signed-out.
 */
export function PublicHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
          <Leaf className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-semibold text-foreground tracking-tight">
            Rooted Gardens
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {PUBLIC_NAV.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto hidden md:flex items-center gap-3">
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
            Staff log in
          </Link>
          <Button asChild size="sm">
            <Link href="/contact">Get started</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 bg-card flex flex-col gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-display text-base font-semibold text-foreground">Rooted Gardens</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <ul className="space-y-0.5">
              {PUBLIC_NAV.map(({ href, label }) => {
                const active = pathname === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center h-11 px-3 rounded-lg text-sm font-medium transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0 space-y-3">
            <Button asChild className="w-full">
              <Link href="/contact" onClick={() => setOpen(false)}>
                Get started
              </Link>
            </Button>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Staff log in
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
