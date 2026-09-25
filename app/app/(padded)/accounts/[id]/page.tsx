import { AccountDetailView } from '@/components/management/AccountDetailView'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}

/** Thin shell for the client-first AccountDetailView. */
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
