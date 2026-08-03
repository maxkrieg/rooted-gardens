import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'

/**
 * 404. Reached by a mistyped URL and by `notFound()` in
 * app/management/accounts/[id]/page.tsx, which until now fell through to Next's
 * default black-and-white page.
 *
 * The link goes to the dashboard rather than "back": someone who followed a stale
 * link to a deleted account wants a working starting point, not the page they
 * just came from.
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
