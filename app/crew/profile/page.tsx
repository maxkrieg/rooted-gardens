'use client'

import { format, parseISO, differenceInMinutes } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { useTodayTimeEntry } from '@/hooks/crew/useTodayTimeEntry'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { formatElapsed } from '@/lib/utils/visits'
import type { TimeEntry } from '@/types/app'

function formatTime(iso: string) {
  return format(parseISO(iso), 'h:mm a')
}

function computeDuration(entry: TimeEntry): string {
  const end = entry.clock_out ? parseISO(entry.clock_out) : new Date()
  const mins = differenceInMinutes(end, parseISO(entry.clock_in!))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { data: employee } = useCurrentEmployee()
  const { data: entries = [], isLoading } = useTodayTimeEntry(employee?.id)

  // Most recent entry first (DESC order from hook)
  const activeEntry = entries[0] ?? null
  const isClockedIn = !!activeEntry && activeEntry.clock_out === null

  async function handleClockIn() {
    if (isClockedIn || !employee?.id) return
    const clockIn = new Date().toISOString()
    const date = format(new Date(), 'yyyy-MM-dd')

    const optimisticEntry: TimeEntry = {
      id: crypto.randomUUID(),
      employee_id: employee.id,
      visit_id: null,
      date,
      clock_in: clockIn,
      clock_out: null,
      break_minutes: 0,
      approved: false,
      approved_by: null,
      notes: null,
      created_at: clockIn,
      updated_at: clockIn,
    } as TimeEntry

    queryClient.setQueryData<TimeEntry[]>(
      ['today-time-entry', employee.id],
      (old = []) => [optimisticEntry, ...old]
    )

    await enqueueMutation('clock_in', { employeeId: employee.id, date, clockIn })
    await flushMutationQueue()
    queryClient.invalidateQueries({ queryKey: ['today-time-entry', employee.id] })
  }

  async function handleClockOut() {
    if (!isClockedIn || !activeEntry || !employee?.id) return
    const clockOut = new Date().toISOString()

    queryClient.setQueryData<TimeEntry[]>(
      ['today-time-entry', employee.id],
      (old = []) =>
        old.map((e) =>
          e.id === activeEntry.id
            ? ({ ...e, clock_out: clockOut, updated_at: clockOut } as TimeEntry)
            : e
        )
    )

    await enqueueMutation('clock_out', { timeEntryId: activeEntry.id, clockOut })
    await flushMutationQueue()
    queryClient.invalidateQueries({ queryKey: ['today-time-entry', employee.id] })
  }

  const roleLabel = employee?.role
    ? employee.role.charAt(0).toUpperCase() + employee.role.slice(1)
    : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {employee?.name ?? '…'}
        </h1>
        {roleLabel && (
          <span className="inline-block text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {roleLabel}
          </span>
        )}
      </div>

      {/* Clock state */}
      <div className="rounded-2xl border border-[--border] bg-card p-5 shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)] space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isClockedIn ? (
            <>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: 'var(--clay)' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2.5 w-2.5"
                  style={{ backgroundColor: 'var(--clay)' }}
                />
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--clay)' }}>
                Clocked In &middot; {activeEntry?.clock_in ? formatElapsed(activeEntry.clock_in) : ''}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {isLoading ? 'Loading…' : 'Not clocked in'}
            </span>
          )}
        </div>

        {/* Toggle button */}
        {isClockedIn ? (
          <Button
            variant="outline"
            className="w-full h-14 text-base font-semibold border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleClockOut}
          >
            Clock Out
          </Button>
        ) : (
          <Button
            className="w-full h-14 text-base font-semibold"
            onClick={handleClockIn}
            disabled={isLoading}
          >
            Clock In
          </Button>
        )}

        {/* Today's sessions list */}
        {entries.length > 0 && (
          <div className="border-t border-[--border] pt-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Today&apos;s Sessions
            </p>
            <div className="space-y-2">
              {entries.map((e, i) => {
                const isActive = i === 0 && isClockedIn
                return (
                  <div
                    key={e.id}
                    className={[
                      'grid grid-cols-3 gap-2 text-center py-2 rounded-xl',
                      isActive ? '' : 'bg-secondary/50',
                    ].join(' ')}
                    style={isActive ? { backgroundColor: 'color-mix(in srgb, var(--clay) 12%, transparent)' } : undefined}
                  >
                    <div>
                      <p
                        className="font-display text-base font-semibold tabular-nums"
                        style={isActive ? { color: 'var(--clay)' } : { color: 'var(--foreground)' }}
                      >
                        {e.clock_in ? formatTime(e.clock_in) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">In</p>
                    </div>
                    <div>
                      <p
                        className="font-display text-base font-semibold tabular-nums"
                        style={isActive ? { color: 'var(--clay)' } : { color: 'var(--foreground)' }}
                      >
                        {e.clock_out ? formatTime(e.clock_out) : '—'}
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={isActive ? { color: 'var(--clay)' } : { color: 'var(--muted-foreground)' }}
                      >
                        {isActive ? 'Running' : 'Out'}
                      </p>
                    </div>
                    <div>
                      <p
                        className="font-display text-base font-semibold tabular-nums"
                        style={isActive ? { color: 'var(--clay)' } : { color: 'var(--foreground)' }}
                      >
                        {e.clock_in ? computeDuration(e) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Total</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
