# Invoicing

How Rooted Gardens turns completed visits into QuickBooks invoices, and how the three
billing types (`per_visit`, `contract`, `as_needed`) are each handled differently.
See `CLAUDE.md` for the full schema; this doc is about the *billing logic*, not the schema.

## The three billing types

An account's `billing_type` decides how its visits turn into money. It's set once per
account (`accounts.billing_type`) and never mixed within an account.

### `per_visit`
Residential accounts, priced per completed visit (`accounts.price_per_visit`). Every
completed, uninvoiced visit is its own line item. If an account has 3 uninvoiced visits
when the accountant pushes to QuickBooks, the resulting invoice has 3 lines, each at
`price_per_visit`.

### `contract`
Commercial or large properties billed a flat periodic rate (`accounts.contract_rate`,
`accounts.contract_period` — `monthly` or `seasonal`) regardless of how many visits actually
happened that period — including zero. Because billing isn't driven by visit activity,
contract accounts are invoiced **ad hoc from the Billing page's "Contracts" tab**, not
from the Queue (see "Ad-hoc contract invoicing" below) — a visit-completion-driven queue
is the wrong trigger for a flat periodic fee.

### `as_needed`
Quoted per engagement, no stored rate. The app **never** auto-invoices these — pushing an
`as_needed` account's visits fails with an explicit "invoice manually" error. There is no
sensible default price to charge, so this is a deliberate dead end rather than a silent $0
invoice.

## The invoice queue → push flow (`per_visit` only)

1. **Queue** (`/management/billing`, default "Queue" tab): every `completed` visit with
   `invoiced_at IS NULL`, excluding `contract` accounts (see "Ad-hoc contract invoicing"),
   grouped by `(account, completion month)` — the owner invoices monthly, so a push always
   maps to exactly one QBO invoice per account per month, never combining two months. The
   accountant checks/unchecks visits and clicks **Push to QuickBooks**.
2. **Customer sync**: before creating an invoice, the push ensures the account has a QBO
   Customer (`lib/quickbooks/sync.ts`'s `syncCustomer`) — creating one if `qbo_customer_id`
   is still null, or recreating it if QBO reports the stored ID no longer exists.
3. **Invoice creation** (`lib/quickbooks/invoice.ts`'s `pushAccountInvoice`): builds the
   QBO `Invoice` payload — one `Line` per visit for `per_visit`, one flat-rate `Line` for
   `contract` — and creates it via the QuickBooks API.
4. **Local record**: on success, the push inserts one row into the canonical `invoices`
   table (the record of every QBO invoice, for every billing type) and sets each pushed
   visit's `invoice_id` to it. `status` is **never** set to an `'invoiced'` value — it
   stays `'completed'`. Whether a visit has been billed is always the derived flag
   `invoice_id IS NOT NULL`, exactly like the in-progress (`started_at`/`ended_at`)
   convention used elsewhere in the schema. The `invoices` row is inserted **before** the
   visit tagging (the tag points at it), so a failed insert fails the whole push with an
   actionable "created in QBO but couldn't be recorded locally" error.

The push is **per-account, not all-or-nothing across a batch**: if one account's push fails
(missing rate, QBO rejects the invoice, etc.), it doesn't block or roll back any other
account's push in the same batch. Each account gets its own success/failure toast.

## Why one shared QuickBooks "Item," not one per customer

Every QuickBooks invoice line must reference a Product/Service "Item." Rooted Gardens'
accountants have historically hand-created a separate Item per customer in QuickBooks —
purely so a default price auto-fills when they type an invoice manually. This app never
needs that default: every line's dollar amount is always set explicitly from
`price_per_visit` or `contract_rate`. So the push uses **one single shared Item** (named
`"Services"` by default, configurable via `QBO_SERVICE_ITEM_NAME`) for every line, on every
account. It's looked up by name at push time (`getServiceItemId` in
`lib/quickbooks/invoice.ts`) and cached for the life of the process; if it's missing, the
push fails with an actionable error rather than silently auto-creating one (auto-creating
an Item would also require picking an Income account — an accounting decision that belongs
to the accountant, not the app).

## The amount snapshot (`invoices.amount`)

`invoices.amount` records what was actually billed, at the moment it was billed — not a live
lookup of the account's current price. This matters because `price_per_visit`/`contract_rate`
can change later (a client's rate goes up next season), and an old invoice's audit trail
should never silently reflect a rate that didn't exist when it was billed. For per_visit it's
set to `price_per_visit × visit count` at push time; for contract it's the (possibly
overridden) `contract_rate`.

There is no per-line amount stored on the visit. The History tab's expandable per-visit rows
derive each line as `invoices.amount / visit count` — every per_visit line is billed at the
same price, so that's exact and inherits the snapshot (since `invoices.amount` is itself
stored at push time). (An earlier design carried a `visits.invoice_amount` per-line snapshot;
it was dropped once the total-÷-count derivation made it redundant — migration
`20260720120000`.)

## Ad-hoc contract invoicing (`contract`)

Contract accounts are invoiced from the Billing page's **"Contracts" tab**
(`components/management/ContractInvoicing.tsx`), independent of visit activity — it lists
every active contract account, regardless of whether any visits happened, since a period
with zero completed visits still owes the flat rate. The owner picks a period (label + start
+ end date, prefilled to the current calendar month for `contract_period='monthly'`
accounts) and an **amount** — prefilled with the account's standing `contract_rate`, but
freely editable, so a one-off invoice (a discount, a one-time extra charge, etc.) doesn't
require changing the account's rate — then clicks **Create Invoice**.

`createContractInvoice` (`app/management/billing/actions.ts`):
1. Syncs the QBO customer and calls `pushAccountInvoice` with an `amountOverride` (the
   entered amount, not `account.contract_rate`) — `pushAccountInvoice` already builds a
   single flat-rate line for `contract` accounts using `visits.length` only for the line's
   description, so it works correctly with an empty `visits` array regardless of amount.
2. Inserts one row into **`invoices`** with the `period_label`, `period_start`/`period_end`,
   `amount`, and `billing_type='contract'` — this row, not `visits`, is the **authoritative
   record** of the contract invoice, since a zero-visit period has nothing on `visits` to
   hold the amount.
3. Any completed visits that do fall within the period are still tagged (`invoice_id`) for
   cosmetic/audit consistency (e.g. so a visit's detail view shows "invoiced" instead of
   looking perpetually outstanding) — but their `invoice_amount` is set to **`0`**, not the
   flat rate, since the real amount lives on the `invoices` row. Duplicating it onto a visit
   too would risk double-counting revenue if anything ever summed `visits.invoice_amount`
   directly.

## The History tab (audit trail)

The Billing page's "History" tab (formerly "Invoiced") is **invoices-primary**: it reads
the `invoices` table directly (`getInvoicesForRange`), one row per QBO invoice, sorted by
`created_at` (the invoiced/pushed moment), filtered by a date-range picker
(`lib/utils/billing.ts`'s `resolveDateRange` — presets: this month, last month, last 7
days, this year, or a custom range) and a searchable account combobox. Each row shows the
account, invoiced date, QBO link, a **status badge** (draft/sent/paid/overdue — see below),
and the invoice total:

- **`per_visit` invoices** — collapsible; the caret expands the individual billed visits
  (embedded via `invoices → visits`), each showing its address and `invoice_amount` snapshot.
- **Contract invoices** — show the `period_label`; not expandable, since a contract invoice
  isn't visit-driven.

Every row links out to `https://app.qbo.intuit.com/app/invoice?txnId={qbo_invoice_id}`.

A **"Refresh now"** button pulls current QBO status for the visible invoices on demand
(`refreshInvoiceStatuses`), so the accountant can confirm an invoice went out right after
sending it from inside QBO — the daily cron does the same unattended.

The date-range filter only scopes this list — it's independent of the revenue summary
below, which is always MTD/YTD regardless of what range is selected.

A "This month" / "This year" revenue summary sits above the list, split into per-visit vs.
contract totals. It reads the `invoices` table directly (`getRevenueSummary`) and buckets by
`billing_type` — `amount` is always the single invoice total, so there's no double-counting
to guard against (unlike the old split between `visits.invoice_amount` and a separate
contract ledger).

## Invoice lifecycle status (the one narrow QBO read-path)

`invoices.status` (`draft | sent | paid | overdue`) tracks what QuickBooks itself reports has
happened to an invoice since it was pushed — this is what "invoiced" *really* means to the
owners (QBO has **sent** it to the customer), as opposed to merely having been pushed.

- **How it's synced** — a daily Vercel Cron (`app/api/cron/sync-invoice-status`, authed by
  `CRON_SECRET`) plus the manual **"Refresh now"** button both call `getInvoice` per invoice
  and derive status via `deriveInvoiceStatus` (`lib/quickbooks/invoiceStatus.ts`):
  `Balance == 0 → paid`; `EmailSent && Balance > 0 && past DueDate → overdue`;
  `EmailSent && Balance > 0 → sent`; else `draft`. Vercel's Hobby plan caps cron at once
  daily, so the manual button covers the "just sent it, confirm now" case.
- **Set-once timestamps** — `sent_at` / `paid_at` are stamped the first time the invoice
  reaches that state and never overwritten.
- **Known gaps** (intentional, not bugs):
  - `EmailStatus` only reflects invoices sent through QBO's own send flow — one sent by
    other means (printed/mailed, emailed outside QBO) never reads `sent` here.
  - No `partially_paid` state — a partial payment leaves `Balance > 0`, so it stays
    `sent`/`overdue` with `qbo_balance < amount`.
  - No `voided` detection — a voided QBO invoice also reports `Balance: 0`, so it reads as
    `paid`.
  - Invoices that predate the `invoices` table (backfilled by migration `20260714120000`)
    start as `draft` and self-correct on the next cron/refresh, since the backfill can't
    know their real current QBO status.

## Things this app deliberately does not do

- **Pull anything from QuickBooks beyond invoice status.** Sync is one-way, app → QBO, with
  the single exception above (status only — never customer data, payment details, or edits
  made in QuickBooks, and nothing read back feeds into invoice creation or pricing).
- **Render its own invoice UI.** QuickBooks is the system of record for how an invoice
  actually looks to the client; this app only pushes the data and links out to it.
- **Auto-invoice `as_needed` accounts**, or auto-create a missing QBO Item/Income account —
  both are judgment calls left to the accountant.
