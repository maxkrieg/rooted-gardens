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
happened that period. However many completed, uninvoiced visits exist when pushed, they
collapse into **one invoice line** at the flat rate — visit count doesn't change the price.

### `as_needed`
Quoted per engagement, no stored rate. The app **never** auto-invoices these — pushing an
`as_needed` account's visits fails with an explicit "invoice manually" error. There is no
sensible default price to charge, so this is a deliberate dead end rather than a silent $0
invoice.

## The invoice queue → push flow

1. **Queue** (`/management/billing`, default "Queue" tab): every `completed` visit with
   `invoiced_at IS NULL`, grouped by account. `per_visit` accounts show one selectable row
   per visit; `contract` accounts show one summary row for the whole group. The accountant
   checks/unchecks visits and clicks **Push to QuickBooks**.
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

## The `invoice_amount` snapshot

`visits.invoice_amount` records what was actually billed, at the moment it was billed — not
a live lookup of the account's current price. This matters because `price_per_visit` and
`contract_rate` can change later (a client's rate goes up next season), and an old invoice's
audit trail should never silently reflect a rate that didn't exist when it was billed.

- **`per_visit`**: each visit's `invoice_amount` is set to that account's `price_per_visit`
  at push time. Simple — one visit, one line, one price.
- **`contract`**: this is the one non-obvious part. A contract invoice is *one flat rate for
  a whole batch of visits* — there's no natural "per-visit price" to snapshot on each row.
  Storing the full `contract_rate` on *every* visit in the batch would make any later
  `SUM(invoice_amount)` overcount revenue by the visit count. Instead: **the batch's first
  visit gets `invoice_amount = contract_rate`; every other visit in that same push gets
  `0`.** This keeps `SUM(invoice_amount)` correct everywhere — the invoiced-visits view, the
  revenue summary — with no billing-type special-casing required downstream. `per_visit`
  rows are already individually correct, so both billing types end up summable the same way.

## The invoiced view (audit trail)

The Billing page's "Invoiced" tab lists visits where `invoiced_at IS NOT NULL`, grouped by
**QBO invoice** (`qbo_invoice_id`), not by account — an account can be pushed more than once
in the same month (e.g. a second contract cycle, or a late per-visit stragler), and those are
kept as visibly distinct invoices rather than merged together. Each group shows:

- the account and its billing type,
- the date it was invoiced,
- a link straight to the invoice in QuickBooks (`https://app.qbo.intuit.com/app/invoice?txnId={qbo_invoice_id}`),
- the amount — always the `invoice_amount` snapshot, never a live price lookup.

A "This month" / "This year" revenue summary sits above the list, split into per-visit vs.
contract totals. Because of the snapshot convention above, these totals are a plain
`SUM(invoice_amount)` with no per-billing-type branching.

## Things this app deliberately does not do

- **Pull anything from QuickBooks.** Sync is one-way, app → QBO, always. The app never reads
  invoice status, payment status, or edits made directly in QuickBooks.
- **Render its own invoice UI.** QuickBooks is the system of record for how an invoice
  actually looks to the client; this app only pushes the data and links out to it.
- **Auto-invoice `as_needed` accounts**, or auto-create a missing QBO Item/Income account —
  both are judgment calls left to the accountant.
