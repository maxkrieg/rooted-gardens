import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'

/** 404. Links to `/`, a working start for anyone, signed in or not. */
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
