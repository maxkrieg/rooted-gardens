/**
 * Shared shaping of node-quickbooks / axios errors (task 8.5).
 *
 * Extracted from invoiceStatus.ts, where `describeQboError` was already doing the
 * right thing but was private and log-only — so the invoice push discarded the
 * actual Intuit fault and told the accountant only "QuickBooks rejected the
 * invoice", with the reason buried in a server log they cannot read.
 */

interface QboFaultError {
  Message?: string
  Detail?: string
  code?: string
}

interface QboErrorShape {
  response?: { status?: number; data?: { Fault?: { Error?: QboFaultError[] } } }
  Fault?: { Error?: QboFaultError[] }
}

function firstFault(err: unknown): QboFaultError | undefined {
  const e = err as QboErrorShape
  // node-quickbooks surfaces the fault in two places depending on whether the
  // failure came back through axios or through its own callback wrapper.
  return (e?.response?.data?.Fault ?? e?.Fault)?.Error?.[0]
}

/**
 * Concise one-line summary for the **server log**. Critically, this avoids
 * `console.error(err)` on the raw AxiosError, which dumps hundreds of lines AND
 * embeds the QBO access token (the `Authorization: Bearer …` header) into the
 * logs on every failure.
 */
export function describeQboError(err: unknown): string {
  const e = err as QboErrorShape
  const status = e?.response?.status
  const first = firstFault(err)
  const msg = first?.Detail ?? first?.Message ?? first?.code
  if (status && msg) return `HTTP ${status}: ${msg}`
  if (status) return `HTTP ${status}`
  if (err instanceof Error) return err.message
  return 'unknown error'
}

/**
 * The Intuit fault message alone, for showing to the **accountant**.
 *
 * Unlike a Postgres error, a QBO business-validation fault is written for the
 * person doing the bookkeeping — "Duplicate Document Number", "Customer is
 * inactive" — and is exactly what they need to fix it themselves. So this is the
 * one class of upstream message the app deliberately forwards. HTTP scaffolding,
 * stack traces, and anything token-bearing are dropped.
 *
 * Returns null when the error carries no readable fault (network errors, 500s),
 * so the caller falls back to its own copy.
 */
export function qboFaultMessage(err: unknown): string | null {
  const first = firstFault(err)
  const msg = first?.Detail ?? first?.Message
  if (!msg) return null

  // Intuit prefixes many faults with a redundant category and appends internal
  // ids; keep the first sentence, which is the human-readable part.
  const cleaned = msg.replace(/^Business Validation Error:\s*/i, '').split(/(?<=\.)\s/)[0].trim()
  if (!cleaned || cleaned.length > 160) return null
  return cleaned
}
