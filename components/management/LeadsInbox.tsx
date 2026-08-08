'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
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
import { LeadCard } from '@/components/management/LeadCard'
import { LeadDetailSheet } from '@/components/management/LeadDetailSheet'
import { LeadKindBadge, LeadStatusBadge } from '@/components/management/badges'
import { EmptyState } from '@/components/states/EmptyState'
import { syncLeadUrlParam } from '@/lib/utils/lead-url'
import { leadInterestOrPosition } from '@/lib/utils/leads'
import {
  LEAD_KINDS,
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/types/app'
import type { LeadKind, LeadStatus, LeadWithConverted } from '@/types/app'

interface LeadsInboxProps {
  leads: LeadWithConverted[]
  /** From the `?lead=` deep link (e.g. the 9.7 toast's "View" action) — opens
   *  that lead's sheet on load. */
  initialLeadId?: string
}

/**
 * Leads inbox (task 9.8) — structural port of AccountsTable.tsx: client-side
 * search/filter state (this inbox is short at the company's volume, unlike
 * the schedule's URL-state filters which exist to make a filtered *week*
 * shareable), a table on desktop and cards on phone, and a detail Sheet
 * rather than a route (there's no /management/leads/[id] page).
 */
export function LeadsInbox({ leads, initialLeadId }: LeadsInboxProps) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<LeadKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')

  // Selection persists after the sheet closes (only `sheetOpen` flips) so the
  // Sheet's own exit animation has content to animate away — same reasoning
  // as DeepLinkedVisitSheet's mount-only resolution, but here the id is a
  // plain useState seeded from the prop rather than a separate component,
  // since rows can be reopened repeatedly within one page load.
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId ?? null)
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialLeadId))

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  )

  function openLead(id: string) {
    setSelectedLeadId(id)
    setSheetOpen(true)
    syncLeadUrlParam(id)
  }

  function handleSheetOpenChange(next: boolean) {
    setSheetOpen(next)
    if (!next) syncLeadUrlParam(null)
  }

  const filtered = leads.filter((lead) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      q === '' ||
      lead.name.toLowerCase().includes(q) ||
      (lead.email ?? '').toLowerCase().includes(q) ||
      (lead.phone ?? '').toLowerCase().includes(q)
    const matchesKind = kindFilter === 'all' || lead.kind === kindFilter
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    return matchesSearch && matchesKind && matchesStatus
  })

  function clearFilters() {
    setSearch('')
    setKindFilter('all')
    setStatusFilter('all')
  }

  // Two different problems, same as AccountsTable: a genuinely empty inbox
  // needs no action (leads only ever arrive from the public site), one
  // hidden by filters needs them cleared.
  const emptyState =
    leads.length === 0 ? (
      <EmptyState
        variant="seed"
        title="No leads yet"
        hint="Inquiries and job applications from the public site land here."
      />
    ) : (
      <EmptyState
        variant="pruned"
        title="No leads match your filters"
        hint="Widen the search, or clear the filters to see all of them."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    )

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Leads</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as LeadKind | 'all')}>
          <SelectTrigger className="h-10 w-full sm:w-44">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {LEAD_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {LEAD_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
          <SelectTrigger className="h-10 w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
      </p>

      {/* Desktop table (md+) */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-card shadow-warm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="font-semibold text-foreground pl-5 tabular-nums">
                Received
              </TableHead>
              <TableHead className="font-semibold text-foreground">Name</TableHead>
              <TableHead className="font-semibold text-foreground">Kind</TableHead>
              <TableHead className="font-semibold text-foreground">Interest</TableHead>
              <TableHead className="font-semibold text-foreground pr-5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => openLead(lead.id)}
                >
                  <TableCell className="pl-5 tabular-nums text-sm text-muted-foreground">
                    {format(parseISO(lead.created_at), 'EEE MMM d')}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{lead.name}</p>
                  </TableCell>
                  <TableCell>
                    <LeadKindBadge kind={lead.kind} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {leadInterestOrPosition(lead) ?? '—'}
                  </TableCell>
                  <TableCell className="pr-5">
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0
          ? emptyState
          : filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={() => openLead(lead.id)} />
            ))}
      </div>

      <LeadDetailSheet
        lead={selectedLead}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </>
  )
}
