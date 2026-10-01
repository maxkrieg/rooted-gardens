/**
 * The readable half of an impersonation: who the banner should say you are. Display only —
 * the authority to stop lives in the encrypted, httpOnly `rg-impersonator` cookie
 * (lib/auth/impersonation.ts). Shared by the server actions that set it and the client
 * banner that reads it, so it must stay free of server imports.
 */
export const IMPERSONATION_DISPLAY_COOKIE = 'rg-impersonating'

export interface ImpersonationDisplay {
  /** The impersonated auth user. The banner shows only while this is who is signed in. */
  userId: string
  name: string
  role: string
  /** True on the production deployment, where every action has real effects. */
  live: boolean
}

export function formatImpersonationDisplay(display: ImpersonationDisplay): string {
  return encodeURIComponent(JSON.stringify(display))
}

export function parseImpersonationDisplay(
  value: string | undefined | null,
): ImpersonationDisplay | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ImpersonationDisplay>
    if (typeof parsed.userId !== 'string' || typeof parsed.name !== 'string') return null
    return {
      userId: parsed.userId,
      name: parsed.name,
      role: typeof parsed.role === 'string' ? parsed.role : '',
      live: parsed.live === true,
    }
  } catch {
    return null
  }
}
