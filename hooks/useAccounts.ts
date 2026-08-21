'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import { signPhotoUrls } from '@/lib/utils/photos'
import {
  fetchAccountDetail,
  fetchAccountPhotos,
  fetchAccountsList,
  type AccountDetail,
} from '@/lib/accounts/fetch'

export const accountsListKey = ['accounts-list'] as const
export const accountDetailKey = (id: string) => ['account-detail', id]
export const accountPhotosKey = (id: string) => ['account-photos', id]

/**
 * The accounts list, client-side so it reads from the persisted cache in the
 * field. Same shape as useManagementSchedule: cached data renders flagged as
 * stale rather than erroring over something the owner can still use.
 */
export function useAccountsList() {
  const query = useQuery({
    queryKey: accountsListKey,
    queryFn: fetchAccountsList,
    staleTime: 60_000,
  })

  const hasData = !!query.data
  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    isStale: query.isError && hasData,
    hasData,
  }
}

/**
 * Refresh the account caches after a Server Action write.
 *
 * These pages are client-first now, so `revalidatePath` in an action only
 * refreshes an RSC shell that holds no data — without this, an edit lands in
 * Postgres and the screen never changes.
 */
export function useRefreshAccounts() {
  const queryClient = useQueryClient()

  return useCallback(
    (accountId?: string) => {
      queryClient.invalidateQueries({ queryKey: accountsListKey })
      queryClient.invalidateQueries({
        queryKey: accountId ? accountDetailKey(accountId) : ['account-detail'],
      })
      queryClient.invalidateQueries({
        queryKey: accountId ? accountPhotosKey(accountId) : ['account-photos'],
      })
      // Adding or archiving a property moves the sidebar's unrouted count, which
      // has no realtime path of its own — see useNavCounts.
      queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
    },
    [queryClient],
  )
}

/** `data === null` means the account is missing or archived, which is a 404 —
 *  distinct from `isError`, which means we couldn't reach the server. */
export function useAccountDetail(id: string) {
  const query = useQuery({
    queryKey: accountDetailKey(id),
    queryFn: () => fetchAccountDetail(id),
    staleTime: 60_000,
  })

  const hasData = query.data !== undefined
  return {
    detail: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isStale: query.isError && hasData,
    hasData,
  }
}

/** Photo rows, persisted. Paired with useSignedPhotoUrls below, which isn't. */
export function useAccountPhotos(accountId: string, propertyIds: string[]) {
  return useQuery({
    queryKey: accountPhotosKey(accountId),
    queryFn: () => fetchAccountPhotos(propertyIds),
    enabled: propertyIds.length > 0,
    staleTime: 60_000,
  })
}

/**
 * Queue a notes-only property edit so an owner can correct a gate code from the
 * driveway. Address and frequency changes still go through updateProperty —
 * replaying those blindly could clobber an edit made meanwhile.
 */
export function useUpdatePropertyNotes(accountId: string) {
  const queryClient = useQueryClient()

  return useCallback(
    async (propertyId: string, notes: PropertyNotes, label?: string) => {
      queryClient.setQueryData<AccountDetail | null>(accountDetailKey(accountId), (old) =>
        old
          ? {
              ...old,
              account: {
                ...old.account,
                properties: old.account.properties.map((p) =>
                  p.id === propertyId
                    ? {
                        ...p,
                        crew_notes: notes.crewNotes,
                        access_notes: notes.accessNotes,
                        parking_notes: notes.parkingNotes,
                      }
                    : p,
                ),
              },
            }
          : old,
      )

      await enqueueMutation('property_notes', { propertyId, ...notes }, label)
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },
    [accountId, queryClient],
  )
}

export type PropertyNotes = {
  crewNotes: string | null
  accessNotes: string | null
  parkingNotes: string | null
}

/**
 * Signed URLs for a batch of storage paths. Kept off the persistence allowlist
 * deliberately: they expire in an hour, so a rehydrated one is always dead.
 * Returns a plain Record, not a Map — the cache round-trips through JSON, and a
 * Map serializes to {}.
 */
export function useSignedPhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo-urls-batch', paths],
    queryFn: async () => {
      const supabase = createClient()
      const urlByPath = await signPhotoUrls(supabase.storage, paths)
      return Object.fromEntries(urlByPath) as Record<string, string>
    },
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000, // 50 min — well under the 1-hr signed URL expiry
  })
}
