import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient, qboPromise } from '@/lib/quickbooks/client'
import type QuickBooks from 'node-quickbooks'
import { toUserMessage } from '@/lib/errors'
import { describeQboError } from '@/lib/quickbooks/errors'
import { reportError } from '@/lib/observability/report'

export interface SyncCustomerResult {
  error?: string
  qboCustomerId?: string
  /** What happened, so the UI can say so. 'recreated' means the old link was stale. */
  action?: 'created' | 'updated' | 'recreated'
}

interface AccountForSync {
  name: string
  email: string | null
  phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
}

interface QboBillAddr {
  Line1?: string
  Line2?: string
  City?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
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

/** Omitted when empty, so a sparse update never clears QBO's address. */
function buildBillAddr(account: AccountForSync): QboBillAddr | undefined {
  if (!account.billing_address_line1 && !account.billing_city) return undefined
  return {
    ...(account.billing_address_line1 ? { Line1: account.billing_address_line1 } : {}),
    ...(account.billing_address_line2 ? { Line2: account.billing_address_line2 } : {}),
    ...(account.billing_city ? { City: account.billing_city } : {}),
    ...(account.billing_state ? { CountrySubDivisionCode: account.billing_state } : {}),
    ...(account.billing_zip ? { PostalCode: account.billing_zip } : {}),
  }
}

async function createQboCustomer(qbo: QuickBooks, account: AccountForSync): Promise<string> {
  const billAddr = buildBillAddr(account)
  const customer = await qboPromise<{ Id: string }>((cb) =>
    qbo.createCustomer(
      {
        DisplayName: account.name,
        ...(account.email ? { PrimaryEmailAddr: { Address: account.email } } : {}),
        ...(account.phone ? { PrimaryPhone: { FreeFormNumber: account.phone } } : {}),
        ...(billAddr ? { BillAddr: billAddr } : {}),
      },
      cb,
    ),
  )
  return customer.Id
}

/**
 * Make accounts.qbo_customer_id point at a real QBO customer and push name/email/phone/address.
 * Creates one if unset or stale ("Object Not Found"); otherwise sparse-updates with the
 * SyncToken. Writes the id via the RLS client.
 */
export async function syncCustomer(accountId: string): Promise<SyncCustomerResult> {
  const supabase = await createClient()

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select(
      'name, email, phone, qbo_customer_id, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip',
    )
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
  let action: SyncCustomerResult['action']

  if (qboCustomerId) {
    try {
      const existing = await qboPromise<{ Id: string; SyncToken: string }>((cb) =>
        qbo.getCustomer(qboCustomerId!, cb),
      )
      try {
        const billAddr = buildBillAddr(account)
        await qboPromise((cb) =>
          qbo.updateCustomer(
            {
              Id: existing.Id,
              SyncToken: existing.SyncToken,
              DisplayName: account.name,
              ...(account.email ? { PrimaryEmailAddr: { Address: account.email } } : {}),
              ...(account.phone ? { PrimaryPhone: { FreeFormNumber: account.phone } } : {}),
              ...(billAddr ? { BillAddr: billAddr } : {}),
            },
            cb,
          ),
        )
        action = 'updated'
      } catch (updateErr) {
        console.error('[syncCustomer] updateCustomer', updateErr)
        reportError(updateErr, '[syncCustomer] updateCustomer', { message: describeQboError(updateErr) })
        return { error: 'Could not update QuickBooks customer' }
      }
    } catch (err) {
      if (!isQboNotFoundError(err)) {
        console.error('[syncCustomer] getCustomer', err)
        reportError(err, '[syncCustomer] getCustomer', { message: describeQboError(err) })
        return { error: 'Could not verify QuickBooks customer' }
      }
      try {
        qboCustomerId = await createQboCustomer(qbo, account)
        action = 'recreated'
      } catch (createErr) {
        console.error('[syncCustomer] recreate after 610', createErr)
        reportError(createErr, '[syncCustomer] recreate after 610', { message: describeQboError(createErr) })
        return { error: 'Could not create replacement QuickBooks customer' }
      }
    }
  } else {
    try {
      qboCustomerId = await createQboCustomer(qbo, account)
      action = 'created'
    } catch (err) {
      console.error('[syncCustomer] createCustomer', err)
      reportError(err, '[syncCustomer] createCustomer', { message: describeQboError(err) })
      return { error: 'Could not create QuickBooks customer' }
    }
  }

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ qbo_customer_id: qboCustomerId })
    .eq('id', accountId)

  if (updateError) {
    return {
      error: toUserMessage(
        updateError,
        'The QuickBooks customer was created, but linking it to this account failed. Try syncing again.',
        '[syncCustomer] update',
      ),
    }
  }

  return { qboCustomerId: qboCustomerId ?? undefined, action }
}
