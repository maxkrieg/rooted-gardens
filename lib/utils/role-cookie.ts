export function formatRoleCookie(userId: string, role: string): string {
  return `${userId}_${role}`
}

export function parseRoleCookie(
  value: string | undefined
): { userId: string; role: string } | null {
  if (!value) return null
  const idx = value.indexOf('_')
  if (idx < 0) return null
  return { userId: value.slice(0, idx), role: value.slice(idx + 1) }
}
