'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

/** Clickable header cell driving a `{ key, dir }` sort. */
export function SortableTableHead<K extends string>({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: K
  currentKey: K
  dir: SortDir
  onSort: (key: K) => void
  align?: 'left' | 'right'
}) {
  const active = currentKey === sortKey
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </button>
    </TableHead>
  )
}
