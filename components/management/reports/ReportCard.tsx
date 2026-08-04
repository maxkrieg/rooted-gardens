'use client'

import { useState } from 'react'
import { ChevronDown, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StateMark } from '@/components/states/StateMark'

// Re-exported so the chart components can keep importing these from here.
export { usePrefersReducedMotion, useIsNarrow } from '@/hooks/use-media-query'

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

/**
 * Keeps free-text `children` rather than EmptyState's title/hint split — each
 * chart's copy is one sentence naming the year, which a heading would only
 * worsen. Borrows the shared mark. Load failures are handled on the page.
 */
export function ReportEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background/50 px-6 py-8">
      <StateMark variant="seed" />
      <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  )
}
