/** Shaping for node-quickbooks / axios errors. */

interface QboFaultError {
  Message?: string
  Detail?: string
  code?: string
}

interface QboErrorShape {
  response?: { status?: number; data?: { Fault?: { Error?: QboFaultError[] } } }
  Fault?: { Error?: QboFaultError[] }
}

/** node-quickbooks surfaces the fault in two places, depending on whether the
 *  failure came back through axios or its own callback wrapper. */
function firstFault(err: unknown): QboFaultError | undefined {
  const e = err as QboErrorShape
  return (e?.response?.data?.Fault ?? e?.Fault)?.Error?.[0]
}

/** One-line log summary. Never log the raw AxiosError: it's huge and embeds the access token. */
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

/** The Intuit fault text for the accountant, or null when there's none. */
export function qboFaultMessage(err: unknown): string | null {
  const first = firstFault(err)
  const msg = first?.Detail ?? first?.Message
  if (!msg) return null

  // Intuit prefixes many faults with a category and appends internal ids; keep
  // the first sentence, which is the human-readable part.
  const cleaned = msg.replace(/^Business Validation Error:\s*/i, '').split(/(?<=\.)\s/)[0].trim()
  if (!cleaned || cleaned.length > 160) return null
  return cleaned
}
