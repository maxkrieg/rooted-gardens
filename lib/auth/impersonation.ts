/**
 * The super admin's own session, parked while they are signed in as someone else. AES-GCM
 * with a key derived from IMPERSONATION_SECRET, in an httpOnly cookie: it holds a refresh
 * token, and it is the only thing that can hand the admin's session back.
 */
export const IMPERSONATOR_COOKIE = 'rg-impersonator'

/** Matches the `rg-role` cookie. Past it the parked session is gone, so Stop just signs out. */
export const IMPERSONATION_MAX_AGE = 60 * 60 * 12

export interface ImpersonatorPayload {
  adminUserId: string
  adminLabel: string
  adminRefreshToken: string
  targetUserId: string
  targetEmployeeId: string
  targetName: string
  /** The `session_id` claim of the impersonated session; keys `impersonation_sessions`. */
  authSessionId: string
  startedAt: string
}

export function impersonationConfigured(): boolean {
  return !!process.env.IMPERSONATION_SECRET && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.IMPERSONATION_SECRET
  if (!secret) throw new Error('IMPERSONATION_SECRET is not set')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealImpersonator(payload: ImpersonatorPayload): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(),
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(sealed).toString('base64url')}`
}

/** Null for a missing, tampered or undecryptable cookie (e.g. after the secret rotates). */
export async function openImpersonator(
  value: string | undefined,
): Promise<ImpersonatorPayload | null> {
  if (!value) return null
  const [iv, sealed] = value.split('.')
  if (!iv || !sealed) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64url') },
      await key(),
      Buffer.from(sealed, 'base64url'),
    )
    return JSON.parse(new TextDecoder().decode(plain)) as ImpersonatorPayload
  } catch {
    return null
  }
}

/** The `session_id` claim of a Supabase access token. Decoded, not verified: we just minted it. */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  try {
    const claims = JSON.parse(
      Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { session_id?: unknown }
    return typeof claims.session_id === 'string' ? claims.session_id : null
  } catch {
    return null
  }
}
