import { format, parseISO } from 'date-fns'
import { qboPromise } from '@/lib/quickbooks/client'
import type QuickBooks from 'node-quickbooks'
import type { Account, VisitWithLocation } from '@/types/app'
import { describeQboError, qboFaultMessage } from '@/lib/quickbooks/errors'
import { reportError } from '@/lib/observability/report'

const SERVICE_ITEM_NAME = process.env.QBO_SERVICE_ITEM_NAME || 'Services'

// Per-process cache — re-queried on cold start, fine for a low-frequency batch
// operation like invoice pushing (not worth persisting anywhere).
let cachedItemId: string | null = null

/**
 * The one shared QBO Service item every line bills against. Never auto-created: that means
 * picking an Income account, which is the accountant's call.
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

interface AccountInvoiceResult {
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
 * One QBO invoice for an account: a line per visit (per_visit) or one flat line (contract), all
 * on the shared item with explicit amounts. Other billing types error as a backstop.
 * `amountOverride` bills a contract account a one-off amount.
 */
export async function pushAccountInvoice(
  qbo: QuickBooks,
  account: BillableAccount,
  visits: VisitWithLocation[],
  options?: { amountOverride?: number },
): Promise<AccountInvoiceResult> {
  if (!account.qbo_customer_id) {
    return { error: 'Account is not linked to a QuickBooks customer' }
  }

  let itemId: string
  try {
    itemId = await getServiceItemId(qbo)
  } catch (err) {
    console.error('[pushAccountInvoice] getServiceItemId', describeQboError(err))
    reportError(err, '[pushAccountInvoice] getServiceItemId', { message: describeQboError(err) })
    return {
      error: `Could not find the "${SERVICE_ITEM_NAME}" product in QuickBooks. Create it there, then try again.`,
    }
  }

  let lines: InvoiceLine[]
  if (account.billing_type === 'per_visit') {
    if (account.price_per_visit == null) {
      return { error: 'No price per visit set for this account' }
    }
    lines = visits.map((v) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: Number(account.price_per_visit),
      Description: `${v.property.address} — ${format(parseISO(v.ended_at ?? v.week_start), 'MMM d')}${
        v.service_types?.length ? ` — ${v.service_types.join(', ')}` : ''
      }`,
      SalesItemLineDetail: { ItemRef: { value: itemId } },
    }))
  } else if (account.billing_type === 'contract') {
    const amount = options?.amountOverride ?? account.contract_rate
    if (amount == null) {
      return { error: 'No contract rate set for this account' }
    }
    lines = [
      {
        DetailType: 'SalesItemLineDetail',
        Amount: Number(amount),
        Description: `${account.contract_period ?? 'Period'} service — ${visits.length} visit${visits.length === 1 ? '' : 's'}`,
        SalesItemLineDetail: { ItemRef: { value: itemId } },
      },
    ]
  } else {
    // Unrecognised billing_type — see the backstop note in the docblock above.
    return { error: 'This account has no billable rate — invoice it manually' }
  }

  try {
    const invoice = await qboPromise<{ Id: string }>((cb) =>
      qbo.createInvoice({ CustomerRef: { value: account.qbo_customer_id! }, Line: lines }, cb),
    )
    return { qboInvoiceId: invoice.Id }
  } catch (err) {
    console.error('[pushAccountInvoice] createInvoice', describeQboError(err))
    reportError(err, '[pushAccountInvoice] createInvoice', { message: describeQboError(err) })
    // Forward Intuit's validation message; it's written for a bookkeeper.
    const fault = qboFaultMessage(err)
    return { error: fault ? `QuickBooks rejected the invoice — ${fault}` : 'QuickBooks rejected the invoice.' }
  }
}
