import type { SupabaseClient } from '@supabase/supabase-js'
import type QuickBooks from 'node-quickbooks'
import { qboPromise } from '@/lib/quickbooks/client'
import type { Database } from '@/types/database'
import type { Invoice, InvoiceStatus } from '@/types/app'

// `node-quickbooks` uses `export =`, so its ambient interfaces can't be named-
// imported — the subset of a QBO Invoice we read is declared locally (same
// precedent as lib/quickbooks/invoice.ts's InvoiceLine). Structurally matches
// the QboInvoiceDetail in types/quickbooks.d.ts that getInvoice's callback uses.
interface QboInvoiceDetail {
  Id: string
  SyncToken: string
  Balance: number
  TotalAmt: number
  DueDate?: string
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent'
}

/**
 * Reads QBO invoice lifecycle status back into the app's `invoices` table.
 *
 * This is the one narrow exception to the otherwise strictly one-way (app → QBO)
 * sync: we read an invoice's status ONLY to answer "has QuickBooks actually sent
 * it to the customer / been paid yet" — never customer data, payment details, or
 * edits made in QBO, and nothing here feeds back into invoice creation or pricing.
 *
 * Driven by both the daily cron (app/api/cron/sync-invoice-status) and the manual
 * "Refresh now" action (app/management/billing/actions.ts). The Supabase client is
 * passed in — cron supplies the service client (bypasses RLS, unattended), the
 * action supplies the authenticated RLS client — the same "caller supplies the
 * client" pattern as lib/quickbooks/client.ts's upsertIntegrationTokens.
 */

export interface DerivedInvoiceStatus {
  status: InvoiceStatus
  qboBalance: number
  qboDueDate: string | null
  qboEmailStatus: string | null
}

/**
 * Pure mapping from a QBO Invoice entity to our lifecycle status. Priority:
 *   1. Balance == 0                                    → paid
 *   2. EmailSent && Balance > 0 && DueDate < today     → overdue
 *   3. EmailSent && Balance > 0                         → sent
 *   4. otherwise                                        → draft
 *
 * `todayISODate` is supplied by the caller (e.g. format(new Date(), 'yyyy-MM-dd'))
 * so this stays pure/testable. DueDate is QBO's bare 'yyyy-MM-dd' calendar date;
 * comparing it as a plain string against todayISODate avoids Date-parsing
 * timezone bugs — both are the same lexicographically-ordered format.
 *
 * Known gaps (see docs/INVOICING.md): a voided invoice also reports Balance 0, so
 * it reads as `paid`; a partial payment leaves Balance > 0, so it stays
 * sent/overdue with qbo_balance < amount. Neither is detected separately here.
 */
export function deriveInvoiceStatus(
  invoice: QboInvoiceDetail,
  todayISODate: string,
): DerivedInvoiceStatus {
  const balance = Number(invoice.Balance ?? 0)
  const dueDate = invoice.DueDate ?? null
  const emailStatus = invoice.EmailStatus ?? null
  const sent = emailStatus === 'EmailSent'

  let status: InvoiceStatus
  if (balance === 0) {
    status = 'paid'
  } else if (sent && dueDate !== null && dueDate < todayISODate) {
    status = 'overdue'
  } else if (sent) {
    status = 'sent'
  } else {
    status = 'draft'
  }

  return { status, qboBalance: balance, qboDueDate: dueDate, qboEmailStatus: emailStatus }
}

/** The invoice fields syncInvoiceStatus needs — its id (to update), the QBO id
 *  (to fetch), and the set-once timestamps (so they're only stamped the first
 *  time the invoice reaches that state). */
type SyncableInvoice = Pick<Invoice, 'id' | 'qbo_invoice_id' | 'sent_at' | 'paid_at'>

/**
 * Fetches one invoice from QBO, derives its status, and writes the snapshot back.
 * Never throws — returns `{ error }` on either the QBO call or the DB write
 * failing, so a batch caller can continue past a bad row (same per-item
 * resilience as pushInvoicesToQuickBooks's per-group loop).
 */
export async function syncInvoiceStatus(
  supabase: SupabaseClient<Database>,
  qbo: QuickBooks,
  row: SyncableInvoice,
): Promise<{ error?: string }> {
  let detail: QboInvoiceDetail
  try {
    detail = await qboPromise<QboInvoiceDetail>((cb) => qbo.getInvoice(row.qbo_invoice_id, cb))
  } catch (err) {
    console.error('[syncInvoiceStatus] getInvoice', row.qbo_invoice_id, err)
    return { error: 'Could not read invoice from QuickBooks' }
  }

  const now = new Date()
  const todayISODate = now.toISOString().slice(0, 10) // 'yyyy-MM-dd', UTC
  const nowISO = now.toISOString()
  const derived = deriveInvoiceStatus(detail, todayISODate)

  const becameSent = derived.status === 'sent' || derived.status === 'overdue'
  const becamePaid = derived.status === 'paid'

  const { error } = await supabase
    .from('invoices')
    .update({
      status: derived.status,
      qbo_balance: derived.qboBalance,
      qbo_due_date: derived.qboDueDate,
      qbo_email_status: derived.qboEmailStatus,
      sent_at: row.sent_at ?? (becameSent ? nowISO : null),
      paid_at: row.paid_at ?? (becamePaid ? nowISO : null),
      last_synced_at: nowISO,
    })
    .eq('id', row.id)

  if (error) {
    console.error('[syncInvoiceStatus] update', row.id, error)
    return { error: 'Could not record invoice status locally' }
  }

  return {}
}

export interface SyncResult {
  processed: number
  errors: number
}

/**
 * Syncs the oldest-not-recently-synced open invoices (status <> 'paid') from QBO,
 * bounded by `limit` to cap QBO API calls per run. Ordered by last_synced_at
 * ascending nulls-first so never-synced and stalest invoices are refreshed first.
 * One bad invoice never aborts the batch.
 */
export async function syncPendingInvoices(
  supabase: SupabaseClient<Database>,
  qbo: QuickBooks,
  options?: { limit?: number },
): Promise<SyncResult> {
  const limit = options?.limit ?? 50

  const { data, error } = await supabase
    .from('invoices')
    .select('id, qbo_invoice_id, sent_at, paid_at')
    .neq('status', 'paid')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error || !data) {
    console.error('[syncPendingInvoices] select', error)
    return { processed: 0, errors: 0 }
  }

  let processed = 0
  let errors = 0
  for (const row of data) {
    const res = await syncInvoiceStatus(supabase, qbo, row)
    if (res.error) errors++
    else processed++
  }

  return { processed, errors }
}
