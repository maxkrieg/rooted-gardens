'use client'

import { useEffect } from 'react'
import { OfflineBanner } from '@/components/crew/OfflineBanner'
import { InstallPrompt, MANAGEMENT_DISMISSED_KEY } from '@/components/crew/InstallPrompt'
import { flushMutationQueue } from '@/lib/crew/mutation-queue'

/**
 * Client half of the management layout: the offline queue's flush trigger and
 * its only visible surface. The drawer's completion/skip sheets already enqueue
 * to IndexedDB, so without this an owner's field write never syncs.
 */
export function ManagementShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    flushMutationQueue()
  }, [])

  return (
    <>
      <OfflineBanner />
      <InstallPrompt dismissKey={MANAGEMENT_DISMISSED_KEY} />
      {children}
    </>
  )
}
