import { AccountDetailView } from '@/components/management/AccountDetailView'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}

/**
 * Thin shell — the detail body is client-first (AccountDetailView) so gate codes,
 * access notes, and customer numbers are readable in the field. Capabilities come
 * from the shell's RoleProvider, so nothing role-related is read here.
 */
export default async function AccountDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { view } = await searchParams

  return (
    <AccountDetailView
      accountId={id}
      initialView={view === 'photos' ? 'photos' : 'details'}
    />
  )
}
