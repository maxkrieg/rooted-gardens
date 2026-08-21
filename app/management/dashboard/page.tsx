import { DashboardView } from '@/components/management/DashboardView'

/**
 * Thin shell — the dashboard is client-first (DashboardView) and derives this
 * week's numbers from the schedule's cache, so it works offline and adds no
 * queries beyond the fleet-maintenance check.
 */
export default function DashboardPage() {
  return <DashboardView />
}
