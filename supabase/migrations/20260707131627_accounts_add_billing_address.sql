-- Structured billing/mailing address for invoicing — separate from properties.address
-- (the serviced location), since an account's bill-to address may differ (e.g. an HOA
-- billed at an office address but serviced at several properties). Structured (not a
-- single text blob, unlike properties.address/leads.address) so it maps cleanly onto
-- QBO's own structured BillAddr fields for correctly formatted invoices.
ALTER TABLE public.accounts
  ADD COLUMN billing_address_line1 text,
  ADD COLUMN billing_address_line2 text,
  ADD COLUMN billing_city text,
  ADD COLUMN billing_state text,
  ADD COLUMN billing_zip text;
