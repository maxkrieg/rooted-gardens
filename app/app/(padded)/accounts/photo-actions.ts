'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/server-role'
import {
  createPhotoSchema,
  updatePhotoSchema,
  type CreatePhotoValues,
  type UpdatePhotoValues,
} from '@/lib/validators/photo'
import { toUserMessage } from '@/lib/errors'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateAccount(accountId: string) {
  revalidatePath(`/app/accounts/${accountId}`)
}

const requireManagingEmployee = () =>
  requireRole(['owner', 'lead'], 'Only owners and leads can manage photos')

// ─── Property photos ──────────────────────────────────────────────────────────

/**
 * Record a property-level photo that has ALREADY been uploaded to storage.
 *
 * The image bytes deliberately do not pass through this action: Server Action
 * bodies are capped (1 MB by default in Next, and lower still by the serverless
 * request limit in production), while photos run up to 20 MB. The client uploads
 * straight to Supabase Storage with its own session — gated by the bucket's
 * INSERT policy — and then calls this to write the row.
 */
export async function createPropertyPhoto(
  accountId: string,
  values: CreatePhotoValues,
): Promise<{ error?: string; id?: string }> {
  const parsed = createPhotoSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid photo data' }
  }

  const auth = await requireManagingEmployee()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()

  // The new id comes back so the caller can open the photo for captioning as
  // soon as the refreshed gallery data arrives.
  const { data, error } = await supabase
    .from('photos')
    .insert({
      property_id: parsed.data.property_id,
      visit_id: null,
      storage_path: parsed.data.storage_path,
      type: parsed.data.type,
      caption: parsed.data.caption?.trim() || null,
      uploaded_by: auth.employeeId,
    })
    .select('id')
    .single()

  if (error) {
    return { error: toUserMessage(error, 'Could not save the photo.', '[createPropertyPhoto]') }
  }

  revalidateAccount(accountId)
  return { id: data.id }
}

/** Edit a photo's caption and/or correct its type. */
export async function updatePropertyPhoto(
  accountId: string,
  photoId: string,
  values: UpdatePhotoValues,
): Promise<{ error?: string }> {
  const parsed = updatePhotoSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid photo data' }
  }

  const auth = await requireManagingEmployee()
  if (auth.error) return { error: auth.error }

  const patch: { caption?: string | null; type?: string } = {}
  if (parsed.data.caption !== undefined) patch.caption = parsed.data.caption?.trim() || null
  if (parsed.data.type !== undefined) patch.type = parsed.data.type

  if (Object.keys(patch).length === 0) return {}

  const supabase = await createClient()
  const { error } = await supabase.from('photos').update(patch).eq('id', photoId)

  if (error) {
    return { error: toUserMessage(error, 'Could not update the photo.', '[updatePropertyPhoto]') }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Delete a photo — both the storage object and the row.
 *
 * Takes only the photo id: the storage path is re-read from the row server-side
 * rather than trusted from the caller, since a client-supplied path would let
 * any owner/lead delete an arbitrary object anywhere in the bucket.
 *
 * If the storage remove fails we still delete the row — an orphaned blob is a
 * bit of wasted space, while an orphaned row renders as a permanently broken
 * photo. The reverse (row-only delete) is the bug `useDeleteVisitPlanPhoto`
 * calls out.
 */
export async function deletePropertyPhoto(
  accountId: string,
  photoId: string,
): Promise<{ error?: string }> {
  const auth = await requireManagingEmployee()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()

  const { data: photo, error: readError } = await supabase
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .single()

  if (readError || !photo) {
    console.error('[deletePropertyPhoto] read', readError)
    return { error: 'Could not find that photo' }
  }

  const { error: storageError } = await supabase.storage
    .from('photos')
    .remove([photo.storage_path])
  if (storageError) {
    console.error('[deletePropertyPhoto] storage', storageError)
  }

  const { error } = await supabase.from('photos').delete().eq('id', photoId)
  if (error) {
    return { error: toUserMessage(error, 'Could not delete the photo.', '[deletePropertyPhoto]') }
  }

  revalidateAccount(accountId)
  return {}
}
