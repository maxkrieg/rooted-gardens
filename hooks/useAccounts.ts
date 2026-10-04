'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { routesDataKey } from '@/hooks/useRoutes'
import { signPhotoUrls } from '@/lib/utils/photos'
import {
  fetchAccountDetail,
  fetchAccountPhotos,
  fetchAccountsList,
  type AccountDetail,
} from '@/lib/accounts/fetch'

const accountsListKey = ['accounts-list'] as const
const accountDetailKey = (id: string) => ['account-detail', id]
const accountPhotosKey = (id: string) => ['account-photos', id]

/** The accounts list, read from the persisted cache and flagged stale rather than erroring. */
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

/** Refresh account caches after a Server Action; revalidatePath can't reach client-first pages. */
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
      // The schedule and routes page build their rows from their own copies of properties and
      // accounts, so an archive, rename or new property is stale there until these refetch.
      queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
      queryClient.invalidateQueries({ queryKey: routesDataKey })
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

/** Queue a notes/interval edit. Address and frequency still go through updateProperty. */
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
                        preferred_interval_days: notes.preferredIntervalDays ?? null,
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

type PropertyNotes = {
  crewNotes: string | null
  accessNotes: string | null
  parkingNotes: string | null
  /** null = follow the frequency default. */
  preferredIntervalDays?: number | null
}

/** Signed URLs. Not persisted (they expire hourly). A Record, since a Map serializes to {}. */
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
