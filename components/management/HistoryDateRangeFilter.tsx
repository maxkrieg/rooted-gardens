'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_PRESET_LABELS,
  type DateRangePreset,
} from '@/lib/utils/billing'

interface HistoryDateRangeFilterProps {
  preset: DateRangePreset
  customStart?: string
  customEnd?: string
}

/**
 * The History tab's date-range filter — replaces the old prev/next month
 * paging (BillingMonthNav) with presets plus a custom range, since "invoiced
 * this calendar month" isn't the only window an accountant wants to audit.
 * Lives in the filter row next to the account filter, not the page header.
 */
export function HistoryDateRangeFilter({ preset, customStart, customEnd }: HistoryDateRangeFilterProps) {
  const router = useRouter()
  const now = new Date()
  const [draftStart, setDraftStart] = useState(customStart ?? format(startOfMonth(now), 'yyyy-MM-dd'))
  const [draftEnd, setDraftEnd] = useState(customEnd ?? format(endOfMonth(now), 'yyyy-MM-dd'))

  function navigate(nextPreset: DateRangePreset, start?: string, end?: string) {
    const params = new URLSearchParams({ view: 'invoiced', range: nextPreset })
    if (nextPreset === 'custom') {
      params.set('start', start ?? draftStart)
      params.set('end', end ?? draftEnd)
    }
    router.push(`/management/billing?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(value) => navigate(value as DateRangePreset)}>
        <SelectTrigger className="h-10 w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {DATE_RANGE_PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-10 w-[150px]"
            value={draftStart}
            onChange={(e) => {
              setDraftStart(e.target.value)
              navigate('custom', e.target.value, draftEnd)
            }}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-10 w-[150px]"
            value={draftEnd}
            onChange={(e) => {
              setDraftEnd(e.target.value)
              navigate('custom', draftStart, e.target.value)
            }}
          />
        </div>
      )}
    </div>
  )
}
