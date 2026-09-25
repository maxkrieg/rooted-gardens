import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A decorative checkbox for rows that are themselves buttons: a real Checkbox would nest a
 * button in a button. The row's `aria-pressed` carries the state.
 */
export function CheckIndicator({
  checked,
  className,
}: {
  checked: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-4 w-4 shrink-0 place-content-center rounded-sm border border-primary',
        checked && 'bg-primary text-primary-foreground',
        className,
      )}
    >
      {checked && <Check className="h-4 w-4" />}
    </span>
  )
}
