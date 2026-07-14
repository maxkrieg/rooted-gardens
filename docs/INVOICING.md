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
4. **Local record**: on success, the pushed visits get `invoiced_at = now()` and
   `qbo_invoice_id` set. `status` is **never** set to an `'invoiced'` value — it stays
   `'completed'`. Whether a visit has been billed is always the derived flag
   `invoiced_at IS NOT NULL`, exactly like the in-progress (`started_at`/`ended_at`)
   convention used elsewhere in the schema.

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

## The `invoice_amount` snapshot (`per_visit`)

`visits.invoice_amount` records what was actually billed, at the moment it was billed — not
a live lookup of the account's current price. This matters because `price_per_visit` can
change later (a client's rate goes up next season), and an old invoice's audit trail should
never silently reflect a rate that didn't exist when it was billed. Each visit's
`invoice_amount` is set to that account's `price_per_visit` at push time — one visit, one
line, one price.

(Historical note: before ad-hoc contract invoicing existed, a contract push set the full
`contract_rate` on one visit in the batch and `0` on the rest, so `SUM(invoice_amount)`
stayed correct without a dedicated ledger table. That data still exists for old contract
pushes and is still counted in revenue reporting — see below — but new contract invoices no
longer work this way.)

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
2. Inserts one row into **`contract_invoices`** (`account_id`, `period_label`,
   `period_start`/`period_end`, `amount`, `qbo_invoice_id`, `invoiced_at`) — this table, not
   `visits`, is the **authoritative record** of every contract invoice going forward, since
   a zero-visit period has nothing on `visits` to hold the amount.
3. Any completed visits that do fall within the period are still tagged
   (`invoiced_at`/`qbo_invoice_id`) for cosmetic/audit consistency (e.g. so a visit's detail
   view shows "invoiced" instead of looking perpetually outstanding) — but their
   `invoice_amount` is set to **`0`**, not the flat rate, since the real amount now lives on
   `contract_invoices`. Duplicating it onto a visit too would risk double-counting revenue
   if anything ever summed `visits.invoice_amount` directly.

## The History tab (audit trail)

The Billing page's "History" tab (formerly "Invoiced") merges two sources into one
chronological list, sorted by invoiced date, filtered by a date-range picker
(`lib/utils/billing.ts`'s `resolveDateRange` — presets: this month, last month, last 7
days, this year, or a custom range) and a searchable account combobox:

- **`per_visit` invoices** — visits where `invoiced_at IS NOT NULL`, grouped by **QBO
  invoice** (`qbo_invoice_id`), not by account — an account can be pushed more than once in
  the same month (e.g. a late straggler visit), and those are kept as visibly distinct
  invoices rather than merged. Collapsed by default with a "N visits" caret to expand the
  individual lines; the amount is always the `invoice_amount` snapshot, never a live price.
- **Contract invoices** — read directly from `contract_invoices`, one row per invoice
  (account, period label, invoiced date, QBO link, flat amount). No per-visit breakdown to
  expand, since a contract invoice isn't visit-driven.

Both link out to `https://app.qbo.intuit.com/app/invoice?txnId={qbo_invoice_id}`.

The date-range filter only scopes this list — it's independent of the revenue summary
below, which is always MTD/YTD regardless of what range is selected.

A "This month" / "This year" revenue summary sits above the list, split into per-visit vs.
contract totals. The contract bucket sums **both** `contract_invoices.amount` (every
invoice created via the Contracts tab) **and** any historical `visits.invoice_amount` tagged
before that feature existed — no double-counting, since new contract visits are always
tagged `0` (see above), so they never contribute a second time.

## Things this app deliberately does not do

- **Pull anything from QuickBooks.** Sync is one-way, app → QBO, always. The app never reads
  invoice status, payment status, or edits made directly in QuickBooks.
- **Render its own invoice UI.** QuickBooks is the system of record for how an invoice
  actually looks to the client; this app only pushes the data and links out to it.
- **Auto-invoice `as_needed` accounts**, or auto-create a missing QBO Item/Income account —
  both are judgment calls left to the accountant.
