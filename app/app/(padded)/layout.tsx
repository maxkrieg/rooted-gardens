/**
 * Page padding for the routes that came from the old management shell, which
 * supplied it from its layout.
 *
 * A route group so it adds no URL segment. `/app/stop/[visitId]` sits outside
 * it deliberately — that page owns its own chrome (a sticky header at `top-0`
 * and a fixed action bar), which layout padding would break.
 */
export default function PaddedLayout({ children }: { children: React.ReactNode }) {
  return <div className="p-4 lg:p-6">{children}</div>
}
