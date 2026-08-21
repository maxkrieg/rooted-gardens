import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Marks a view as rendering from the last saved copy. Shown when a fetch failed
 * but cached data exists — the alternative is erroring over data the owner can
 * still act on.
 */
export function CachedNotice({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={cn('mb-3 flex items-center gap-1.5 text-xs text-muted-foreground', className)}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Showing your last saved copy — changes sync when you&rsquo;re back online.
    </p>
  )
}
