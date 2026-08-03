import { cn } from "@/lib/utils"

/**
 * Loading placeholder — a slow sweep across `--muted` rather than an opacity
 * pulse, so it reads as paper (`.skeleton-paper` in globals.css, disabled under
 * `prefers-reduced-motion`). Always mirror the real layout's dimensions.
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
