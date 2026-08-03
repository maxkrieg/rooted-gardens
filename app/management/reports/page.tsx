import { resolveReportYear } from '@/lib/utils/reports'
import { ReportsYearNav } from '@/components/management/ReportsYearNav'
import { RevenueByMonthChart } from '@/components/management/reports/RevenueByMonthChart'
import { VisitsPerCrewSmallMultiples } from '@/components/management/reports/VisitsPerCrewSmallMultiples'
import { FrequencyAdherenceChart } from '@/components/management/reports/FrequencyAdherenceChart'
import { SectionError } from '@/components/states/ErrorState'
import {
  getRevenueByMonth,
  getVisitsPerCrewByWeek,
  getFrequencyAdherence,
} from './actions'

interface Props {
  searchParams: Promise<{ year?: string }>
}

/**
 * Revenue and operations reporting (task 8.4). Server-rendered: all three
 * datasets are aggregated on the server and handed to the charts as plain data,
 * so the client components never touch Supabase (CLAUDE.md Data Architecture —
 * `/management/*` is server-first).
 *
 * Visible to every management role; RLS already grants owner/lead/accountant
 * read on invoices, visits, visit_crew, accounts, and properties.
 */
export default async function ReportsPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams
  const year = resolveReportYear(yearParam)

  const [revenue, crewVisits, adherence] = await Promise.all([
    getRevenueByMonth(year),
    getVisitsPerCrewByWeek(year),
    getFrequencyAdherence(year),
  ])

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue, crew workload, and service cadence
          </p>
        </div>
        <ReportsYearNav year={year} />
      </div>

      {/* Each report fails independently — a chart of zeroes reads as "nobody
          billed anything this year", which is worse than saying it didn't load. */}
      {revenue.loadError ? (
        <SectionError
          title="Revenue didn't load."
          hint="Refresh to try again. Invoices in QuickBooks are unaffected."
        />
      ) : (
        <RevenueByMonthChart data={revenue.months} year={year} />
      )}

      {crewVisits.loadError ? (
        <SectionError title="Crew workload didn't load." hint="Refresh to try again." />
      ) : (
        <VisitsPerCrewSmallMultiples report={crewVisits} />
      )}

      {adherence.loadError ? (
        <SectionError title="Service cadence didn't load." hint="Refresh to try again." />
      ) : (
        <FrequencyAdherenceChart report={adherence} year={year} />
      )}
    </div>
  )
}
