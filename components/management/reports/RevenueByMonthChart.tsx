'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import {
  ReportCard,
  ReportEmpty,
  useIsNarrow,
  usePrefersReducedMotion,
} from './ReportCard'
import type { MonthlyRevenue } from '@/app/management/reports/actions'

// Two series → categorical slots 1 and 2, assigned in fixed order.
const chartConfig = {
  invoiced: { label: 'Invoiced', color: 'var(--chart-1)' },
  paid: { label: 'Paid', color: 'var(--chart-2)' },
} satisfies ChartConfig

function money(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

interface Props {
  data: MonthlyRevenue[]
  year: number
}

export function RevenueByMonthChart({ data, year }: Props) {
  const reducedMotion = usePrefersReducedMotion()
  const narrow = useIsNarrow()
  const hasData = data.some((m) => m.invoiced > 0 || m.paid > 0)

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Invoiced</TableHead>
          <TableHead className="text-right">Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((month) => (
          <TableRow key={month.label}>
            <TableCell>{month.fullLabel}</TableCell>
            <TableCell className="text-right tabular-nums">
              {money(month.invoiced)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{money(month.paid)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <ReportCard
      title="Revenue by month"
      subtitle={`Invoiced and collected · ${year}`}
      footnote="Paid reflects what QuickBooks reports as settled. An invoice paid outside QuickBooks' own flow never gets a paid date, so it stays in the invoiced series only."
      table={table}
    >
      {hasData ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          {/* barGap=2 is the surface gap that separates the paired bars — the
              separation is negative space, never a stroke around the marks. */}
          <BarChart
            data={data}
            barGap={2}
            margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
          >
            {/* Solid hairline grid, horizontal only — recessive, never dashed. */}
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              // One letter on a phone so 12 months never collide or rotate.
              tickFormatter={(value: string) => (narrow ? value.slice(0, 1) : value)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickMargin={4}
              tickFormatter={(value: number) =>
                value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="fullLabel"
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {money(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {/* 4px rounded data-end, square at the baseline; capped thickness so
                the band keeps its air. The 2px gap between the pair is barGap. */}
            <Bar
              dataKey="invoiced"
              fill="var(--color-invoiced)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="paid"
              fill="var(--color-paid)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <ReportEmpty>
          No invoices recorded for {year}. Push a completed visit from Billing to start
          the trend.
        </ReportEmpty>
      )}
    </ReportCard>
  )
}
