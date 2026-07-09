import { format, parseISO } from 'date-fns'
import { qboPromise } from '@/lib/quickbooks/client'
import type QuickBooks from 'node-quickbooks'
import type { Account, VisitWithLocation } from '@/types/app'

const SERVICE_ITEM_NAME = process.env.QBO_SERVICE_ITEM_NAME || 'Services'

// Per-process cache — re-queried on cold start, fine for a low-frequency batch
// operation like invoice pushing (not worth persisting anywhere).
let cachedItemId: string | null = null

/**
 * Resolves the one shared QBO Product/Service every invoice line bills
 * against (see lib/quickbooks/invoice.ts's module doc for why this app uses a
 * single shared item rather than one per customer). Never auto-creates it —
 * that would also require picking/creating an Income account, an accounting
 * decision that should stay with the accountant.
 */
async function getServiceItemId(qbo: QuickBooks): Promise<string> {
  if (cachedItemId) return cachedItemId
  const result = await qboPromise<{ QueryResponse: { Item?: { Id: string }[] } }>((cb) =>
    qbo.findItems({ Name: SERVICE_ITEM_NAME }, cb),
  )
  const item = result.QueryResponse.Item?.[0]
  if (!item) {
    throw new Error(
      `Could not find a QuickBooks Product/Service named "${SERVICE_ITEM_NAME}" — create one in QuickBooks first.`,
    )
  }
  cachedItemId = item.Id
  return item.Id
}

export interface AccountInvoiceResult {
  qboInvoiceId?: string
  error?: string
}

type BillableAccount = Pick<
  Account,
  'qbo_customer_id' | 'billing_type' | 'price_per_visit' | 'contract_rate' | 'contract_period'
>

interface InvoiceLine {
  DetailType: 'SalesItemLineDetail'
  Amount: number
  Description?: string
  SalesItemLineDetail: { ItemRef: { value: string } }
}

/**
 * Creates one QBO Invoice for a single account's selected visits — one line
 * per visit for per_visit accounts, one flat-rate summary line for contract
 * accounts (this app bills contract accounts a flat periodic rate regardless
 * of visit count — never one line per visit for those). Every line bills
 * against the single shared "Services" item (see getServiceItemId) rather
 * than a per-customer item — this app always sets each line's exact dollar
 * amount explicitly from price_per_visit/contract_rate, so it never needs an
 * item's own default price the way manual QBO data entry does.
 *
 * as_needed accounts have no stored rate to bill against, so they error here
 * rather than being silently skipped — the caller (actions.ts) already
 * filters these out before calling this function, so this is a defensive
 * backstop, not the primary skip point.
 */
export async function pushAccountInvoice(
  qbo: QuickBooks,
  account: BillableAccount,
  visits: VisitWithLocation[],
): Promise<AccountInvoiceResult> {
  if (!account.qbo_customer_id) {
    return { error: 'Account is not linked to a QuickBooks customer' }
  }

  let itemId: string
  try {
    itemId = await getServiceItemId(qbo)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not find QuickBooks service item' }
  }

  let lines: InvoiceLine[]
  if (account.billing_type === 'per_visit') {
    if (account.price_per_visit == null) {
      return { error: 'No price per visit set for this account' }
    }
    lines = visits.map((v) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: Number(account.price_per_visit),
      Description: `${v.property.address} — ${format(parseISO(v.ended_at ?? v.week_start), 'MMM d')}`,
      SalesItemLineDetail: { ItemRef: { value: itemId } },
    }))
  } else if (account.billing_type === 'contract') {
    if (account.contract_rate == null) {
      return { error: 'No contract rate set for this account' }
    }
    lines = [
      {
        DetailType: 'SalesItemLineDetail',
        Amount: Number(account.contract_rate),
        Description: `${account.contract_period ?? 'Period'} service — ${visits.length} visit${visits.length === 1 ? '' : 's'}`,
        SalesItemLineDetail: { ItemRef: { value: itemId } },
      },
    ]
  } else {
    return { error: 'as_needed accounts have no set rate — invoice manually' }
  }

  try {
    const invoice = await qboPromise<{ Id: string }>((cb) =>
      qbo.createInvoice({ CustomerRef: { value: account.qbo_customer_id! }, Line: lines }, cb),
    )
    return { qboInvoiceId: invoice.Id }
  } catch (err) {
    console.error('[pushAccountInvoice] createInvoice', err)
    return { error: 'QuickBooks rejected the invoice' }
  }
}
