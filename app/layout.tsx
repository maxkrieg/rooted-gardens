import type { Metadata, Viewport } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import { Providers } from '@/components/providers'
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
  // Required for relative Open Graph/social image URLs (app/(public)/*) to
  // resolve to absolute ones.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Rooted Gardens',
    template: '%s · Rooted Gardens',
  },
  // Public-facing default (task 9.2 made `/` a marketing page) — management
  // and crew routes are behind auth regardless of what this says.
  description: 'Eco-minded lawn care and garden design serving Norwich, VT and the Upper Valley.',
  icons: {
    icon: '/icons/icon-192.png',
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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${fraunces.variable} ${hankenGrotesk.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
