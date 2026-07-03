/** Shared client-side validation for photo capture/upload — used by the crew
 *  completion logger (VisitLogger) and owner/lead Visit Plan reference photos
 *  (VisitPlanPhotos), both of which upload directly to the `photos` storage bucket. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
