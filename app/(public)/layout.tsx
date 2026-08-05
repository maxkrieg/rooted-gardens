import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

// Per-page metadata (generateMetadata in each page.tsx) supplies the real
// title/description; this is the fallback + the Open Graph defaults every
// public page inherits.
export const metadata: Metadata = {
  description:
    'Eco-minded lawn care and garden design serving Norwich, VT and the Upper Valley.',
  openGraph: {
    type: 'website',
    siteName: 'Rooted Gardens',
    locale: 'en_US',
  },
}

/**
 * Chrome for the public marketing site (task 9.2) — top nav + footer, no
 * management sidebar or crew bottom nav. Deliberately reads no cookies and
 * calls no Supabase client itself (PublicHeader/PublicFooter each fetch
 * their own slice), so nothing here forces the route into a particular
 * rendering mode on its own.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
