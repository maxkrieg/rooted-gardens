-- Ad-hoc contract invoicing: contract accounts are billed a flat rate per period
-- regardless of visit count/activity, so — unlike per_visit invoices — the amount
-- can't live on visits.invoice_amount alone (a period can have zero completed
-- visits and still owe the flat rate). This table is the authoritative record of
-- every contract invoice created via the Billing → Contracts tab. Visits that fall
-- within the invoiced period are still tagged (invoiced_at/qbo_invoice_id) for
-- audit-trail/UI consistency, but their invoice_amount stays 0 — the real amount
-- lives here, never duplicated onto a visit row.
CREATE TABLE public.contract_invoices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL REFERENCES public.accounts(id),
  period_label    text        NOT NULL,
  period_start    date        NOT NULL,
  period_end      date        NOT NULL,
  amount          numeric(8,2) NOT NULL,
  qbo_invoice_id  text        NOT NULL,
  invoiced_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_contract_invoices_updated_at
  BEFORE UPDATE ON public.contract_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY contract_invoices_select
  ON public.contract_invoices
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'accountant'));

CREATE POLICY contract_invoices_insert
  ON public.contract_invoices
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));
