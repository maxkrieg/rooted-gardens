import { AccountsView } from '@/components/management/AccountsView'

/**
 * Thin shell — the list is client-first (AccountsView) so it reads from the
 * persisted cache when an owner looks a customer up with no signal.
 */
export default function AccountsPage() {
  return <AccountsView />
}
