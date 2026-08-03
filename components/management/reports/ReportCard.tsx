'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { ChevronDown, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Subscribe to a CSS media query. `useSyncExternalStore` rather than
 * useEffect+setState: the media query *is* an external store, and reading it
 * this way keeps the first client render consistent instead of flashing a
 * default and then correcting it. The server snapshot is always `false`, so
 * SSR renders the wide / full-motion variant.
 */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * True when the OS asks for reduced motion. Recharts animates bars in by
 * default; every chart gates `isAnimationActive` on this.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** True below Tailwind's `sm` breakpoint — drives compact axis labels. */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

interface ReportCardProps {
  title: string
  /** The window the chart covers — always stated, never implied. */
  subtitle: string
  /** Caveats about what the data can and can't show. */
  footnote?: string
  /** The table-view twin. Every value in the chart is reachable here without hovering. */
  table: React.ReactNode
  children: React.ReactNode
}

export function ReportCard({
  title,
  subtitle,
  footnote,
  table,
  children,
}: ReportCardProps) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className="rounded-2xl border border-border bg-card shadow-warm p-4 lg:p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </header>

      {children}

      {footnote && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{footnote}</p>
      )}

      <button
        type="button"
        onClick={() => setShowTable((open) => !open)}
        aria-expanded={showTable}
        className="mt-3 inline-flex items-center gap-1.5 h-11 px-2 -ml-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg"
      >
        <Table2 className="h-4 w-4 shrink-0" />
        {showTable ? 'Hide table' : 'View as table'}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', showTable && 'rotate-180')}
        />
      </button>

      {showTable && <div className="mt-2 overflow-x-auto">{table}</div>}
    </section>
  )
}

/** Empty state — says what's missing and what to do about it. */
export function ReportEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[12rem] rounded-xl border border-dashed border-border bg-background/50 px-6">
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
        {children}
      </p>
    </div>
  )
}
