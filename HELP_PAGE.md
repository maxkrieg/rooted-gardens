# HELP_PAGE.md — The in-app guide (`/app/help`)

A persistent reference page: how features work, what each setting really does, and every
side effect a person wouldn't guess. See `CLAUDE.md` for stack, schema and conventions. It is
the source of truth wherever this file is silent.

> **Status:** planned 2026-10-15. H0 (this doc) done 2026-10-15.
> H1 done 2026-10-17 (the trio + `check:tours` pass; the in-app checks under Verify are still to run).
> H2 done 2026-10-17 (the trio + `check:tours` pass; the read-through by role is still to run).
> H3 done 2026-10-17 (the trio + `check:tours` pass; the accountant read-through is still to run).
>
> - [x] **H0**: plan, information architecture, rule inventory (this file)
> - [x] **H1**: scaffolding: the page, the data model, absorb the Help & tours sheet
> - [x] **H2**: content: schedule, planning, routes, stops, offline
> - [x] **H3**: content: accounts, billing, leads, team, audit/reports/fleet, FAQ
> - [ ] **H4**: wiring outward: "How this works" links, ⌘K, the help-key check
>
> **One Claude Code session per phase.** Prompt: *"Implement phase H<n> of HELP_PAGE.md.
> Fill in its As-built section and tick its box when done."* Read **Shared rules** first.
>
> **Decide first:** the **Possible bugs** block below. Several inventory items describe
> behavior that is probably wrong. Fix those (separately) or consciously accept them before
> H2/H3 writes them up as rules. Item **B0** is urgent regardless of this plan.

---

## Why

The app encodes a lot of rules nobody can see. Some examples:
- A route's days never move a stop.
- A skip makes a property due again at once.
- "Monthly" means every 28 days.
- Pushing an invoice makes a QuickBooks *draft* that the customer never receives.
- Raising a per-visit price re-prices last month's unbilled work.
- "Inactive" doesn't stop scheduling.

Today the only help is the **Help & tours** sheet (`components/onboarding/HelpSheet.tsx`). It
holds tours, a checklist and What's new: about what's *new*, not a reference to come back to.
The owners want a page they can return to whenever they forget how something works.

## Decisions (user, 2026-10-15)

- **The page absorbs the sheet.** Tours, Getting started and What's new become a strip at the
  top of `/app/help`. The sheet is deleted, and every "Help & tours" entry point opens the page.
- **All four roles** can open it. Each section and topic is **tagged by role** and filtered:
  - crew see the field topics
  - the accountant sees billing and the read-only parts
  - owners see everything
- **A handful of "How this works" links** go from the most confusing screens into specific
  topics. **Help topics are searchable in ⌘K.**
- **Content is typed TS data, not MDX.** There is no markdown stack in the app, and
  `lib/onboarding/registry.ts` already sets the "content as data" pattern. Bundled in JS, the
  page works offline after one visit. The service worker caches `/app/*` documents NetworkFirst
  and doesn't precache them (`app/sw.ts:19-41`).

### Ruled out
- **MDX / react-markdown:** a new dependency and build path for ~80 short topics.
- **Content in Supabase:** owner-editable, but it would need a CMS screen and wouldn't be
  offline-first. The public site's `site_content` is a different audience.
- **Keeping the sheet alongside the page:** two places to look, and they'd drift apart.

## The model

```ts
// lib/help/topics.ts — no React, no Supabase (⌘K and the check script import it)
type HelpRole = 'owner' | 'lead' | 'crew' | 'accountant'
type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'headsUp'; text: string }   // a hidden side effect: rendered as a clay callout
  | { kind: 'example'; text: string }
interface HelpSection { key: string; title: string; icon: LucideName; roles: HelpRole[] }
interface HelpTopic {
  key: string              // URL hash: /app/help#generate-week
  section: string
  title: string
  summary: string          // one line: the collapsed row and the ⌘K item
  roles?: HelpRole[]       // defaults to the section's roles
  where?: string           // "Routes → route card → Set crew, truck and days"
  body: HelpBlock[]
  related?: string[]       // topic keys
  tour?: string            // a TOURS key → "Show me" button
}
```

Text supports `**bold**` only, via a tiny inline renderer. No links inside text; use
`related` for those.

### Phone: `/app/help`
```
┌──────────────────────────────────────┐
│ Help                                 │
│ ┌──────────────────────────────────┐ │
│ │ 🔍 Search help                   │ │
│ └──────────────────────────────────┘ │
│ Tours  ▸ Schedule · Routes · Accounts│  strip (owner/lead only; others see What's new)
│ Getting started   3 of 6        ›    │
│ What's new   • 2 new            ›    │
│                                      │
│ [Start here][Schedule][Routes][Stops]│  section chips (scroll-x, not a table)
│                                      │
│ PLANNING A WEEK                      │
│ ▸ What Generate week puts on         │
│ ▾ Route days don't move stops        │
│   A route's days label the plan…     │
│   ⚠ Heads up: …                      │
│   Where: Routes → card → defaults    │
│   Related: Plan tomorrow · Day lanes │
│   [Show me]          [Copy link]     │
└──────────────────────────────────────┘
```
From `lg` up: a sticky section index on the left, with the content column at `max-w-3xl`. No
new breakpoint.

---

## Shared rules: every phase

Read `CLAUDE.md` → **Data Architecture → Rules that bite** and **Onboarding** first. The rules
that apply here:

- **Help must never claim behavior the code doesn't have.** Re-verify every rule against the
  code as you write it. The inventory's file:line refs were accurate on 2026-10-15 but drift.
  If code and inventory disagree, the code wins: write the code's behavior and note the
  difference in As-built.
- **Field route = client-first.** `/app/help` is a thin RSC shell plus a client view. It is
  static, so there's no React Query and nothing goes in `PERSISTED_QUERY_KEYS`. No
  `router.refresh()`.
- **Access:** `ROUTE_ACCESS` in `lib/auth/access.ts` must stay dependency-free (Edge). An
  unlisted path denies.
- **Breakpoints:** `lg` only. Phone-first, ≥44px tap targets, no tables.
- **Onboarding:** keep tour anchors matching. `npm run check:tours` must pass. A changed tour
  *flow* bumps that tour's `version`; anything users should notice gets a `NEWS` item.
- **Voice:** plain, short, second person, owner's words ("stop", "route", "the week"), not
  schema words (`visit_crew`, `planned_date`). Name the on-screen label exactly as the UI
  shows it. One idea per topic. A side effect goes in a `headsUp` block.
- **Errors:** `toUserMessage` / `reportError`. **Comments:** 2–3 lines max.
- **Check trio (+1):** `npm run build` · `npm run typecheck` · `npm run lint` · `npm run check:tours`.

---

## H1: Scaffolding (the page, the model, absorb the sheet)

**Goal:** `/app/help` exists for all four roles with 3 sample topics and the top strip. Every
Help & tours entry point opens it, and the sheet is gone.

**Read first:**
- `components/onboarding/HelpSheet.tsx`
- `components/onboarding/OnboardingProvider.tsx`: `openHelp` (~L216), `dueNewsCount`,
  `startTour`, `showNews`, `showWelcome`
- `components/onboarding/GettingStartedCard.tsx` (`ChecklistItems`)
- `lib/onboarding/registry.ts`: `tour.schedule` steps `help-mobile` / `help-desktop`
  (~L258-270), `NEWS`
- `components/app/AppShell.tsx`: desktop Help button ~L221-237, `MoreSheet` props ~L318
- `components/app/MoreSheet.tsx` ~L146-165
- `lib/auth/access.ts`, `components/app/nav-items.ts`
- `app/app/(padded)/routes/page.tsx` + `loading.tsx` (the shell pattern)
- `app/(public)/faq/page.tsx` (the Accordion pattern), `components/ui/accordion.tsx`
- `components/app/RoleProvider.tsx` (`useRole`)

**Build:**
1. `lib/help/topics.ts`: the types above, `HELP_SECTIONS` (all 12 from the IA below, in
   order) and 3 sample topics (`week-is-the-unit`, `route-days-dont-move-stops`,
   `invoiced-is-not-sent`). Also add `helpFor(role)`, which filters sections and topics, and
   `findHelpTopic(key)`.
2. `app/app/(padded)/help/page.tsx` (thin shell) + `loading.tsx` (reuse `components/states/skeletons`).
3. `components/help/HelpView.tsx` (client):
   - A search input that filters by title, summary and body text, case-insensitive.
   - Section chips that scroll to the section.
   - One `Accordion type="multiple"` per section.
   - On mount and on `hashchange`, open and scroll to `#key`.
   - Expanding a topic writes its hash with `history.replaceState`.
   - "Copy link" uses `navigator.clipboard`.
   - "Show me" calls `startTour`.
   - An empty search shows the botanical `EmptyState`.
4. `components/help/HelpTopicBody.tsx`: renders `HelpBlock[]` (the `headsUp` callout uses the
   `--clay` tint) and handles `**bold**`.
5. Top strip: move the Tours list, Getting started (`ChecklistItems`), What's new and "Show the
   welcome again" out of `HelpSheet.tsx` into `components/help/HelpOnboardingStrip.tsx`. Keep
   the existing behavior and status pills. Roles without tours see only What's new.
6. Access and nav:
   - `ROUTE_ACCESS += { prefix: '/app/help', roles: all four }`.
   - Add a `NAV_ITEMS` "Help" entry (`CircleHelp`) that is in no role's `BAR_BY_ROLE`. It lands
     in More on phone and in the sidebar on desktop.
   - **Replace** the two existing Help & tours buttons with this item rather than adding a
     second one. Keep `data-tour="nav.help"` on the desktop item and the `dueNewsCount` dot or
     "New" pill.
7. `openHelp` → `router.push('/app/help')`. Delete `HelpSheet.tsx` and its mount. Update the
   copy of the `help-mobile` / `help-desktop` tour steps to say "Help" (copy-only, no version
   bump).
8. `NEWS` item `news.helpGuide`: "A Help guide you can come back to". No `parentTour`. It
   points at the nav item.

**Don't:**
- Write real content yet (beyond the 3 samples).
- Add a third breakpoint.
- Leave a dead `helpOpen` state behind.

**Verify:**
- The trio plus `check:tours` pass.
- As each role (via `/admin/impersonate`), Help opens from More (phone) and the sidebar
  (desktop), and the role filter hides other roles' sections.
- `/app/help#route-days-dont-move-stops` opens and scrolls to that topic.
- The NEWS dot still shows on the nav item.
- `npm run build && npm start`: visit Help, go offline, reload, and the page renders.

**As built — deviations:**
- **No `NAV_ITEMS` entry.** It would have put Help in the sidebar's main list *and* kept the
  footer button, giving two entries. Instead the existing entries became links to `/app/help`:
  the sidebar footer button (still `data-tour="nav.help"`, ochre dot) and the More row ("New"
  pill). Both label it "Help" and show as active on the page. `ROUTE_ACCESS` lists `/app/help`
  for all four roles.
- **`openHelp` is removed from the onboarding context**, not repointed: nothing called it once
  the entries became links. `hasWelcome` was added so the strip shows "Show the welcome again"
  only to roles that have a welcome (owner/lead today).
- **The strip is an accordion** of Tours / Getting started (`n of m done`) / What's new
  (`n new`), not three always-open lists, so the guide stays near the top on a phone. What's
  new opens by default when something is due, and it lists newest first (the sheet listed
  oldest first).
- Icons in `lib/help/topics.ts` are string keys (`HelpIcon`), mapped to lucide components in
  `HelpView`, so the data file stays React-free.
- **Section roles:** Schedule, Team & roles, and FAQ are open to every role; their topics
  narrow with `topic.roles` (H2/H3). `helpFor` drops sections with no visible topics, so crew
  see only Start here today.
- Hash handling: `#key` opens and scrolls on the first frame after mount (server HTML has
  everything closed, so opening during render would mismatch hydration) and on every
  `hashchange`. Opening a topic writes its hash with `replaceState`. Related links are plain
  `#key` anchors, filtered to topics the role can see.
- The `help-mobile`/`help-desktop` tour step copy now says "Help" (copy only, no bump).
  NEWS `news.helpGuide` (all roles, 2026-10-17, no anchor) announces the page.
- CLAUDE.md: the Onboarding section points to the Help page and states the rule that a changed
  rule updates its topic in the same change. The repo map lists `help/page.tsx`.
- Not done: the in-app Verify checks (role filtering via impersonation, deep link, offline
  reload on a prod build). Per the standing preference, they weren't run in the browser.


---

## H2: Content (schedule, planning, routes, stops, offline)

**Goal:** sections 1–5 and 10 of the IA are fully written, re-verified against code.

**Read first:** Inventory parts **A–I** (below), `lib/utils/schedule.ts`,
`lib/utils/cadence.ts`, `hooks/useGenerateWeek.ts`, `components/management/RouteDefaultsSheet.tsx`,
`PlanDaySheet.tsx`, `ScheduleListMobile.tsx`, `VisitDetailContent.tsx`,
`components/crew/VisitLogger.tsx`, `SkipSheet.tsx`, `lib/offline/mutation-queue.ts`,
and the welcome slides (`registry.ts` ~L88-103) for "Start here".

**Build:**
1. For each inventory item, confirm it in code, then write it as a topic or fold it into one.
   Aim for 40–55 topics in all, not one per item.
2. Each topic gets:
   - `where` (the exact UI labels from the "Where each setting lives" table)
   - `related`
   - `tour` where a tour covers it
3. Tag `roles` carefully. Crew get: Start here, Doing the work, Offline, and read-only notes on
   the schedule (they see Week and route views, and can't plan days or Generate).
4. Leave out anything in **Possible bugs** that hasn't been resolved. Note the omission in
   As-built.

**Don't:** document internals (table names, React Query, RLS wording). Say "needs a
connection", not "online-only mutation".

**Verify:**
- The trio passes.
- Read the page as crew and as owner on a phone width: no topic references a control that
  role can't see.

**As built — deviations:**
- **49 topics** in `lib/help/topics.ts`: 48 new for sections 1–5 and 10, plus the billing
  sample kept for H3. Owner/lead see 47, crew 21, accountant 18. Every `related` and `tour`
  key resolves (checked with a throwaway script; H4 makes that part of `check:tours`).
- **Role tags.** New `FIELD` (owner/lead/crew) covers stop work: the accountant can't open
  `/app/stop`. Today topics (`today-vs-week`, `needs-you`, `running-today`, `from-the-field`)
  are owner/lead/accountant, since `seeDashboard` includes the accountant. Crew-only:
  `crew-week`, `fixing-the-plan-on-site`. Routes topics that describe editing (defaults,
  drive order, unrouted, delete, one route per property) are `OFFICE`. That leaves the
  accountant `what-a-route-is` in Routes. `route-days-dont-move-stops` moved to `OFFICE` too,
  because it names Select stops and Plan tomorrow.
- **Offline split.** `what-works-offline` (FIELD) lists only stop work. Office planning
  offline vs. needs-a-connection is one OFFICE topic, `what-needs-a-connection` ("Planning
  with no signal"), so crew never read about controls they don't have.
- **Code vs inventory (the code won):**
  - Unrouted properties are **not** left out of Generate. They're candidates under "Not on a
    route" with no defaults. The Routes tour's `unrouted` step and the Unrouted panel's
    caption said otherwise; both copy lines are fixed (copy only, no tour bump).
  - #74: stops added on another device show up live **for the current week**.
    `useCrewRealtimeSync` invalidates on any `visits` change that week. Only other weeks need
    a reload.
  - #59: Log Completion now requires a Start time. With no Start tap, it pre-fills the same as
    End, so time on site is 0 unless edited. That's the old "0 minutes", reached differently.
  - The board has no global **S** key. S schedules the focused unscheduled row in the route
    list, so it's documented in `taking-a-stop-off` (OFFICE), not `desktop-board`.
  - Reverting to Scheduled keeps the services and note, and Log Completion pre-fills them on
    the next finish (`initialServiceTypes`/`initialCompletionNote`).
- **Left out pending Possible bugs** (none resolved yet, so none are written as rules):
  - B1: skip/due is stated only for "a stop skipped before anyone started it".
  - B2: no claim about bulk Skip on an on-site stop.
  - B3: nothing about what re-saving a completion does to its date.
  - B4: no claim about where a newly routed property lands in drive order.
  - B5: no mention of generating past or overlapping weeks.
  - B6: no mention of account status in Generate.
  - B7: As needed is described only by its preview reason ("schedule by hand"), with no
    interval interplay.
  - B15: no route-rename or sort-order topic.
  - B16: no claim about inactive crew or retired trucks in defaults.
- Not done: the Verify read-through by role at phone width (per the standing preference, no
  browser run).

---

## H3: Content (accounts, billing, leads, team, audit/reports/fleet, FAQ)

**Goal:** sections 6–9, 11 and the FAQ are written, re-verified against code.

**Read first:** Inventory parts **J–P**, `lib/validators/account.ts`,
`app/management/billing/actions.ts`, `lib/quickbooks/invoiceStatus.ts`,
`lib/quickbooks/sync.ts`, `lib/utils/leads.ts`, `lib/auth/access.ts`,
`app/management/reports/actions.ts`, `supabase/migrations/20260930120000_audit_log.sql`.

**Build:**
1. The same process as H2.
2. Billing topics are tagged `accountant` as well as owner/lead.
3. Team & roles is owner-only, except "What can each role do?", which every role can read.
4. FAQ: about 20 questions phrased the way the owners would ask them. Each answer is 1–3
   sentences plus `related` to the full topic. Starter list:
   - Why didn't this property show up when I generated the week?
   - I set the route to Mon/Wed. Why is the stop still on Friday?
   - Why is a property overdue right after we skipped it?
   - Why is a brand-new biweekly property due every week?
   - I changed the route's regular crew. Why didn't this week change?
   - How do I take a stop off the schedule?
   - Who gets credit for a visit, assigned or on site?
   - Crew logged it with no signal. Why does the time look off?
   - What happens to "Changes that didn't save"?
   - The customer says they never got the invoice.
   - I raised a price. What happens to last month's visits?
   - What's the difference between Inactive and Delete?
   - I deleted an account by mistake.
   - Why can't a lead see the delete button?
   - Why does QuickBooks say Paid for a voided invoice?
   - I pushed an invoice and got "created in QuickBooks but couldn't be recorded".
   - I changed someone's role. Why does their menu look the same?
   - Does the app text crew? (No. SMS is postponed.)
   - Why does the unrouted badge count a property on an inactive account?
   - What does "WEEKLY · 74D" on a property mean?

**Verify:**
- The trio passes.
- Read as the accountant: billing makes sense, and nothing references planning controls.

**As built — deviations:**
- **98 topics** now: H3 adds 29 for sections 6–9 and 11, plus 20 FAQ entries. It also gave
  the H2 billing sample its `related` links. Owner sees 96, lead 91, accountant 43, crew 24.
  All `related`/`tour` keys resolve (throwaway script; H4 makes it part of `check:tours`).
  The H4 link keys `billing-types`, `billing-queue` and `invoice-status` exist.
- **"What can each role do?"** stays as `what-your-role-can-do` in Start here, which every
  role sees. It wasn't moved into Team & roles. The Team topics (`inviting-someone`,
  `role-changes`, `team-fields`) and the FAQ on role menus are owner-only.
- **FAQ shape:** the summary is the first sentence of the answer, because HelpView always
  shows the summary under the title. The body holds the rest.
- **Labels:** `where` uses the nav labels ("Leads", "Reports", "Fleet", "Activity log"), not
  "More → …", since desk users mostly reach them from the sidebar. The queue's main button is
  **Push N accounts to QuickBooks**; **Create invoice · $X** is the per-account drawer's.
- **Code vs inventory (the code won):**
  - #112: only bot signals (honeypot, too fast) are dropped silently. Over the rate limit, the
    form tells the sender to wait. `spam` says so.
  - #121: logging maintenance sets last-serviced only for **equipment**; vehicles have no such
    field.
  - #119: invoice status changes are logged (only balance, due date, email status and
    sent/paid stamps are ignored). Cron runs show as System.
  - #105: the cron is `0 9 * * *` UTC, written as "about 5 a.m. (4 a.m. in winter)".
- **Left out pending Possible bugs:**
  - B6: `account-status` and the Inactive-vs-Delete FAQ list only what status *does* change
    (Contracts tab, adherence report). They make no claim about scheduling.
  - B8: no topic says what happens on a double push from two tabs.
  - B9: no claim about how a first link finds or creates a QuickBooks customer, or what a
    stale link does.
  - B10: the Activity log topic doesn't list what employee changes show.
  - B11: `team-fields` says only that Active off hides someone from pickers, and says nothing
    about sign-in.
  - B12: `fleet` is `OFFICE`, so the accountant isn't pointed at a page that shows them
    nothing.
  - B13: no claim that contract invoices tag the period's visits.
  - B14: `connecting-quickbooks` says the push buttons are off "until connected", with no
    claim about an expired connection.
- Not done: the Verify read-through as the accountant (no browser run, per the standing
  preference).

---

## H4: Wiring outward

**Goal:** people reach the right topic from where they're confused.

**Read first:** `components/management/CommandPalette.tsx`, `AppShell.tsx` (`canSearch`
~L102, ⌘K listener ~L114), `scripts/check-tour-anchors.mjs`, `components/ui/button.tsx`
(the `pointer-coarse:size-11` note in CLAUDE.md).

**Build:**
1. `components/help/HelpLink.tsx`: `<HelpLink topic="generate-week" />` is a small muted
   "How this works" + `CircleHelp` link to `/app/help#key`. Use a plain `<a>`/`Link`, not
   `Button size="icon"`, so it can be compact.
2. Place it at these spots (each must target a topic that exists):

   | Spot | File | Topic |
   |---|---|---|
   | Generate preview header | `GenerateWeekSheet.tsx` | `generate-week` |
   | Route defaults sheet caption | `RouteDefaultsSheet.tsx` ~L81 | `route-defaults` |
   | Plan tomorrow caption | `PlanDaySheet.tsx` ~L142 | `plan-tomorrow` |
   | Cadence badge | `badges.tsx` (`CadenceSummary`) | `cadence-and-due` |
   | Unrouted panel | `UnroutedPanel.tsx` ~L204 | `unrouted-properties` |
   | Property form, interval hint | `PropertyForm.tsx` ~L136 | `service-interval` |
   | Account form, billing type | `AccountForm.tsx` | `billing-types` |
   | Billing queue and Invoices status | `InvoiceQueue.tsx`, `InvoicedHistory.tsx` | `billing-queue`, `invoice-status` |

3. ⌘K:
   - Add a "Help" `CommandGroup` from `helpFor(role)` (static, so it works offline).
     Selecting an item pushes `/app/help#key`.
   - Split `canSearch`: everyone gets the palette, and the Accounts group stays gated on
     `canAccessRoute('/app/accounts', role)`.
   - Change `CommandEmpty` to "Nothing found."
   - Crew need a way to open it on phone: a search row at the top of the Help page is enough.
     Don't add one to crew's More.
4. `npm run check:tours` also checks help keys. Every `HelpLink topic=`, `related` and `tour`
   must resolve to a real topic or tour. Extend `scripts/check-tour-anchors.mjs`, keeping the
   one script name.
5. CLAUDE.md → **Onboarding**: add one paragraph about the Help guide. It should say:
   - topics live in `lib/help/topics.ts`
   - **a change to a rule documented there updates its topic in the same change**
   - `check:tours` verifies help keys

**Verify:**
- The trio passes, and `check:tours` fails if you break a `HelpLink` key on purpose.
- ⌘K "generate" finds the topic for owner. For crew, ⌘K shows only Help.
- Each link lands on the open topic.

**As built — deviations:** _(fill in)_

---

## Information architecture

Role tags: **O** owner · **L** lead · **C** crew · **A** accountant.

| # | Section | Roles | Topics (seed list; merge or split freely) |
|---|---|---|---|
| 1 | Start here | all | The week is the unit · Routes carry the plan · Accounts pay, properties get the work · It works with no signal · What your role can do |
| 2 | The schedule | O L (A read) (C: Week/route only) | Today vs Week · Needs you · Running today · From the field · Progress counts · The desktop board & keys · Seen is per device |
| 3 | Planning a week | O L | Generate week · Cadence, due & overdue · Service interval · Planned day & day lanes · Carried over · Plan tomorrow · Crew instruction · Assigning crew & truck (one stop / whole route / select mode) · Week notes · Taking a stop off |
| 4 | Routes | O L (A read) | What a route is · Route defaults (and what they don't do) · Route days don't move stops · Drive order · One route per property · Unrouted properties · Deleting a route · What needs a connection |
| 5 | Doing the work | all | Start vs Finish · Log completion rules · Skipping · Who gets credit · The four kinds of notes · Photos · Reverting a stop |
| 6 | Accounts & properties | O L A | Accounts vs properties · Billing types & prices · Status vs Delete · What Delete does · Frequency · Service interval · Billing vs property address · Photo types & offline photos · QuickBooks customer ID |
| 7 | Billing & invoicing | O L A | The billing queue · The monthly sweep · One invoice per account · Pricing happens at push · Contracts · "Invoiced" isn't "sent" · Invoice statuses · When statuses update · Customer details sync to QuickBooks · When a push fails · Connecting QuickBooks |
| 8 | Leads | O L | Where leads come from · Converting a lead · Lead statuses · Spam |
| 9 | Team & roles | O (role matrix: all) | Roles · Inviting someone · Active vs access · Role changes · SMS (not yet) |
| 10 | Offline & sync | all | What works offline · What needs a connection · Changes that didn't save · Cached data · Live updates |
| 11 | Activity, reports, fleet | O L (A: reports) | Activity log · Reports math · Fleet maintenance & next due |
| 12 | FAQ | filtered | See H3 |

---

## Possible bugs: decide before H2/H3

Found during the 2026-10-15 survey. Each is a code fix, not help text; track it outside this
plan. If one is accepted as intended, move it into the inventory.

- **B0: fixed 2026-10-16.** Start / Finish / Skip had been unreachable since `33fdde3`
  (Oct 3) removed the sheet's only link to `/app/stop/[visitId]`. The bar is now
  `components/crew/StopActions.tsx`, shown in the stop sheet's footer, the board's stop pane
  and the stop page, for every role but the accountant. Crew not on a stop are added to it
  (`enqueueJoinVisit`) before their Start / Finish / Skip. A visit update RLS refuses (0 rows)
  now parks in "Changes that didn't save" instead of looking saved (`expectVisitRow`).
- **B1.** `property_last_visit` counts any visit with `ended_at`, so it doesn't respect
  "skips never count". Two cases leak through:
  - an on-site skip writes `ended_at` (`mutation-queue.ts` ~L356-368, `SkipSheet.tsx:62`)
  - reverting to Scheduled keeps it (~L464-471)
  - The view is `supabase/migrations/20260826120200_property_last_visit_view.sql`.
- **B2.** Bulk Skip of an on-site stop never writes `ended_at`, so the stop shows "On site"
  indefinitely (`useBulkScheduleActions.ts` ~L165-202).
- **B3.** Reopening Log Completion prefills End with now (capped at week end), so re-saving
  rewrites the completion date (`VisitLogger.tsx` ~L167).
- **B4.** New route assignments land at the top of the drive order, not the end.
  - Every add writes position 0 (`routes/actions.ts` ~L150,177), against the doc in
    `useAssignPropertyRoute.ts` ~L21.
  - "Route all" numbers 0,1,2… and so collides with existing positions
    (`useRouteAllUngrouped.ts:22-27`).
  - Undo doesn't restore the old position.
- **B5.** Generating next week before this week's stop is completed can double-book it. Due
  only looks at completed visits, and `useGenerateWeek` only checks the target week. Generate
  is also offered on past weeks (`ScheduleView.tsx` ~L268).
- **B6.** Generate ignores account status, so a Prospective account's never-visited property
  comes up due (`schedule.ts` ~L179-215).
- **B7.** A service interval on an *As needed* property makes Generate schedule it, but the
  form hint promises only "an overdue warning" (`PropertyForm.tsx` ~L136).
- **B8.** Billing push doesn't re-check that visits are still uninvoiced, so a stale tab or
  two users can double-bill (`app/management/billing/actions.ts` ~L61-64,163-169).
- **B9.** QuickBooks customers can be duplicated:
  - the first "Link to QuickBooks" never searches for an existing customer
  - a stale link silently creates a new one (`lib/quickbooks/sync.ts` ~L58-72,131-155)
- **B10.** Leads can see hourly-rate changes in the Activity log (employee updates are audited
  in full).
- **B11.** Turning off an employee's "Active" doesn't revoke sign-in; it only hides them from
  pickers.
- **B12.** The accountant sees a Fleet nav item but gets an empty page (RLS).
- **B13.** Contract invoices may not tag visits that ended on the period's last day (end date
  compared at midnight; `billing/actions.ts` ~L361-367).
- **B14.** An expired QuickBooks connection leaves the Push buttons enabled
  (`billing/page.tsx` ~L107-109).
- **B15.** "Edit Route Group" claims to edit sort order but only saves the name
  (`RouteGroupSheet.tsx` ~L53).
- **B16.** Inactive crew and retired trucks can stay in a route's defaults, invisible in the
  picker but still applied by Generate (`lib/schedule/fetch.ts:36`).

---

## Appendix: rule inventory (2026-10-15)

Source material for H2/H3. Paths are relative to the repo root. "~" means ±2 lines.
**Re-verify before writing.**

### A. Generate week
1. A property is due when **its own last completed visit + interval** falls on or before the
   target week's **Sunday**, so biweekly properties drift with real work rather than
   alternating fixed weeks. `lib/utils/schedule.ts:179-216`
2. Intervals: weekly 7 · biweekly 14 · monthly **28** · as-needed none. `lib/utils/cadence.ts:8-13`
3. A skip doesn't count as a visit, so the property comes up due again (but see B1).
4. Never completed ("Never visited") = due every week, at any frequency. `schedule.ts:205-207`
5. As-needed is never generated ("As needed — schedule by hand") unless it has a service
   interval (B7). `schedule.ts:194-201`
6. Service interval overrides frequency everywhere, but the badge still shows the frequency
   name. `cadence.ts:37-40`, `badges.tsx:93-116`
7. "Already on this week" is skipped, even if that visit was skipped. Generate never changes an
   existing visit. `schedule.ts:189`
8. Archived properties never appear. `lib/schedule/fetch.ts:27-35`
9. Generate refuses to run without visit history ("Couldn't read visit history…").
   `useGenerateWeek.ts:46-48`
10. The preview is exactly what's written. Untick rows to leave them out. "Show N skipped"
    gives the reasons. The button says "Schedule N stops". `GenerateWeekSheet.tsx:55-57,97,191,222`
11. Filters don't shrink Generate. `ScheduleView.tsx:266-268`
12. Today's "N stops are due and not scheduled" is current week only and opens Generate for
    the current week. `schedule.ts:404-415`, `TodayView.tsx:106,200-208`
13. Last-visit data can be up to 5 minutes stale after field work. `usePropertyLastVisit.ts:31`

### B. Route defaults (Days · Truck · Regular crew)
14. They pre-fill **only Generate-created visits**, with the truck and every regular.
    `useGenerateWeek.ts:80-117`
15. Hand-made stops get none (+ Schedule, the S key, bulk Schedule, bulk on empty rows).
    `useScheduleInteractions.ts:95-113`, `useCreateVisit.ts:25-47`
16. Editing defaults never changes existing visits ("A stop's own crew and truck always win").
    `RouteDefaultsSheet.tsx:82`
17. **Days never move a stop.** They decide only the route label, Running today, and Generate's
    day pre-fill. `RouteDefaultsSheet.tsx:96`, `schedule.ts:568`
18. Generate's day pre-fill is the **weekday the property was last finished**, if the route
    runs that day; otherwise Any day. The preview shows "Mon 4 · Tue 3 · Any 1" on routes with
    2+ days. `schedule.ts:219-222,521-529`, `GenerateWeekSheet.tsx:143-147`
19. Defaults need a connection (they replace a whole set). `RouteDefaultsSheet.tsx:86-91`
20. Regular crew is **not** a fallback: a stop with no crew counts as "without crew".
    `useGenerateWeek.ts:96`
21. Inactive crew and retired trucks can linger (B16).

### C. Whole-route and select-mode changes
22. Route bar Crew/Truck change **this week's not-done stops only** (on-site stops included).
    `schedule/actions.ts:10-35`, `RouteAssignSheets.tsx:47-60`
23. Route Crew **replaces** crew on all of them. It starts pre-ticked with everyone on any stop.
    `RouteAssignSheets.tsx:129-134`
24. Truck saves on one tap, with no confirm and no Undo. `RouteAssignSheets.tsx:164-199`
25. Both need a connection ("You can still change one stop offline"). `RouteAssignSheets.tsx:64-68`
26. Neither updates the route's defaults, so next Generate uses the old ones.
27. Select mode: bulk Crew **adds** one person. `useBulkScheduleActions.ts:57-85`
28. Bulk Crew/Truck/Day on unscheduled rows schedules them first, and Undo can't remove those
    stops. `useBulkScheduleActions.ts:33-44,51`
29. Bulk Crew/Truck/Day also apply to completed and skipped stops; only Skip filters by status.
30. There is no unschedule or delete for a visit. Skip is the only way off, and tapping an
    empty row creates a visit immediately. `ScheduleListMobile.tsx:162-169,346-353`

### D. Day planning
31. A planned day is a plan, not a rule. Completion records the real date. `DAY_PLANNING.md:41-43`
32. Lanes show when the route has 2+ days or any stop has a day. `ScheduleListMobile.tsx:455-458`
33. Unscheduled properties sit in Any day with no chip; schedule first, then set a day.
34. A day the route doesn't run gets its own lane, marked "· not a route day".
    `ScheduleListMobile.tsx:826-828`
35. Carried over is derived (not started, planned before today) and never saved; the stop stays
    on its old day until moved. `schedule.ts:509-515`
36. A carried-over stop **vanishes from Today** if its route doesn't run today. It is visible
    only in Week. `schedule.ts:585-588`
37. Running today shows a route if it runs today, has a stop planned today, has someone on
    site, or finished a stop today. `schedule.ts:550-596`
38. "Not on a route" stops appear on Today only if planned today, on site, or finished today.
39. "Finished today" counts by finish time, not planned day. `schedule.ts:570-575`
40. Plan tomorrow lists only **existing**, not-started stops with no day or a day on or before
    the target, so Generate comes first. `PlanDaySheet.tsx:56-59`
41. Unticking a pre-ticked stop sends it to Any day, not its previous day.
    `PlanDaySheet.tsx:94-95,107-109`
42. On Sunday the button is "Plan today". A visit can't be planned outside its week.
    `TodayView.tsx:184`
43. Plan tomorrow ignores filters; Running today follows them. `TodayView.tsx:73,215`
44. Today keeps the date it opened with; reload after midnight. `TodayView.tsx:66`
45. Day changes work offline and have Undo ("Moved to Tue."). `ScheduleListMobile.tsx:392-414`

### E. Routes page
46. A property is on at most one route; adding it elsewhere moves it ("Move to {route}?").
    `routes/actions.ts:141-160`
47. Drive order is set with ⇅ → "Move here" and works offline. `RouteGroupCard.tsx:83-102,461-526`
48. Visits follow the property's **current** route, in every week including past ones, taking
    their crew, truck and day with them. `schedule.ts:72-94`
49. Deleting a route keeps its stops. Its properties become "Not on a route", and its regular
    crew and week notes are deleted. `routes/actions.ts:122-133`
50. Routing one property works offline; several at once needs a connection.
    `UnroutedPanel.tsx:158-163`
51. Archiving a property hides all its visits from the schedule; Billing still has them.
52. A route filter hides the "Not on a route" bucket. `lib/utils/schedule-filters.ts`
53. The "This route" sort switch applies to every route, is saved per device, and Today
    ignores it. `ScheduleListMobile.tsx:190-197`
54. The unrouted badge = live properties − route assignments, including inactive and prospective
    accounts. It refreshes about once a minute. Unrouted properties still show under "Not on a
    route". `useNavCounts.ts:30-46`

### F. Notes, Start/Finish, completion, skip, revert
55. Four kinds of notes:
    - **Crew instruction:** this visit only, owner/lead, the pencil, shown in clay, never
      copied forward.
    - **Crew / Access / Parking notes:** standing, on every visit, set in Edit Property.
    - **Week note:** every stop on the route that week.
    - **Completion note:** sent back by crew.
    `VisitDetailContent.tsx:345-375,480-567`
56. The crew instruction, crew and truck lock once a stop is done or skipped.
    `VisitDetailContent.tsx:139,363,388,422`
57. Account notes are office-only; crew see property notes. `AccountDetailView.tsx:205-209`
58. Start ≠ completion. Start begins the clock and becomes "Discard"; "Finish" opens Log
    Completion. `app/app/stop/[visitId]/page.tsx:117-141,222-266` (see B0)
59. Log Completion:
    - times must be inside the visit's week and not in the future
    - "Who was on site?" (≥1) and a service type are required
    - with no Start, the time on site is 0 minutes
    - work that ran into the next week can't be logged on its real date
    `VisitLogger.tsx:100-103,147-155,308-317`
60. Finishing a skipped stop un-skips it and replaces the on-site list.
    `mutation-queue.ts:316-354`
61. Skipping an on-site stop stops the clock. The reason is optional. Skip is available even on
    completed stops. `SkipSheet.tsx:55-62`
62. Reverting to Scheduled clears only the status and skip reason. `VisitDetailContent.tsx:192-206`

### G. Credit and roles in the field
63. Credit goes to **who was on site**, not who was assigned. Reports count each person, by
    week. Lists show on-site crew once done, otherwise assigned; never merged.
    `lib/utils/visits.ts:51-57`, `reports/actions.ts:112-136`
64. Crew don't see Today, Needs you, Generate, the route bars or the day picker; day chips are
    read-only for them. `lib/auth/access.ts:91-105`
65. Crew can change a stop's vehicle and assigned crew, including removing themselves.
    `access.ts:98`
66. Crew can only save changes on stops they're assigned to or credited on.
    `baseline_schema.sql:750-770`

### H. Needs you, From the field, counts
67. Needs you order: skips → on site more than 4 h → crew reports → "N stops on {route} have no
    crew" → "N stops are due…". Current week only. `schedule.ts:310,336-424`
68. "Seen" is per device and doesn't sync between owners. Changed content comes back.
    `useScheduleSeen.ts:16-18,50-66`
69. A completion with no note and no photo never reaches Needs you. `schedule.ts:427-435`
70. Progress counts include unscheduled properties and treat skips as done ("6/8").
    `schedule.ts:281-298`

### I. Offline and live updates
71. Most field edits save offline and sync when back online, on app open, or with the next edit.
    After 5 failed tries, or one refusal, they move to "{N} changes didn't save" (Try again /
    Discard). `mutation-queue.ts:148,242-262`, `StuckChangesSheet.tsx`
72. Unsynced changes survive sign-out and sync under whoever signs in next on that phone.
    `AppShell.tsx:177-181`
73. Offline edits are stamped in the Activity log **when they sync**.
74. Live updates:
    - edits to visible visits and crew changes are live
    - stops added on another device need a refresh
    - week notes, routes and defaults are never live
    - "Your schedule was updated." fires when your assignment changes
    `ScheduleRealtime.tsx:36`, `useCrewRealtimeSync.ts:48-69`
75. Offline, Today shows "Last seen on site at h:mm" and "Showing your last saved copy…".
76. Edit Property: notes and interval save offline; address and frequency need a connection.
    `PropertyForm.tsx:87-108`

### J. Accounts
77. The price is required for the chosen billing type only (per-visit price; contract rate +
    Monthly/Seasonal). `lib/validators/account.ts:38-50`
78. Switching billing type **erases** the other rate. `lib/utils/accounts.ts:37-40`
79. Switching type moves unbilled visits into or out of the Billing Queue (contract → per-visit
    can surface old work). `billing/actions.ts:23-43`
80. The queue prices at **push time**, so a price change re-prices all unbilled work.
    `InvoiceQueue.tsx:59-62`, `lib/quickbooks/invoice.ts:77-88`
81. Status (Active/Inactive/Prospective) only affects the Contracts tab and the adherence
    report. It doesn't stop scheduling, billing or routing (see B6).
    `billing/actions.ts:282`, `reports/actions.ts:231`
82. Status and Delete are independent; there is no "Archived" status.
83. The billing address goes on invoices; property addresses are where crew work.
84. The QuickBooks Customer ID field is a manual override; a wrong value points invoices at the
    wrong customer. `AccountForm.tsx:426-447`
85. "As needed" is no longer a billing type, only a property frequency; legacy accounts are
    refused by the queue.

### K. Deleting (archiving)
86. Delete = archive. History keeps names and addresses. No restore button; restoring needs a
    developer.
87. Deleting an account deletes all its properties and **permanently removes their route
    assignments**. `accounts/actions.ts:62-99`
88. Owner only (enforced in the database). `access.ts:101`
89. Unbilled completed work stays in the Billing Queue. Future visits are hidden, not deleted.
90. Contract accounts drop off the Contracts tab when archived or not Active; bill the final
    period first. `billing/actions.ts:279-284`

### L. Properties and photos
91. Scheduling, routes and frequency are per property; billing is per account (one invoice
    covers all of its properties). `lib/utils/billing.ts:28-40`
92. "Monthly" drifts against calendar months (28 days).
93. Account-page uploads start as How-To photos. How-To and Customer Request photos are cached
    on the phone (about 100 MB, oldest dropped first). Photo deletes are permanent.
    `PhotoUploadDropzone.tsx:98-102`, `lib/offline/photo-blobs.ts:17-20`
94. Map coordinates aren't used; drive order is manual.

### M. Billing and invoicing
95. The queue holds completed, unpushed visits from per-visit accounts (archived included).
    Skips never appear. The default range is "All time". `billing/actions.ts:23-43`, `InvoiceQueue.tsx:64-74`
96. The monthly sweep is a habit (pick "Last month" and push), not automation.
97. Ticking an account bills **every visit currently shown** for it on one invoice. Click the
    row to pick individual visits. `InvoiceQueue.tsx:175-181`, `AccountInvoiceDrawer.tsx:77-94`
98. Lines read "address — date — services", all on one QuickBooks product (default "Services"),
    which must exist. `lib/quickbooks/invoice.ts:8,18-31`
99. Each push overwrites the QuickBooks customer's name, email, phone and address with the app's
    values; blank app fields don't clear QuickBooks. `lib/quickbooks/sync.ts:46-56,105-125`
100. **Push = Draft.** The customer gets nothing until it's sent from QuickBooks.
101. "Created in QuickBooks but couldn't be recorded": don't push again. Other failures stay
     listed until dismissed, and one failure doesn't stop the others. `billing/actions.ts:132-137`,
     `InvoiceQueue.tsx:415-445`
102. Contracts:
     - billed by period, regardless of visits
     - the amount is editable per invoice
     - Monthly pre-fills the current month; Seasonal starts blank
     - nothing stops billing a period twice
     `ContractInvoicing.tsx:99-114`, `billing/actions.ts:329-419`
103. Statuses:
     - **Paid** = balance $0, which includes **voided**
     - **Overdue** = emailed and past due
     - **Sent** = emailed, which includes partly paid
     - **Draft** = everything else, which includes printed or mailed
     `lib/quickbooks/invoiceStatus.ts:31-56`
104. Paid is never re-checked. `invoiceStatus.ts:128`
105. Sync runs:
     - daily at about 9:00 UTC (≤50 invoices, least recently checked first)
     - every ~60 s while the Invoices tab is open
     - on "Refresh now"
     `app/api/cron/sync-invoice-status/route.ts`, `InvoicedHistory.tsx:62-63`
106. "Sent on" and "Paid on" are when the app noticed. The "Invoiced this month" tiles count
     pushed invoices, including Drafts. `billing/actions.ts:222-265`
107. The per-visit line amount in history = total ÷ visits. `InvoicedHistory.tsx:400-401`
108. Only an owner can connect QuickBooks; the accountant still sees "Reconnect it from this
     page". `billing/page.tsx:57-61`
109. The accountant can link and sync a customer but edit nothing else on an account.

### N. Leads
110. Only service inquiries convert, and only once, to a **Prospective, per-visit** account. A
     price is required. The name becomes the account name, the notes get a stub, and the lead
     becomes **Won** automatically. The property step is optional and pre-fills the address.
     `lib/utils/leads.ts:25-50`, `leads/actions.ts:85-117`
111. Statuses are labels; only "New" drives the badge (which also counts job applications).
     `useNavCounts.ts:10-27`
112. Spam is silently dropped (the sender sees success). The limit is 3 per 10 min and 10 per
     day per connection. `lib/leads/spam.ts:6-13`
113. The new-inquiry alert appears only while the app is open. No text or email.
     `AppShell.tsx:125-158`

### O. Team and roles
114. Owner: everything. Lead: owner minus Delete, Team and connecting QuickBooks. Crew: schedule
     and stops. Accountant: lands on Billing, sees Billing and Reports, read-only schedule,
     accounts and routes. `lib/auth/access.ts:9-32,91-107`
115. "Active" off only hides someone from pickers (B11). `useActiveEmployees.ts:16-17`
116. Role changes reach menus on next sign-in or within about 12 h; data permissions change at
     once. `proxy.ts:13,94-124`
117. Changing an invited person's email changes their login. "Invite to App" works once, then
     resend the sign-in link. `team/actions.ts:61-212`
118. The SMS toggle does nothing yet (SMS postponed). "Side" and "Hourly rate" are labels or
     reference only.

### P. Activity log, reports, fleet
119. Activity log: owner and lead only, 50 per page, starts about 2026-09-30.
     - Not logged: public forms, token refresh, invoice sync bookkeeping, completed-by crew
       changes, onboarding.
     - Offline edits are stamped at sync.
     - Invoice status changes are credited to whoever had Invoices open.
     - One delete creates many rows.
     `audit/page.tsx`, `20260930120000_audit_log.sql:55-75`
120. Reports:
     - Revenue "Invoiced" is by push month; "Paid" is by the month noticed. Partial payments
       don't count.
     - Visits per crew covers 12 weeks, one per person.
     - Adherence counts Active accounts only, ignores the service interval, and treats monthly
       as about 4.3 weeks.
     `reports/actions.ts`
121. Fleet:
     - logging maintenance sets last serviced to that entry's date
     - "next due" warns 14 days ahead, on the Fleet page only
     - Retired vehicles are hidden from pickers; Maintenance vehicles stay pickable
     - "In Use" is never automatic
     - vehicles and equipment can't be deleted
     `fleet/actions.ts:95-126`, `lib/utils/fleet.ts:7-21`

### Where each setting lives (use these labels in `where`)
| Setting | Screen → label |
|---|---|
| Route Days / Truck / Regular crew | Routes → card "Set crew, truck and days →" or ⋯ "Route defaults…"; schedule route ⋯ "Route defaults…" |
| This week's crew / truck for a route | Schedule → route → bottom bar "Crew" / "Truck" |
| Week note | Schedule → route → bar "Add note" |
| Planned day | Stop row day chip; ⋯ "Select stops" → "Day"; Today → "Plan tomorrow"; Generate |
| Drive order | Routes → card ⇅ → "Move here" |
| Route membership | Routes "Manage properties"; Unrouted panel; account page "Put on a route" / "Change route"; "Route all N" |
| Frequency, Service interval, Crew/Access/Parking notes | Accounts → account → property → "Edit Property" |
| Crew instruction | Stop sheet → Visit Plan → pencil |
| Assigned crew / Vehicle (one stop) | Stop sheet → "Manage" / Vehicle |
| Status / revert | Stop sheet → "Status" (owner/lead) |
| Completion / skip | "Log Completion" / "Skip this stop?" |
| Billing type & prices | Accounts → account → Edit → "Billing type" |
| Delete account / property | Account page trash (owner) |
| Push invoices | Billing → Queue → tick or row → "Create invoice" |
| Contract invoice | Billing → Contracts |
| Invoice status refresh | Billing → Invoices → "Refresh now" |
| Roles, invites, Active | More → Team (owner) |
