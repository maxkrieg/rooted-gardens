-- Soft delete ("archive") for accounts and properties.
--
-- The owners need a way to remove an account or a property from the app, but a hard
-- DELETE is not available: seven FKs point at these two tables and only two of them
-- cascade (properties.account_id, property_route_groups.property_id). visits, invoices,
-- photos and leads.converted_account_id are all NO ACTION, so a real delete would either
-- be rejected by Postgres or would take billing history with it.
--
-- Archiving keeps the row — so a historical visit or invoice still renders its account
-- name and property address — while the app filters archived rows out of every live list,
-- picker, count and schedule. Archiving an account also archives its properties.
--
-- Deliberately a separate column rather than a new accounts.status value: status
-- (active|inactive|prospective) is a sales/lifecycle axis and is orthogonal to this one
-- (a prospective account can be archived). Folding them together would overwrite the
-- prior status, and would surface "archived" in the Edit Account form's status dropdown
-- as an unguarded second archive path that skips the cascade to properties.
ALTER TABLE public.accounts
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.properties
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- The account list filters is_archived and orders by name; property lists filter and
-- group by account. Partial indexes keep those scans off the archived rows.
CREATE INDEX IF NOT EXISTS accounts_active_idx
  ON public.accounts (name) WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS properties_active_account_idx
  ON public.properties (account_id) WHERE is_archived = false;

-- ─── Accountant column guard ────────────────────────────────────────────────────
-- This trigger restricts the accountant role to updating accounts.qbo_customer_id by
-- listing every column they may NOT change. A new column absent from that list is
-- silently writable by accountants, so is_archived has to be added to it.
CREATE OR REPLACE FUNCTION public.enforce_accountant_account_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF get_my_role() = 'accountant' THEN
    IF (
      NEW.name            IS DISTINCT FROM OLD.name            OR
      NEW.contact_name    IS DISTINCT FROM OLD.contact_name    OR
      NEW.email           IS DISTINCT FROM OLD.email           OR
      NEW.phone           IS DISTINCT FROM OLD.phone           OR
      NEW.billing_type    IS DISTINCT FROM OLD.billing_type    OR
      NEW.price_per_visit IS DISTINCT FROM OLD.price_per_visit OR
      NEW.contract_rate   IS DISTINCT FROM OLD.contract_rate   OR
      NEW.contract_period IS DISTINCT FROM OLD.contract_period OR
      NEW.status          IS DISTINCT FROM OLD.status          OR
      NEW.is_archived     IS DISTINCT FROM OLD.is_archived     OR
      NEW.notes           IS DISTINCT FROM OLD.notes
    ) THEN
      RAISE EXCEPTION
        'accountant role may only update accounts.qbo_customer_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Owner-only archiving ───────────────────────────────────────────────────────
-- accounts_update grants owner/lead/accountant and properties_update grants owner/lead,
-- but archiving is destructive and has no restore UI, so it is owner-only — narrower
-- than plain editing. RLS cannot gate a single column, so this follows the same
-- SECURITY DEFINER BEFORE UPDATE guard idiom as enforce_accountant_account_columns above.
--
-- Raises P0001, which lib/errors.ts already maps to "That change isn't allowed for your
-- role." For the service client get_my_role() is NULL, so the AND evaluates to NULL, the
-- branch is not taken, and service-role writes are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_owner_only_archive() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.is_archived IS DISTINCT FROM OLD.is_archived
     AND get_my_role() <> 'owner' THEN
    RAISE EXCEPTION
      'only the owner role may archive or restore this record';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_owner_only_archive ON public.accounts;
CREATE TRIGGER enforce_owner_only_archive
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_only_archive();

DROP TRIGGER IF EXISTS enforce_owner_only_archive ON public.properties;
CREATE TRIGGER enforce_owner_only_archive
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_only_archive();
