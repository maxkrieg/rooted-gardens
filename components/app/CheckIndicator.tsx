import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A checkbox that only *looks* like one.
 *
 * The shadcn `Checkbox` is a Radix Root, which renders a real `<button>`. Inside
 * a row that is itself a `<button>` — the pattern every select list here uses,
 * where the whole row is the tap target — that nests a button in a button:
 * invalid HTML, and React reports it as a hydration error.
 *
 * So where the box is decorative and the row owns the interaction, render this
 * instead. It carries no role, no tab stop, and no click handler; the row's
 * `aria-pressed` is what announces the state.
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
