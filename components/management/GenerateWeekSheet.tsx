'use client'

import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { SectionError } from '@/components/states/ErrorState'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatDays } from '@/components/management/RouteGroupBand'
import type { PlanDecision } from '@/lib/utils/schedule'

interface GenerateWeekSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string
  decisions: PlanDecision[]
  isLoading: boolean
  isError: boolean
  onConfirm: (decisions: PlanDecision[]) => Promise<number>
}

/**
 * The preview between "generate this week" and anything being written.
 *
 * This is the whole safety story for R3.5: the owner confirms a *number* and can
 * untick any row, so a rule that misjudges a property costs one tap rather than
 * sixty stray visits. The skipped list is shown too, with its reason — a
 * property missing from a generated week is the failure he'd notice last.
 */
export function GenerateWeekSheet({
  open,
  onOpenChange,
  weekStart,
  decisions,
  isLoading,
  isError,
  onConfirm,
}: GenerateWeekSheetProps) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)

  const due = useMemo(() => decisions.filter((d) => d.due), [decisions])
  const skipped = useMemo(() => decisions.filter((d) => !d.due), [decisions])
  const selected = due.filter((d) => !excluded.has(d.candidate.property.id))

  const weekLabel = `${format(parseISO(weekStart), 'MMM d')} – ${format(
    addDays(parseISO(weekStart), 6),
    'MMM d',
  )}`

  const byRoute = useMemo(() => {
    const groups = new Map<string, { name: string; days: string[]; rows: PlanDecision[] }>()
    for (const decision of due) {
      const group = decision.candidate.routeGroup
      const key = group?.id ?? 'none'
      if (!groups.has(key)) {
        groups.set(key, {
          name: group?.name ?? 'Not on a route',
          days: group?.default_days ?? [],
          rows: [],
        })
      }
      groups.get(key)!.rows.push(decision)
    }
    return [...groups.values()]
  }, [due])

  function toggle(propertyId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }

  async function confirm() {
    setSaving(true)
    try {
      const n = await onConfirm(selected)
      onOpenChange(false)
      setExcluded(new Set())
      toast.success(`${n} ${n === 1 ? 'stop' : 'stops'} scheduled for ${weekLabel}.`)
    } catch (err) {
      toast.error('Some stops did not save', {
        description: toUserMessage(err, 'They are queued and will retry.', '[GenerateWeekSheet]'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col p-0">
        <SheetHeader className="px-4 pb-2 pt-4">
          <SheetTitle className="font-display text-lg">Generate {weekLabel}</SheetTitle>
          <SheetDescription>
            {isLoading
              ? 'Working out what&rsquo;s due…'
              : `${selected.length} to schedule · ${skipped.length} skipped`}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {isError && (
            <SectionError
              title="Couldn&rsquo;t read visit history."
              hint="Without it every biweekly stop would look due. Try again with a connection."
            />
          )}

          {!isLoading && !isError && due.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing is due this week that isn&rsquo;t already scheduled.
            </p>
          )}

          {byRoute.map((group) => (
            <section key={group.name} className="mb-4">
              <h3 className="sticky top-0 z-10 bg-card py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.name}
                {group.days.length > 0 && (
                  <span className="font-medium normal-case tracking-normal">
                    {' · '}
                    {formatDays(group.days)}
                  </span>
                )}
              </h3>
              <ul>
                {group.rows.map((decision) => {
                  const { property, account } = decision.candidate
                  const on = !excluded.has(property.id)
                  return (
                    <li key={property.id}>
                      <button
                        type="button"
                        onClick={() => toggle(property.id)}
                        aria-pressed={on}
                        className={cn(
                          'flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary',
                          !on && 'opacity-45',
                        )}
                      >
                        <CheckIndicator checked={on} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[15px] font-semibold text-foreground">
                            {account.name}
                          </span>
                          <span className="block truncate text-[13px] text-muted-foreground">
                            {property.address}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {decision.reason}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {skipped.length > 0 && (
            <div className="pb-4">
              <button
                type="button"
                onClick={() => setShowSkipped((v) => !v)}
                className="min-h-10 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showSkipped ? 'Hide' : 'Show'} {skipped.length} skipped
              </button>
              {showSkipped && (
                <ul className="mt-1 space-y-1">
                  {skipped.map((decision) => (
                    <li
                      key={decision.candidate.property.id}
                      className="flex items-center gap-2 px-2 py-1 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {decision.candidate.account.name} — {decision.candidate.property.address}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">
                        {decision.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button
            className="h-12 w-full"
            disabled={saving || isLoading || selected.length === 0}
            onClick={confirm}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule {selected.length} {selected.length === 1 ? 'stop' : 'stops'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
