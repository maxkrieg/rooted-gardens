import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Building2, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AccountStatusBadge, BillingTypeBadge } from '@/components/management/badges'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { AccountListRow } from '@/types/app'

export function AccountCard({ account }: { account: AccountListRow }) {
  return (
    <Link href={`/management/accounts/${account.id}`} className="block">
      <Card className="rounded-2xl border border-border shadow-warm hover:shadow-warm-lg transition-shadow">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-foreground truncate">
                {account.name}
              </p>
              {account.contact_name && (
                <p className="text-sm text-muted-foreground truncate">{account.contact_name}</p>
              )}
            </div>
            <AccountStatusBadge status={account.status} />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <BillingTypeBadge billingType={account.billing_type} />

            <span className="tabular-nums">{formatAccountPrice(account)}</span>

            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {account.propertyCount} {account.propertyCount === 1 ? 'property' : 'properties'}
            </span>

            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {account.lastVisitDate
                ? format(parseISO(account.lastVisitDate), 'EEE MMM d')
                : 'No visits yet'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
