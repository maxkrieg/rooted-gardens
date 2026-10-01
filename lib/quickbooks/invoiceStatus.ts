import type { SupabaseClient } from '@supabase/supabase-js'
import type QuickBooks from 'node-quickbooks'
import { qboPromise } from '@/lib/quickbooks/client'
import type { Database } from '@/types/database'
import type { Invoice, InvoiceStatus } from '@/types/app'
import { describeQboError } from '@/lib/quickbooks/errors'
import { reportError } from '@/lib/observability/report'

// node-quickbooks uses `export =`, so the Invoice fields we read are declared locally.
interface QboInvoiceDetail {
  Id: string
  SyncToken: string
  Balance: number
  TotalAmt: number
  DueDate?: string
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent'
}

/**
 * Reads QBO invoice status back into `invoices` — the one exception to one-way sync. Status
 * only; nothing feeds invoice creation. Callers pass the client (service for cron, RLS for manual).
 */

interface DerivedInvoiceStatus {
  status: InvoiceStatus
  qboBalance: number
  qboDueDate: string | null
  qboEmailStatus: string | null
}

/**
 * QBO Invoice → status: Balance 0 → paid; emailed and past due → overdue; emailed → sent;
 * else draft. Dates compare as 'yyyy-MM-dd' strings. Voids read as paid, partials as sent.
 */
function deriveInvoiceStatus(
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

type SyncableInvoice = Pick<Invoice, 'id' | 'qbo_invoice_id' | 'sent_at' | 'paid_at'>

/** Fetch one invoice from QBO and write its status back. Returns `{ error }`, never throws. */
export async function syncInvoiceStatus(
  supabase: SupabaseClient<Database>,
  qbo: QuickBooks,
  row: SyncableInvoice,
): Promise<{ error?: string }> {
  let detail: QboInvoiceDetail
  try {
    detail = await qboPromise<QboInvoiceDetail>((cb) => qbo.getInvoice(row.qbo_invoice_id, cb))
  } catch (err) {
    console.error(
      `[syncInvoiceStatus] getInvoice ${row.qbo_invoice_id} — ${describeQboError(err)}`,
    )
    reportError(err, '[syncInvoiceStatus] getInvoice', { message: describeQboError(err) })
    // Stamp last_synced_at even on failure so a bad id isn't retried every tick.
    await supabase
      .from('invoices')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', row.id)
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
    reportError(error, '[syncInvoiceStatus] update')
    return { error: 'Could not record invoice status locally' }
  }

  return {}
}

interface SyncResult {
  processed: number
  errors: number
}

/** Syncs up to `limit` unpaid invoices, stalest first. One failure never aborts the batch. */
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
    if (error) reportError(error, '[syncPendingInvoices] select')
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
