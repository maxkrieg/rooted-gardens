import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuditLogView } from '@/components/management/AuditLogView'
import { ErrorState } from '@/components/states/ErrorState'
import { AUDIT_ACTIONS } from '@/lib/audit/actions'

const PAGE_SIZE = 50
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Activity log, owner/lead only (rechecked here, matching the proxy and RLS). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; actor?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (me?.role !== 'owner' && me?.role !== 'lead') redirect('/app/schedule')

  // Ignore malformed params rather than erroring on a hand-edited URL.
  const action = params.action && params.action in AUDIT_ACTIONS ? params.action : null
  const actor =
    params.actor === 'system' || (params.actor && UUID_RE.test(params.actor)) ? params.actor : null
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (action) query = query.eq('action', action)
  if (actor === 'system') query = query.is('actor_employee_id', null)
  else if (actor) query = query.eq('actor_employee_id', actor)

  const [{ data: entries, count, error }, { data: employees }] = await Promise.all([
    query,
    supabase.from('employees').select('id, name').order('name'),
  ])

  if (error) {
    console.error('[audit] list', error)
    return (
      <ErrorState title="The activity log didn't load." hint="Check your connection, then try again." />
    )
  }

  return (
    <AuditLogView
      entries={entries ?? []}
      employees={employees ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      action={action}
      actor={actor}
    />
  )
}
