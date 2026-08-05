import type { Metadata } from 'next'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { CrewShell } from '@/components/crew/CrewShell'

// Scoped to /crew/* only (task 9.2) — this used to live on the root layout,
// which meant anonymous public-site visitors were offered an install of the
// "Rooted Crew" field app. Management is online-first by design and
// manifest.json's start_url is already /crew/schedule, so an owner
// installing from a management page was always landing here anyway.
export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // 'black-translucent' lets the web app paint under the status bar, which is
    // what the root layout's viewportFit: 'cover' assumes. Pairs with the
    // safe-area insets used by the crew bottom nav and sheet footers.
    statusBarStyle: 'black-translucent',
    title: 'Rooted Crew',
  },
}

// A `'use client'` layout can't export `metadata`, so the interactive shell
// (bottom nav, offline queue flush, realtime sync) lives in CrewShell and
// this stays a thin server component.
export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <CrewShell>{children}</CrewShell>
    </>
  )
}
