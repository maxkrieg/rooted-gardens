import { RoutesView } from '@/components/management/RoutesView'

/**
 * Thin shell — the routes page is client-first (RoutesView) so it reads from the
 * persisted cache, and its writes repaint from the cache rather than waiting on
 * an RSC refresh that no longer carries the data.
 */
export default function RoutesPage() {
  return <RoutesView />
}
