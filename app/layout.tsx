import type { Metadata, Viewport } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import { Providers } from '@/components/providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  // Variable font — axes (opsz = optical sizing) requires weight: 'variable'
  weight: 'variable',
  axes: ['opsz'],
})

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Rooted Gardens',
  description: 'Internal business management for Rooted Gardens eco-landscaping',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // 'black-translucent' lets the web app paint under the status bar, which is
    // what viewportFit: 'cover' below assumes. Pairs with the safe-area insets
    // used by the crew bottom nav and sheet footers.
    statusBarStyle: 'black-translucent',
    title: 'Rooted Crew',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Required for env(safe-area-inset-*) to resolve to anything but 0px on
  // notched iOS. Without it every safe-area calc in the app is a no-op.
  viewportFit: 'cover',
  // No maximum-scale / user-scalable: blocking pinch-zoom fails WCAG 1.4.4, and
  // it isn't needed — every input bases at text-base (16px), which is what
  // actually prevents iOS zoom-on-focus.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F3EA' },
    { media: '(prefers-color-scheme: dark)', color: '#1C1A15' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${hankenGrotesk.variable} antialiased`}
      >
        <Providers>
          <ServiceWorkerRegistration />
          {children}
        </Providers>
      </body>
    </html>
  )
}
