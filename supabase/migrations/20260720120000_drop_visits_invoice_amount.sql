-- ─────────────────────────────────────────────────────────────────────────────
-- Drop visits.invoice_amount — now redundant.
--
-- It was the per-line price snapshot, but the History tab (its only remaining
-- reader) now derives the per-line amount as invoices.amount / visit count.
-- Every per_visit line is billed at the same price, so that division is exact
-- and still a point-in-time snapshot (invoices.amount is stored at push time,
-- never a live account lookup). The invoice total lives on invoices.amount;
-- there was no need to also carry it per visit.
--
-- (contract invoices never used this column meaningfully — their amount always
-- lived on the invoice row, with tagged visits carrying 0.)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.visits DROP COLUMN invoice_amount;
