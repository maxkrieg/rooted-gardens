'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/states/EmptyState'
import {
  AUDIT_ACTIONS,
  AUDIT_GROUPS,
  auditActionLabel,
  summarizeChanges,
} from '@/lib/audit/actions'
import type { Database } from '@/types/database'

type AuditEntry = Database['public']['Tables']['audit_log']['Row']

interface AuditLogViewProps {
  entries: AuditEntry[]
  employees: { id: string; name: string }[]
  total: number
  page: number
  pageSize: number
  action: string | null
  actor: string | null
}

// Pinned to the company's zone so server render and hydration agree, and a
// laptop set to another zone still reads the times as the crew lived them.
const WHEN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const ACTIONS_BY_GROUP = AUDIT_GROUPS.map((group) => ({
  group,
  actions: Object.entries(AUDIT_ACTIONS).filter(([, meta]) => meta.group === group),
}))

/** The owner/lead activity log: URL-driven filters, table on desktop, cards on phone. */
export function AuditLogView({
  entries,
  employees,
  total,
  page,
  pageSize,
  action,
  actor,
}: AuditLogViewProps) {
  const router = useRouter()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function hrefFor(next: { page?: number; action?: string | null; actor?: string | null }) {
    const params = new URLSearchParams()
    const a = next.action === undefined ? action : next.action
    const u = next.actor === undefined ? actor : next.actor
    if (a) params.set('action', a)
    if (u) params.set('actor', u)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    const qs = params.toString()
    return qs ? `/management/audit?${qs}` : '/management/audit'
  }

  const filtered = action !== null || actor !== null

  const emptyState = filtered ? (
    <EmptyState
      variant="pruned"
      title="Nothing matches these filters"
      hint="Pick another action or person, or clear the filters."
      action={
        <Button variant="outline" asChild>
          <Link href="/management/audit">Clear filters</Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      variant="seed"
      title="No activity yet"
      hint="Every change made in the app is recorded here, newest first."
    />
  )

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change made in the app, who made it, and when.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select
          value={action ?? 'all'}
          onValueChange={(v) => router.push(hrefFor({ action: v === 'all' ? null : v }))}
        >
          <SelectTrigger className="h-10 w-full sm:w-64">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS_BY_GROUP.map(({ group, actions }) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {actions.map(([code, meta]) => (
                  <SelectItem key={code} value={code}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actor ?? 'all'}
          onValueChange={(v) => router.push(hrefFor({ actor: v === 'all' ? null : v }))}
        >
          <SelectTrigger className="h-10 w-full sm:w-52">
            <SelectValue placeholder="Person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
            <SelectItem value="system">System (automatic)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground mb-4 tabular-nums">
        {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
      </p>

      {/* Desktop table (md+) */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-card shadow-warm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="font-semibold text-foreground pl-5">When</TableHead>
              <TableHead className="font-semibold text-foreground">Who</TableHead>
              <TableHead className="font-semibold text-foreground">Action</TableHead>
              <TableHead className="font-semibold text-foreground">Record</TableHead>
              <TableHead className="font-semibold text-foreground pr-5">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="pl-5 tabular-nums text-sm text-muted-foreground whitespace-nowrap">
                    {WHEN.format(new Date(entry.occurred_at))}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                    {entry.actor_label}
                    <ViaTag by={entry.impersonated_by} />
                  </TableCell>
                  <TableCell className="text-sm text-foreground whitespace-nowrap">
                    {auditActionLabel(entry.action)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-normal max-w-xs">
                    {entry.entity_label ?? '—'}
                  </TableCell>
                  <TableCell className="pr-5 text-sm text-muted-foreground whitespace-normal max-w-sm">
                    {summarizeChanges(entry.changes) ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {entries.length === 0
          ? emptyState
          : entries.map((entry) => <AuditCard key={entry.id} entry={entry} />)}
      </div>

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
          <PagerLink href={page > 1 ? hrefFor({ page: page - 1 }) : null} direction="prev" />
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pageCount}
          </p>
          <PagerLink href={page < pageCount ? hrefFor({ page: page + 1 }) : null} direction="next" />
        </nav>
      )}
    </>
  )
}

function PagerLink({ href, direction }: { href: string | null; direction: 'prev' | 'next' }) {
  const content =
    direction === 'prev' ? (
      <>
        <ChevronLeft className="h-4 w-4" /> Newer
      </>
    ) : (
      <>
        Older <ChevronRight className="h-4 w-4" />
      </>
    )

  if (!href) {
    return (
      <Button variant="outline" className="h-11" disabled>
        {content}
      </Button>
    )
  }
  return (
    <Button variant="outline" className="h-11" asChild>
      <Link href={href}>{content}</Link>
    </Button>
  )
}

function AuditCard({ entry }: { entry: AuditEntry }) {
  const changes = summarizeChanges(entry.changes)

  return (
    <Card className="rounded-2xl border border-border shadow-warm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-foreground">{auditActionLabel(entry.action)}</p>
          <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {WHEN.format(new Date(entry.occurred_at))}
          </p>
        </div>
        {entry.entity_label && (
          <p className="mt-1 text-sm text-muted-foreground">{entry.entity_label}</p>
        )}
        {changes && <p className="mt-1 text-sm text-muted-foreground">{changes}</p>}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {entry.actor_label}
          <ViaTag by={entry.impersonated_by} />
        </p>
      </CardContent>
    </Card>
  )
}

/** A super admin signed in as the actor made this change (app/admin/impersonate). */
function ViaTag({ by }: { by: string | null }) {
  if (!by) return null
  return (
    <span
      title={`Made by ${by} while signed in as this person`}
      className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 align-middle text-[0.65rem] font-semibold normal-case tracking-normal text-secondary-foreground"
    >
      via {by}
    </span>
  )
}
