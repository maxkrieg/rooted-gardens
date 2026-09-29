'use client'

import Link from 'next/link'
import { ChevronRight, Sprout } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'

/** The checklist rows; ticked by real work (see TASKS), or by hand with the check. */
export function ChecklistItems({ onNavigate }: { onNavigate?: () => void }) {
  const { tasks, isTaskDone, markTask } = useOnboarding()
  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => {
        const done = isTaskDone(task)
        return (
          <li key={task.key} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => !done && markTask(task)}
              disabled={done}
              aria-label={done ? `${task.title} — done` : `Mark “${task.title}” done`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-secondary disabled:hover:bg-transparent"
            >
              <CheckIndicator checked={done} />
            </button>
            <Link
              href={task.href}
              onClick={onNavigate}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-2 hover:bg-secondary/60"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={
                    done
                      ? 'block text-sm font-medium text-muted-foreground line-through decoration-border'
                      : 'block text-sm font-medium text-foreground'
                  }
                >
                  {task.title}
                </span>
                {!done && <span className="block text-[12px] text-muted-foreground">{task.hint}</span>}
              </span>
              {!done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** On the schedule's Today view until every task is done or it's hidden. */
export function GettingStartedCard() {
  const { ready, tasks, isTaskDone, checklistDismissed, dismissChecklist } = useOnboarding()
  if (!ready || tasks.length === 0 || checklistDismissed) return null

  const doneCount = tasks.filter(isTaskDone).length
  if (doneCount === tasks.length) return null

  return (
    <Card className="rounded-2xl border border-border shadow-warm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-2 flex items-start gap-3">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-foreground">Getting started</h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {doneCount} of {tasks.length} done. Each one ticks off when you do it for real.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissChecklist}
            className="-mr-2 -mt-1 min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        </div>
        <div
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={tasks.length}
          aria-valuenow={doneCount}
          aria-label="Getting started progress"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
        </div>
        <ChecklistItems />
      </CardContent>
    </Card>
  )
}
