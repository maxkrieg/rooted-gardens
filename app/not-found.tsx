import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'

/**
 * 404, reached by a mistyped URL, a stale public-site link, or `notFound()`
 * on a deleted account. Links to `/` rather than "back" — a stale link needs
 * a working starting point, and `/` is now the public marketing home
 * (task 9.2) reachable by anyone, signed in or not.
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
            <Link href="/">Back to the home page</Link>
          </Button>
        }
      />
    </div>
  )
}
