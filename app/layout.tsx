import type { Metadata } from 'next'
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
    statusBarStyle: 'default',
    title: 'Rooted Crew',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent zoom on input focus on iOS (crew field use) */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#4A7C59" />
      </head>
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
