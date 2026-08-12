-- =================================================================
-- Task 9.6 — private `resumes` Storage bucket (job application uploads)
-- =================================================================
-- Unlike `photos`/`site-media`, the uploader here is always an anonymous
-- public applicant, not an authenticated staff member — there is no
-- session to scope a Storage RLS policy by. Rather than adding an
-- anon-writable INSERT policy (which could only constrain bucket_id, so any
-- visitor could upload directly via the Storage REST API and bypass the
-- honeypot/rate-limit gate entirely), uploads happen exclusively
-- server-side inside submitJobApplication (app/(public)/jobs/actions.ts)
-- via the service-role client, which bypasses RLS/grants altogether. So
-- there is deliberately NO INSERT/UPDATE/DELETE policy for anon OR
-- authenticated — nobody needs one.
--
-- Resumes are PII, so this bucket is private (unlike site-media) and its
-- SELECT is narrower than "any staff" (unlike photos): owner/lead only,
-- matching leads_select (migration 20260804130000_leads.sql), since
-- resumes are always read through the future Leads inbox (9.8), never
-- crew/accountant-facing.
-- =================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  4194304,            -- 4 MB per file
  ARRAY['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "owners and leads can read resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes' AND get_my_role() IN ('owner', 'lead'));
