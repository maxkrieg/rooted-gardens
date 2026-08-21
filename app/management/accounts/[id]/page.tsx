import { cookies } from 'next/headers'
import { AccountDetailView } from '@/components/management/AccountDetailView'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import type { EmployeeRole } from '@/types/app'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}

/**
 * Thin shell — the detail body is client-first (AccountDetailView) so gate codes,
 * access notes, and customer numbers are readable in the field. Only the role
 * cookie has to be read here.
 */
export default async function AccountDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { view } = await searchParams
  const cookieStore = await cookies()
  const role = (parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'crew') as EmployeeRole

  return (
    <AccountDetailView
      accountId={id}
      initialView={view === 'photos' ? 'photos' : 'details'}
      role={role}
    />
  )
}
