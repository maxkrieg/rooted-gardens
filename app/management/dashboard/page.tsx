import { format } from 'date-fns'
import { FilePen, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getWeekStart } from '@/lib/utils/schedule'
import { cn } from '@/lib/utils'
import { CrewsOnSitePanel } from '@/components/management/CrewsOnSitePanel'
import { EmptyState } from '@/components/states/EmptyState'
import { SectionError } from '@/components/states/ErrorState'
import type { Equipment, Vehicle, VisitWithDetails } from '@/types/app'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  const weekStart = format(getWeekStart(today), 'yyyy-MM-dd')

  const [visitsResult, equipmentResult, vehiclesResult, inProgressResult] = await Promise.all([
    supabase
      .from('visits')
      // !inner + is_archived: this is the current week's work, not history, so a
      // deleted property must drop off here exactly as it drops off the schedule
      // grid. (visits.property_id is NOT NULL, so !inner never loses a visit.)
      // Account/property history elsewhere — billing, the account detail page —
      // stays unfiltered so past visits keep rendering their names.
      .select(`
        *,
        property:properties!inner(*),
        account:accounts(*),
        visit_crew(*, employee:employees(*))
      `)
      .eq('week_start', weekStart)
      .eq('property.is_archived', false),
    supabase.from('equipment').select('*').eq('status', 'maintenance').order('name'),
    supabase.from('vehicles').select('*').eq('status', 'maintenance').order('name'),
    supabase
      .from('visits')
      .select(
        'id, started_at, property:properties!inner(address), visit_crew(relation, employee:employees(name))',
      )
      .not('started_at', 'is', null)
      .is('ended_at', null)
      .eq('property.is_archived', false),
  ])

  // Fail per section, not per page — one dead query shouldn't blank the rest.
  // A failure must not fall through to `[]`: that renders "Nothing scheduled
  // this week" during an outage, which is simply untrue.
  const visitsFailed = !!visitsResult.error
  const fleetFailed = !!equipmentResult.error || !!vehiclesResult.error
  if (visitsResult.error) console.error('[dashboard] visits', visitsResult.error)
  if (equipmentResult.error) console.error('[dashboard] equipment', equipmentResult.error)
  if (vehiclesResult.error) console.error('[dashboard] vehicles', vehiclesResult.error)
  if (inProgressResult.error) console.error('[dashboard] in-progress', inProgressResult.error)

  const visits = (visitsResult.data ?? []) as unknown as VisitWithDetails[]
  const maintenanceEquipment = (equipmentResult.data ?? []) as Equipment[]
  const maintenanceVehicles = (vehiclesResult.data ?? []) as Vehicle[]
  const inProgressVisits = (inProgressResult.data ?? []) as unknown as Parameters<typeof CrewsOnSitePanel>[0]['initialVisits']

  const scheduledVisits = visits.filter((v) => v.status === 'scheduled')
  const completedCount = visits.filter((v) => v.status === 'completed').length
  const skippedCount = visits.filter((v) => v.status === 'skipped').length
  const uninvoicedCount = visits.filter(
    (v) => v.status === 'completed' && !v.invoice_id,
  ).length

  // Crew-instruction visits floated to the top
  const sortedScheduled = [...scheduledVisits].sort(
    (a, b) => (b.crew_instruction ? 1 : 0) - (a.crew_instruction ? 1 : 0),
  )

  const outstandingInstructions = scheduledVisits.filter((v) => v.crew_instruction)
  const hasFleetIssues = maintenanceEquipment.length > 0 || maintenanceVehicles.length > 0

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Week of {format(getWeekStart(today), 'MMM d, yyyy')}
        </p>
      </div>

      {/* ── This Week stat row ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          This Week
        </h2>
        {visitsFailed ? (
          <SectionError
            title="This week's numbers didn't load."
            hint="They'll be back once the connection recovers."
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Scheduled" value={scheduledVisits.length} colorClass="status-scheduled" />
            <StatCard label="Completed" value={completedCount} colorClass="status-completed" />
            <StatCard label="Skipped" value={skippedCount} colorClass="status-skipped" />
            <StatCard label="Uninvoiced" value={uninvoicedCount} colorClass="status-invoiced" />
          </div>
        )}
      </section>

      {/* ── Crews on site now (live) ──────────────────────────────────────── */}
      <CrewsOnSitePanel initialVisits={inProgressVisits} />

      {/* ── Scheduled visits ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Scheduled This Week
        </h2>
        {visitsFailed ? (
          <SectionError
            title="The schedule didn't load."
            hint="Refresh to try again — nothing has changed."
          />
        ) : sortedScheduled.length === 0 ? (
          <EmptyState
            compact
            variant="sprig"
            title="Nothing scheduled this week"
            hint="Add stops from the Schedule to fill the week."
          />
        ) : (
          <div className="space-y-2">
            {sortedScheduled.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
        )}
      </section>

      {/* ── Outstanding crew instructions ──────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Outstanding Crew Instructions
        </h2>
        {visitsFailed ? (
          <SectionError title="Crew instructions didn't load." hint="Refresh to try again." />
        ) : outstandingInstructions.length === 0 ? (
          <EmptyState
            compact
            variant="sprig"
            title="No outstanding instructions"
            hint="One-off notes you add to a visit show up here until it's done."
          />
        ) : (
          <div className="space-y-2">
            {outstandingInstructions.map((visit) => (
              <InstructionCard key={visit.id} visit={visit} />
            ))}
          </div>
        )}
      </section>

      {/* ── Fleet & equipment — only when something needs attention ──────────
          A failure still renders: hiding it would imply nothing needs service. */}
      {(hasFleetIssues || fleetFailed) && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Fleet &amp; Equipment
          </h2>
          {fleetFailed ? (
            <SectionError
              title="Maintenance status didn't load."
              hint="Check the Fleet page directly."
            />
          ) : (
            <div className="space-y-2">
              {maintenanceVehicles.map((v) => (
                <FleetCard key={v.id} name={v.name} kind="Vehicle" />
              ))}
              {maintenanceEquipment.map((e) => (
                <FleetCard key={e.id} name={e.name} kind={e.type} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string
  value: number
  colorClass: string
}) {
  return (
    <div className={cn('rounded-2xl px-4 py-4 shadow-warm', colorClass)}>
      <p className="font-display text-3xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-xs font-medium mt-1.5 opacity-75 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function VisitCard({ visit }: { visit: VisitWithDetails }) {
  const assignedCrew = visit.visit_crew
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => vc.employee.name.split(' ')[0])

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-warm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground leading-tight truncate">
            {visit.property.address}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {visit.account.name}
          </p>
        </div>
        {assignedCrew.length > 0 && (
          <p className="text-xs text-muted-foreground shrink-0">{assignedCrew.join(', ')}</p>
        )}
      </div>
      {visit.crew_instruction && (
        <div className="flex items-start gap-1.5 bg-[var(--clay)]/[0.08] border border-[var(--clay)]/30 rounded-lg px-2.5 py-2">
          <FilePen className="w-3.5 h-3.5 text-[var(--clay)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--clay)]">{visit.crew_instruction}</p>
        </div>
      )}
    </div>
  )
}

function InstructionCard({ visit }: { visit: VisitWithDetails }) {
  return (
    <div className="rounded-xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.05] px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <FilePen className="w-3.5 h-3.5 text-[var(--clay)] shrink-0" />
        <p className="text-xs font-semibold text-[var(--clay)] truncate">
          {visit.property.address}
        </p>
      </div>
      <p className="text-sm text-foreground">{visit.crew_instruction}</p>
    </div>
  )
}

function FleetCard({ name, kind }: { name: string; kind: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-warm flex items-center gap-3">
      <Wrench className="w-4 h-4 text-[#9a6b16] shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground capitalize">{kind}</p>
      </div>
      <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide status-skipped rounded-full px-2.5 py-0.5">
        Maintenance
      </span>
    </div>
  )
}
