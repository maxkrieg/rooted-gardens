'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { SERVICE_TYPES } from '@/types/app'

const LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

interface ServiceTypeSelectorProps {
  value: string[]
  onChange: (types: string[]) => void
}

export function ServiceTypeSelector({ value, onChange }: ServiceTypeSelectorProps) {
  function toggle(type: string) {
    onChange(
      value.includes(type) ? value.filter((t) => t !== type) : [...value, type]
    )
  }

  return (
    <div className="rounded-2xl border border-[--border] bg-card divide-y divide-[--border] overflow-hidden">
      {SERVICE_TYPES.map((type) => {
        const checked = value.includes(type)
        return (
          <label
            key={type}
            className={[
              'flex items-center gap-3 px-4 min-h-[48px] cursor-pointer select-none transition-colors',
              checked ? 'bg-accent' : 'hover:bg-accent/50',
            ].join(' ')}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(type)}
              aria-label={LABELS[type]}
            />
            <span className="text-sm font-medium text-foreground">{LABELS[type]}</span>
          </label>
        )
      })}
    </div>
  )
}
