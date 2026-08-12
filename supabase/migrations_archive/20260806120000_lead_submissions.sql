-- =================================================================
-- Task 9.5 — lead_submissions (per-IP rate-limit ledger for the public
-- inquiry form and, later, 9.6's job-application form)
-- =================================================================
-- One row per attempted public lead submission, keyed by a hashed client IP
-- (see lib/leads/spam.ts's hashIp — HMAC-SHA256, never the raw address).
-- Purely abuse-control bookkeeping, not something owners ever read.
--
-- Deliberately NO grants to anon/authenticated and NO RLS policies. Per the
-- 9.1/9.2 lesson, RLS alone confers nothing — the absence of a GRANT is what
-- makes this table unreachable from the public form's own (anon) connection.
-- All reads/writes go through the service-role client
-- (lib/supabase/service.ts), which bypasses RLS entirely.
-- =================================================================

CREATE TABLE public.lead_submissions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash    text        NOT NULL,
  kind       text        NOT NULL
    CHECK (kind IN ('service_inquiry', 'job_application')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;

-- Backs the rate-limit window query (WHERE ip_hash = $1 AND created_at > $2)
-- and the opportunistic prune (DELETE WHERE created_at < $cutoff).
CREATE INDEX lead_submissions_ip_created_idx
  ON public.lead_submissions (ip_hash, created_at DESC);
CREATE INDEX lead_submissions_created_idx
  ON public.lead_submissions (created_at);

-- No GRANTs at all — service-role only (it bypasses grants and RLS both).
