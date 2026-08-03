'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ReportCard, ReportEmpty, usePrefersReducedMotion } from './ReportCard'
import type { CrewVisitsReport, CrewWeeklyVisits } from '@/app/management/reports/actions'

// A single series — one hue, no legend. The panel heading names the crew member,
// so color carries no identity here and never needs a second slot.
const chartConfig = {
  count: { label: 'Visits', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface PanelProps {
  crew: CrewWeeklyVisits
  maxWeekly: number
  reducedMotion: boolean
}

function CrewPanel({ crew, maxWeekly, reducedMotion }: PanelProps) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-foreground truncate" title={crew.name}>
          {crew.name}
        </p>
        {/* The one direct label per panel — the total, not a number per column. */}
        <p className="text-sm font-semibold text-foreground shrink-0">{crew.total}</p>
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-20 w-full">
        <BarChart data={crew.weeks} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" hide />
          {/* Shared domain across every panel — without it the facets aren't comparable. */}
          <YAxis domain={[0, maxWeekly]} hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(value, _name, item) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {(item?.payload as { label?: string })?.label}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {Number(value)} {Number(value) === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[2, 2, 0, 0]}
            maxBarSize={16}
            isAnimationActive={!reducedMotion}
          />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

export function VisitsPerCrewSmallMultiples({ report }: { report: CrewVisitsReport }) {
  const reducedMotion = usePrefersReducedMotion()
  const { crew, windowLabel, maxWeekly } = report

  const weekLabels = crew[0]?.weeks.map((w) => w.label) ?? []

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Crew</TableHead>
          {weekLabels.map((label) => (
            <TableHead key={label} className="text-right whitespace-nowrap">
              {label}
            </TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {crew.map((member) => (
          <TableRow key={member.employeeId}>
            <TableCell className="whitespace-nowrap">{member.name}</TableCell>
            {member.weeks.map((week) => (
              <TableCell key={week.label} className="text-right tabular-nums">
                {week.count}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums font-medium">
              {member.total}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <ReportCard
      title="Visits per crew member"
      subtitle={`Completed visits by week · ${windowLabel}`}
      footnote="Credit follows who logged the work in the field, not who was assigned to it. A visit worked by two people counts once for each."
      table={table}
    >
      {crew.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {crew.map((member) => (
            <CrewPanel
              key={member.employeeId}
              crew={member}
              maxWeekly={maxWeekly}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      ) : (
        <ReportEmpty>
          No completed visits in this window. Once crew log completions, each person gets
          a panel here.
        </ReportEmpty>
      )}
    </ReportCard>
  )
}
