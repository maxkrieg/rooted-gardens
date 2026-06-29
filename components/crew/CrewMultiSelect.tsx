'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface CrewOption {
  id: string
  name: string
  role: string
}

interface CrewMultiSelectProps {
  options: CrewOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

// Inline (non-portaled) dropdown. A Radix Popover portals its content to
// document.body — outside the completion Sheet's modal Dialog — so the Dialog's
// modal layer swallows taps and the list is non-interactive. Rendering the panel
// inline within the Sheet's DOM keeps every row tappable.
export function CrewMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select crew…',
}: CrewMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on tap/click outside
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  const selected = options.filter((o) => value.includes(o.id))
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full min-h-11 h-auto justify-between px-3 py-2 text-base font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {selected.map((o) => (
              <Badge key={o.id} variant="secondary" className="font-medium">
                {o.name}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[--border] bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b border-[--border] px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crew…"
              className="flex h-11 w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-[260px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No crew found.</li>
            ) : (
              filtered.map((o) => {
                const checked = value.includes(o.id)
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      className="w-full flex items-center gap-3 rounded-sm px-2 min-h-[44px] text-left active:bg-accent hover:bg-accent/50 transition-colors"
                    >
                      <span
                        className={[
                          'flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                          checked
                            ? 'bg-[--primary] border-[--primary] text-[--primary-foreground]'
                            : 'border-[--border]',
                        ].join(' ')}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="text-base text-foreground">{o.name}</span>
                      <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
                        {o.role}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
