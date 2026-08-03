'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createPhotoSchema,
  updatePhotoSchema,
  type CreatePhotoValues,
  type UpdatePhotoValues,
} from '@/lib/validators/photo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateAccount(accountId: string) {
  revalidatePath(`/management/accounts/${accountId}`)
}

/**
 * Resolve the acting employee and assert they can manage photos.
 *
 * The sibling account/property actions lean purely on RLS, but these need the
 * employee id anyway so `uploaded_by` comes from the session rather than a
 * client-supplied value — once we're doing the auth lookup, the role assertion
 * is free. RLS (`photos_insert` / `photos_update` / `photos_delete`) remains the
 * actual security boundary; this just produces a better error message.
 */
async function requireManagingEmployee(): Promise<
  { employeeId: string; error?: undefined } | { employeeId?: undefined; error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!employee) return { error: 'No employee record for this login' }
  if (employee.role !== 'owner' && employee.role !== 'lead') {
    return { error: 'Only owners and leads can manage photos' }
  }

  return { employeeId: employee.id }
}

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
    console.error('[createPropertyPhoto]', error)
    return { error: error.message }
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
    console.error('[updatePropertyPhoto]', error)
    return { error: error.message }
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
    console.error('[deletePropertyPhoto]', error)
    return { error: error.message }
  }

  revalidateAccount(accountId)
  return {}
}
