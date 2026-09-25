/**
 * Page padding. A route group, so no URL segment. /app/stop/[visitId] sits outside it: it owns
 * its own sticky header and fixed action bar.
 */
export default function PaddedLayout({ children }: { children: React.ReactNode }) {
  return <div className="p-4 lg:p-6">{children}</div>
}
