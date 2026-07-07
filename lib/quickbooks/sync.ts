import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient, qboPromise } from '@/lib/quickbooks/client'
import type QuickBooks from 'node-quickbooks'

export interface SyncCustomerResult {
  error?: string
  qboCustomerId?: string
  /** True when a previously-linked qbo_customer_id was found missing in QBO
   *  (fault code 610) and a fresh customer was created to replace it — the UI
   *  shows a distinct message for this, not a plain success toast. */
  recreated?: boolean
}

/** Narrows QBO's two possible "Object Not Found" fault shapes (confirmed by
 *  reading node-quickbooks' HTTP layer directly — see types/quickbooks.d.ts). */
function isQboNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as {
    Fault?: { Error?: { code?: string }[] }
    response?: { data?: { Fault?: { Error?: { code?: string }[] } } }
  }
  const code = e.Fault?.Error?.[0]?.code ?? e.response?.data?.Fault?.Error?.[0]?.code
  return code === '610'
}

async function createQboCustomer(
  qbo: QuickBooks,
  account: { name: string; email: string | null; phone: string | null },
): Promise<string> {
  const customer = await qboPromise<{ Id: string }>((cb) =>
    qbo.createCustomer(
      {
        DisplayName: account.name,
        ...(account.email ? { PrimaryEmailAddr: { Address: account.email } } : {}),
        ...(account.phone ? { PrimaryPhone: { FreeFormNumber: account.phone } } : {}),
      },
      cb,
    ),
  )
  return customer.Id
}

/**
 * Ensures accounts.qbo_customer_id points to a real, existing QBO customer.
 * null → create a new QBO customer, store the returned Id. Existing → fetch
 * it; if QBO reports "Object Not Found" (the stored id is stale/deleted on
 * QBO's side), transparently create a replacement and update the stored id.
 *
 * Writes only the qbo_customer_id column via the normal RLS client (never the
 * service client) — the accounts_update RLS policy + enforce_accountant_columns
 * trigger (migration 20260615020240_rls_core_crm.sql) already permit
 * owner/lead (full update) and accountant (this column only) to make exactly
 * this write, as long as no other column is touched.
 */
export async function syncCustomer(accountId: string): Promise<SyncCustomerResult> {
  const supabase = await createClient()

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('name, email, phone, qbo_customer_id')
    .eq('id', accountId)
    .single()

  if (fetchError || !account) {
    console.error('[syncCustomer] account lookup', fetchError)
    return { error: 'Account not found' }
  }

  let qbo: QuickBooks
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return { error: 'Connect QuickBooks from the Billing page first' }
  }

  let qboCustomerId = account.qbo_customer_id
  let recreated = false

  if (qboCustomerId) {
    try {
      await qboPromise((cb) => qbo.getCustomer(qboCustomerId!, cb))
    } catch (err) {
      if (!isQboNotFoundError(err)) {
        console.error('[syncCustomer] getCustomer', err)
        return { error: 'Could not verify QuickBooks customer' }
      }
      try {
        qboCustomerId = await createQboCustomer(qbo, account)
        recreated = true
      } catch (createErr) {
        console.error('[syncCustomer] recreate after 610', createErr)
        return { error: 'Could not create replacement QuickBooks customer' }
      }
    }
  } else {
    try {
      qboCustomerId = await createQboCustomer(qbo, account)
    } catch (err) {
      console.error('[syncCustomer] createCustomer', err)
      return { error: 'Could not create QuickBooks customer' }
    }
  }

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ qbo_customer_id: qboCustomerId })
    .eq('id', accountId)

  if (updateError) {
    console.error('[syncCustomer] update', updateError)
    return { error: updateError.message }
  }

  return { qboCustomerId: qboCustomerId ?? undefined, recreated }
}
