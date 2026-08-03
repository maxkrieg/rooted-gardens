import { cn } from "@/lib/utils"

/**
 * Loading placeholder. Warmer than shadcn's default: a slow sweep across
 * `--muted` rather than an opacity pulse, so it reads as paper rather than as a
 * flashing gray box. The sweep is defined as `.skeleton-paper` in globals.css and
 * is disabled under `prefers-reduced-motion`.
 *
 * Skeletons must mirror the real layout's dimensions — a block that settles into
 * a different size causes a layout jump, which on a phone in the field is worse
 * than showing nothing.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("skeleton-paper rounded-lg bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
