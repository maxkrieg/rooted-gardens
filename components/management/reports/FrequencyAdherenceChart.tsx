'use client'

import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'
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
import { formatDelta } from '@/lib/utils/reports'
import { ReportCard, ReportEmpty, usePrefersReducedMotion } from './ReportCard'
import type { AccountAdherence, AdherenceReport } from '@/app/management/reports/actions'

/** How many under-served accounts the chart shows before deferring to the table. */
const VISIBLE_ROWS = 12

// A diverging pair: clay (warm) for behind target, denim (cool) for ahead.
// The midpoint is a neutral gray rule, never a third hue.
const chartConfig = {
  delta: { label: 'Visits vs. target' },
  behind: { label: 'Behind target', color: 'var(--chart-2)' },
  ahead: { label: 'Ahead of target', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface Props {
  report: AdherenceReport
  year: number
}

export function FrequencyAdherenceChart({ report, year }: Props) {
  const reducedMotion = usePrefersReducedMotion()
  const { accounts, onTargetCount, windowLabel, weeks } = report

  const visible = accounts.slice(0, VISIBLE_ROWS)
  const hidden = accounts.length - visible.length

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Difference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account: AccountAdherence) => (
          <TableRow key={account.accountId}>
            <TableCell>{account.name}</TableCell>
            <TableCell className="text-right tabular-nums">{account.expected}</TableCell>
            <TableCell className="text-right tabular-nums">{account.actual}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatDelta(account.delta)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <ReportCard
      title="Visit frequency vs. contracted"
      subtitle={`Season to date · ${windowLabel} · ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`}
      footnote={`Target is each property's contracted frequency across the season window above. As-needed properties are excluded — they have no set cadence to fall short of.${
        hidden > 0 ? ` ${hidden} more ${hidden === 1 ? 'account is' : 'accounts are'} in the table.` : ''
      }${onTargetCount > 0 ? ` ${onTargetCount} at or above target.` : ''}`}
      table={table}
    >
      {visible.length > 0 ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: `${Math.max(visible.length * 32 + 32, 160)}px` }}
        >
          <BarChart
            data={visible}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 0, left: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={110}
              tickMargin={4}
            />
            {/* The neutral midpoint: target, i.e. delta 0. */}
            <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeWidth={1} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(_value, _name, item) => {
                    const row = item?.payload as AccountAdherence
                    return (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {row.actual} of {row.expected} expected
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatDelta(row.delta)}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Bar dataKey="delta" radius={4} maxBarSize={24} isAnimationActive={!reducedMotion}>
              {visible.map((account) => (
                // Color follows the entity's polarity, never its rank — a
                // re-sort or a filter can't repaint a row into the wrong sign.
                <Cell
                  key={account.accountId}
                  fill={account.delta < 0 ? 'var(--color-behind)' : 'var(--color-ahead)'}
                />
              ))}
              <LabelList
                dataKey="delta"
                position="right"
                className="fill-muted-foreground"
                fontSize={12}
                formatter={(value: number) => formatDelta(value)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <ReportEmpty>
          No completed visits in {year} yet, so there is no cadence to measure against.
        </ReportEmpty>
      )}
    </ReportCard>
  )
}
