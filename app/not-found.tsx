import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'

/**
 * 404, reached by a mistyped URL or `notFound()` on a deleted account. Links to
 * the dashboard rather than "back" — a stale link needs a working starting point.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <EmptyState
        variant="pruned"
        title="That page isn't here."
        hint="It may have been removed, or the link may be out of date."
        action={
          <Button asChild variant="outline">
            <Link href="/management/dashboard">Go to the dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
