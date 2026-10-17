import type { EmployeeRole } from '@/types/app'

/**
 * The Help guide's content, as data. No React or Supabase here: ⌘K and the check script import it.
 * When a rule documented here changes, update its topic in the same change.
 */

type HelpRoles = readonly EmployeeRole[]

const ALL: HelpRoles = ['owner', 'lead', 'crew', 'accountant']
const OFFICE: HelpRoles = ['owner', 'lead']
const OFFICE_AND_BOOKS: HelpRoles = ['owner', 'lead', 'accountant']
/** Everyone who works stops: not the accountant. */
const FIELD: HelpRoles = ['owner', 'lead', 'crew']

/** Text supports **bold** only. Links between topics go in `related`, not in the text. */
export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  /** A side effect nobody would guess. Rendered as a clay callout. */
  | { kind: 'headsUp'; text: string }
  | { kind: 'example'; text: string }

/** Icon names resolve to lucide components in HelpView. */
export type HelpIcon =
  | 'sprout'
  | 'calendar'
  | 'calendarPlus'
  | 'route'
  | 'mapPin'
  | 'users'
  | 'receipt'
  | 'inbox'
  | 'userCircle'
  | 'wifiOff'
  | 'barChart'
  | 'helpCircle'

export interface HelpSection {
  key: string
  title: string
  icon: HelpIcon
  roles: HelpRoles
}

export interface HelpTopic {
  /** The URL hash: /app/help#generate-week. */
  key: string
  section: string
  title: string
  /** One line: the collapsed row and the ⌘K item. */
  summary: string
  /** Narrower than the section's roles, when a topic is for fewer people. */
  roles?: HelpRoles
  /** The screen and label where this lives, as the UI names it. */
  where?: string
  body: HelpBlock[]
  related?: string[]
  /** A TOURS key, for a "Show me" button. */
  tour?: string
}

export const HELP_SECTIONS: HelpSection[] = [
  { key: 'start', title: 'Start here', icon: 'sprout', roles: ALL },
  { key: 'schedule', title: 'The schedule', icon: 'calendar', roles: ALL },
  { key: 'planning', title: 'Planning a week', icon: 'calendarPlus', roles: OFFICE },
  { key: 'routes', title: 'Routes', icon: 'route', roles: OFFICE_AND_BOOKS },
  { key: 'stops', title: 'Doing the work', icon: 'mapPin', roles: ALL },
  { key: 'accounts', title: 'Accounts & properties', icon: 'users', roles: OFFICE_AND_BOOKS },
  { key: 'billing', title: 'Billing & invoicing', icon: 'receipt', roles: OFFICE_AND_BOOKS },
  { key: 'leads', title: 'Leads', icon: 'inbox', roles: OFFICE },
  { key: 'team', title: 'Team & roles', icon: 'userCircle', roles: ALL },
  { key: 'offline', title: 'Offline & sync', icon: 'wifiOff', roles: ALL },
  { key: 'records', title: 'Activity, reports & fleet', icon: 'barChart', roles: OFFICE_AND_BOOKS },
  { key: 'faq', title: 'FAQ', icon: 'helpCircle', roles: ALL },
]

export const HELP_TOPICS: HelpTopic[] = [
  // ─── Start here ───────────────────────────────────────────────────────────────
  {
    key: 'week-is-the-unit',
    section: 'start',
    title: 'The week is the unit',
    summary: 'Every stop belongs to a week, not a day, just like the old sheet.',
    body: [
      {
        kind: 'p',
        text: 'A stop is one property in one week. A property can only be on the schedule **once per week**, and the week always runs Monday to Sunday.',
      },
      {
        kind: 'p',
        text: 'A stop can also have a planned day, but that is a plan, not a rule: crew can do it any day that week, and the day it was really finished is what gets recorded.',
      },
    ],
    related: ['planned-day', 'routes-carry-the-plan'],
    tour: 'tour.schedule',
  },
  {
    key: 'routes-carry-the-plan',
    section: 'start',
    title: 'Routes carry the plan',
    summary: 'A route is a cluster of stops one crew drives together, in order.',
    body: [
      {
        kind: 'p',
        text: 'Each route lists its properties in **drive order**, top to bottom. It also has its usual days, truck and regular crew.',
      },
      {
        kind: 'p',
        text: 'Those usual settings are the plan for a normal week. Any single stop can still have a different crew, truck or day.',
      },
    ],
    related: ['route-defaults', 'route-days-dont-move-stops', 'drive-order'],
  },
  {
    key: 'accounts-pay-properties-get-work',
    section: 'start',
    title: 'Accounts pay, properties get the work',
    summary: 'An account is who gets the invoice. A property is an address crew visit.',
    body: [
      {
        kind: 'p',
        text: 'One account can have several properties. Each property has its own address, cadence (weekly, biweekly, monthly or as needed) and standing notes for crew.',
      },
      {
        kind: 'p',
        text: 'The schedule and routes work property by property. Billing works account by account.',
      },
    ],
    related: ['cadence-and-due', 'four-kinds-of-notes'],
  },
  {
    key: 'works-with-no-signal',
    section: 'start',
    title: 'It works with no signal',
    summary: 'Field changes save on your phone and sync when you’re back in service.',
    body: [
      {
        kind: 'p',
        text: 'Starting, finishing and skipping stops, photos, notes, crew and truck changes all save on your phone first. They go up on their own once you have signal.',
      },
      {
        kind: 'p',
        text: 'A strip at the top of the screen tells you when you’re offline and how many changes are waiting.',
      },
    ],
    related: ['what-works-offline', 'what-needs-a-connection', 'changes-didnt-save'],
  },
  {
    key: 'what-your-role-can-do',
    section: 'start',
    title: 'What your role can do',
    summary: 'Everyone uses the same app. Your role decides what you can change.',
    body: [
      {
        kind: 'list',
        items: [
          '**Owner:** everything, including deleting accounts and managing the team.',
          '**Lead:** the same as an owner, except deleting, the Team page and connecting QuickBooks.',
          '**Crew:** the week’s schedule and your stops: start, finish, skip, photos, and who’s on a stop.',
          '**Accountant:** Billing and Reports, plus a read-only view of the schedule, accounts and routes.',
        ],
      },
    ],
    related: ['crew-week'],
  },

  // ─── The schedule ─────────────────────────────────────────────────────────────
  {
    key: 'today-vs-week',
    section: 'schedule',
    title: 'Today and Week',
    summary: 'Today runs the day. Week is the plan.',
    roles: OFFICE_AND_BOOKS,
    where: 'Schedule → Today | Week',
    body: [
      {
        kind: 'list',
        items: [
          '**Today** has three parts: **Needs you** (things to decide), **Running today** (the routes out today), and **From the field** (what crews sent back).',
          '**Week** shows one row per route for the week you’re on. Tap a route to see its stops.',
        ],
      },
      {
        kind: 'p',
        text: 'Today always shows the current week. Use the arrows in Week to look ahead or back.',
      },
    ],
    related: ['needs-you', 'running-today', 'from-the-field', 'route-rows-and-counts'],
    tour: 'tour.schedule',
  },
  {
    key: 'crew-week',
    section: 'schedule',
    title: 'Your week',
    summary: 'Every route this week, its stops, and which day each is planned for.',
    roles: ['crew'],
    where: 'Schedule',
    body: [
      {
        kind: 'p',
        text: 'The schedule shows every route for the week. Tap a route to see its stops in drive order, then tap a stop to open it.',
      },
      {
        kind: 'p',
        text: 'If a stop has a day on it, that’s the day the office planned. It’s a plan, not a rule: if you finish it another day that week, the real day is what gets recorded.',
      },
      {
        kind: 'p',
        text: 'When the office changes which stops you’re on, you’ll see **Your schedule was updated.**',
      },
    ],
    related: ['start-finish-skip', 'four-kinds-of-notes', 'live-updates'],
  },
  {
    key: 'route-rows-and-counts',
    section: 'schedule',
    title: 'What a route’s row tells you',
    summary: 'Its days, crew, truck, progress, and what still needs planning.',
    body: [
      {
        kind: 'p',
        text: 'Each route’s row shows its days, the crew and truck on its stops, and progress like **6/8**.',
      },
      {
        kind: 'list',
        items: [
          'Progress counts **skipped stops as done**, since the decision has been made.',
          'The total includes every property on the route, scheduled or not, so **N not scheduled** shows what hasn’t been put on the week yet.',
          '**N without crew** counts scheduled stops nobody is on.',
        ],
      },
      {
        kind: 'p',
        text: 'Properties that aren’t on any route have their own row, **Not on a route**.',
      },
    ],
    related: ['who-gets-credit', 'unrouted-properties'],
  },
  {
    key: 'needs-you',
    section: 'schedule',
    title: 'Needs you',
    summary: 'This week’s exceptions, most urgent first.',
    roles: OFFICE_AND_BOOKS,
    where: 'Schedule → Today → Needs you',
    body: [
      { kind: 'p', text: 'Needs you only looks at the **current week**. Items come in this order:' },
      {
        kind: 'list',
        items: [
          'Skipped stops, with the reason if one was given.',
          'Stops where someone has been on site for more than **4 hours**: usually a forgotten Finish.',
          'Finished stops where crew sent back a note or photos.',
          '**N stops on a route have no crew.** Tapping it opens the route.',
          '**N stops are due and not scheduled.** Tapping it opens Generate for this week.',
        ],
      },
      {
        kind: 'p',
        text: 'A stop finished with no note and no photo never shows here. It’s under From the field.',
      },
      {
        kind: 'headsUp',
        text: 'Opening a skip or a crew report clears it **on this phone or computer only**. It isn’t shared with the other owner. If the stop changes later, for example a new note, it comes back.',
      },
    ],
    related: ['from-the-field', 'generate-week', 'skipping'],
  },
  {
    key: 'running-today',
    section: 'schedule',
    title: 'Running today',
    summary: 'The routes out today, each cut down to today’s stops.',
    roles: OFFICE_AND_BOOKS,
    where: 'Schedule → Today → Running today',
    body: [
      {
        kind: 'p',
        text: 'A route shows here if it **runs today** (one of its days), has a stop **planned for today**, has someone **on site**, or had a stop **finished today**.',
      },
      { kind: 'p', text: 'Each route shows only today’s stops:' },
      {
        kind: 'list',
        items: [
          'stops planned for today',
          'stops with no day, when the route runs today',
          'stops carried over from an earlier day',
          'anything on site now or finished today, whatever day it was planned for',
        ],
      },
      {
        kind: 'headsUp',
        text: 'A carried-over stop on a route that **doesn’t run today** doesn’t show here. You’ll only see it in Week, still on its old day, until you move it.',
      },
      {
        kind: 'p',
        text: 'Stops that aren’t on a route show only if they’re planned for today, on site, or finished today. Stops are always in drive order here. **Other routes this week** opens Week for everything else.',
      },
    ],
    related: ['carried-over', 'route-days-dont-move-stops', 'plan-tomorrow'],
  },
  {
    key: 'from-the-field',
    section: 'schedule',
    title: 'From the field',
    summary: 'Every stop finished or skipped this week, newest first.',
    roles: OFFICE_AND_BOOKS,
    where: 'Schedule → Today → From the field',
    body: [
      {
        kind: 'p',
        text: 'Each item shows what crew sent back: the services, a note, photos, or the skip reason. Tap one to open the stop.',
      },
    ],
    related: ['needs-you', 'log-completion'],
  },
  {
    key: 'desktop-board',
    section: 'schedule',
    title: 'The board on a laptop',
    summary: 'Routes, a route’s stops and the open stop, side by side.',
    body: [
      {
        kind: 'p',
        text: 'On a wide screen the schedule becomes three columns: routes on the left, the chosen route’s stops in the middle, and the open stop on the right.',
      },
      {
        kind: 'list',
        items: ['**↑ / ↓** move between stops', '**Enter** opens one', '**Esc** closes the stop'],
      },
    ],
    related: ['today-vs-week'],
    tour: 'tour.schedule',
  },
  {
    key: 'drive-order-or-priority',
    section: 'schedule',
    title: 'Drive order or Priority',
    summary: 'Sort a route’s stops by the way you drive it, or by who’s waited longest.',
    where: 'Schedule → a route → the sort button in the route header',
    body: [
      {
        kind: 'list',
        items: [
          '**Drive order** is the route’s order, top to bottom.',
          '**Priority** puts the longest-waiting properties first, with finished and skipped stops at the bottom.',
        ],
      },
      {
        kind: 'p',
        text: 'The choice applies to **every route**, and it’s remembered on this phone or computer only.',
      },
    ],
    related: ['drive-order', 'cadence-and-due'],
  },

  // ─── Planning a week ──────────────────────────────────────────────────────────
  {
    key: 'generate-week',
    section: 'planning',
    title: 'What Generate week puts on',
    summary: 'Every property that’s due, with each route’s truck and regular crew filled in.',
    where: 'Schedule → Week → ⋯ → Generate week… (on a laptop, the Generate week… button)',
    body: [
      {
        kind: 'p',
        text: 'Generate looks at every property and works out which are due that week. You always get a preview first. Nothing is saved until you tap **Schedule N stops**.',
      },
      {
        kind: 'list',
        items: [
          'Tap a stop in the preview to leave it out.',
          '**Show N skipped** lists everything left off, with the reason: already on this week, not due until a date, or as needed.',
          'Each new stop gets its route’s **truck** and **every regular crew member**.',
          'Properties that aren’t on a route are included too, under **Not on a route**, with no crew or truck.',
        ],
      },
      {
        kind: 'p',
        text: 'Generate never changes a stop that’s already on the week, so running it twice is safe. It ignores the schedule filters, so it always looks at every property.',
      },
      {
        kind: 'headsUp',
        text: 'A property already on the week is left alone **even if that stop was skipped**. Generate won’t add a second one.',
      },
      {
        kind: 'p',
        text: 'If the app can’t read visit history (“Couldn’t read visit history”), it won’t generate, because every property would look due. Try again with a connection.',
      },
    ],
    related: ['cadence-and-due', 'generate-picks-days', 'route-defaults'],
    tour: 'tour.schedule',
  },
  {
    key: 'cadence-and-due',
    section: 'planning',
    title: 'When a property is due',
    summary: 'Its last finished visit plus its interval, landing on or before the week’s Sunday.',
    body: [
      {
        kind: 'p',
        text: 'A property is due in a week when its **last finished visit + its interval** falls on or before that week’s **Sunday**.',
      },
      {
        kind: 'list',
        items: [
          '**Weekly** = every 7 days',
          '**Biweekly** = every 14 days',
          '**Monthly** = every **28 days**, not once a calendar month',
          '**As needed** has no interval. Generate lists it as “As needed — schedule by hand”.',
        ],
      },
      {
        kind: 'p',
        text: 'Each property counts from its own last visit, so a biweekly property follows when the work was really done rather than alternating fixed weeks.',
      },
      {
        kind: 'headsUp',
        text: 'A property that has **never been finished** comes up due every week, whatever its frequency. A brand-new biweekly property is due weekly until its first visit is logged.',
      },
      {
        kind: 'p',
        text: 'Skipping a stop before anyone started it doesn’t count as a visit, so the property stays due.',
      },
      {
        kind: 'example',
        text: 'The badge **WEEKLY · 9D** means weekly, 9 days since the last visit. It turns amber near the end of the interval and red once it’s overdue. A dash means no visit has been logged yet.',
      },
      {
        kind: 'p',
        text: 'Field work can take up to 5 minutes to count toward this.',
      },
    ],
    related: ['service-interval', 'generate-week', 'skipping'],
  },
  {
    key: 'service-interval',
    section: 'planning',
    title: 'Service interval',
    summary: 'A custom number of days that replaces the frequency’s interval for one property.',
    where: 'Accounts → an account → a property → Edit Property → Service interval',
    body: [
      {
        kind: 'p',
        text: 'Leave it blank to follow the frequency (7, 14 or 28 days). Set a number to use that instead, for due dates, the badge and Generate.',
      },
      {
        kind: 'headsUp',
        text: 'The badge still shows the frequency’s name. A weekly property with a 10-day interval reads **WEEKLY** but comes due every 10 days.',
      },
    ],
    related: ['cadence-and-due'],
  },
  {
    key: 'planned-day',
    section: 'planning',
    title: 'Giving a stop a day',
    summary: 'A planned day sorts a stop under that day. It’s a plan, not a rule.',
    where: 'Schedule → a route → the day on a stop, or ⋯ → Select stops → Day',
    body: [
      {
        kind: 'p',
        text: 'Tap the day on a stop (or **+ Day**) to plan it for a day that week. Crew can still do it any day; the day it’s really finished is what gets recorded.',
      },
      {
        kind: 'list',
        items: [
          'A route’s stops split into day lanes once the route runs **two or more days**, or any of its stops has a day.',
          'Stops with no day sit under **Any day**.',
          'A day the route doesn’t normally run gets its own lane, marked **· not a route day**.',
          'A property that isn’t scheduled yet has no day to set. Schedule it first.',
        ],
      },
      {
        kind: 'p',
        text: 'Day changes work offline, and the “Moved to Tue.” message has **Undo**.',
      },
    ],
    related: ['generate-picks-days', 'plan-tomorrow', 'carried-over', 'route-days-dont-move-stops'],
    tour: 'tour.schedule',
  },
  {
    key: 'generate-picks-days',
    section: 'planning',
    title: 'How Generate picks each stop’s day',
    summary: 'The weekday it was last finished, if the route runs that day. Otherwise Any day.',
    where: 'Schedule → Generate week…',
    body: [
      {
        kind: 'p',
        text: 'Generate gives each new stop the **weekday the property was last finished**, as long as its route runs on that day. If not, or if it’s never been visited, the stop goes to Any day.',
      },
      {
        kind: 'example',
        text: 'On a route that runs more than one day, the preview shows how the stops will split, like **Mon 4 · Tue 3 · Any 1**.',
      },
    ],
    related: ['generate-week', 'planned-day'],
  },
  {
    key: 'carried-over',
    section: 'planning',
    title: 'Carried over',
    summary: 'A stop planned for an earlier day that nobody has started.',
    body: [
      {
        kind: 'p',
        text: 'Nothing moves on its own. A stop planned for Monday that wasn’t done stays on Monday, and the app marks it **carried over** until someone starts it, finishes it, skips it or moves it.',
      },
      {
        kind: 'list',
        items: [
          'Today’s route cards show **Carried over · N**.',
          'Plan tomorrow lists carried-over stops so you can move them in one go.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'If the stop’s route doesn’t run today, it won’t appear under Running today at all. Check Week, or use Plan tomorrow.',
      },
    ],
    related: ['plan-tomorrow', 'running-today', 'planned-day'],
  },
  {
    key: 'plan-tomorrow',
    section: 'planning',
    title: 'Plan tomorrow',
    summary: 'Put the week’s leftover stops on today or tomorrow in one sheet.',
    where: 'Schedule → Today → Plan tomorrow',
    body: [
      {
        kind: 'p',
        text: 'The sheet lists this week’s stops that haven’t been started and have **no day**, are **carried over**, or are already on the day you’re planning. The most overdue come first, and routes that run that day are at the top.',
      },
      {
        kind: 'list',
        items: [
          'Switch between **Today** and **Tomorrow** at the top.',
          'Tick stops to put them on that day. The message after saving has **Undo**.',
          'On Sunday the button reads **Plan today**, since tomorrow is next week.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'It only lists stops that already exist. Generate the week first, or properties that are due won’t be there.',
      },
      {
        kind: 'headsUp',
        text: 'Unticking a stop that was already on that day sends it to **Any day**, not back to the day it had before.',
      },
      {
        kind: 'p',
        text: 'Plan tomorrow ignores the schedule filters. Running today follows them.',
      },
    ],
    related: ['carried-over', 'generate-week', 'planned-day'],
  },
  {
    key: 'crew-instruction',
    section: 'planning',
    title: 'Crew instruction',
    summary: 'A note for one stop in one week: the old sheet’s orange cell.',
    where: 'Schedule → a stop → Visit Plan → Crew Instruction pencil',
    body: [
      {
        kind: 'p',
        text: 'Use it for something crew need to know **this time only**, like “back gate is open Tuesday”. It shows in terracotta on the stop and in the route’s list.',
      },
      {
        kind: 'headsUp',
        text: 'It’s **never copied to next week**. For something that applies every visit, use the property’s Crew Notes instead.',
      },
      {
        kind: 'p',
        text: 'It works offline. Once the stop is finished or skipped, the crew instruction, crew and truck are locked.',
      },
    ],
    related: ['four-kinds-of-notes', 'week-notes'],
    tour: 'tour.schedule',
  },
  {
    key: 'assign-one-stop',
    section: 'planning',
    title: 'Crew and truck on one stop',
    summary: 'Set who’s on a single stop and which truck it uses.',
    where: 'Schedule → a stop → Visit Plan → Assigned Crew → Manage, and Vehicle',
    body: [
      {
        kind: 'p',
        text: 'Changes to one stop work offline. A stop’s own crew and truck always win over the route’s regulars.',
      },
      {
        kind: 'p',
        text: 'Crew can change these too, so they can fix who’s on a stop from the field.',
      },
    ],
    related: ['route-crew-and-truck', 'select-stops', 'who-gets-credit'],
  },
  {
    key: 'route-crew-and-truck',
    section: 'planning',
    title: 'Crew and Truck for a whole route',
    summary: 'Set one crew or one truck on every stop of a route this week.',
    where: 'Schedule → a route → bottom bar → Crew / Truck',
    body: [
      {
        kind: 'p',
        text: 'These change **this week’s scheduled stops** on the route, including ones someone is on right now. Finished and skipped stops keep their history.',
      },
      {
        kind: 'list',
        items: [
          '**Crew** replaces the crew on every one of those stops. It starts with everyone on any of them ticked.',
          '**Truck** saves the moment you tap one. There’s no confirm and no Undo.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'This doesn’t change the route’s **regular crew** or **truck**. Next time you generate a week, it uses the old ones. Change them in Route defaults.',
      },
      {
        kind: 'p',
        text: 'Both need a connection. You can still change one stop offline.',
      },
    ],
    related: ['route-defaults', 'assign-one-stop', 'select-stops'],
    tour: 'tour.schedule',
  },
  {
    key: 'select-stops',
    section: 'planning',
    title: 'Select stops',
    summary: 'Change crew, truck, day or status on several stops at once.',
    where: 'Schedule → a route → ⋯ → Select stops',
    body: [
      {
        kind: 'p',
        text: 'Tick the stops, then choose **Crew**, **Truck**, **Day**, **Schedule** or **Skip**. Most results have **Undo**.',
      },
      {
        kind: 'list',
        items: [
          '**Crew** adds one person to every selected stop. It doesn’t remove anyone.',
          '**Skip** only skips stops that are still scheduled.',
          'Crew, Truck and Day also change finished and skipped stops if you’ve ticked them.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'If you pick Crew, Truck or Day for a property that isn’t scheduled, it gets **scheduled first**. Undo puts the crew, truck or day back, but the stop stays on the week.',
      },
    ],
    related: ['route-crew-and-truck', 'planned-day', 'taking-a-stop-off'],
    tour: 'tour.schedule',
  },
  {
    key: 'week-notes',
    section: 'planning',
    title: 'Week notes',
    summary: 'A note on a route for one week, read by everyone working it.',
    where: 'Schedule → a route → bottom bar → Add note',
    body: [
      {
        kind: 'p',
        text: 'For the week as a whole, like “no Ryan till Thursday”. It shows across the top of the route and on Today’s route card.',
      },
      {
        kind: 'p',
        text: 'Clear the text and save to remove it. Notes work offline.',
      },
      {
        kind: 'headsUp',
        text: 'Week notes don’t update live. Other phones pick up a new note the next time they load the schedule, not the moment you save it.',
      },
    ],
    related: ['four-kinds-of-notes', 'crew-instruction'],
  },
  {
    key: 'taking-a-stop-off',
    section: 'planning',
    title: 'Putting a stop on, and taking it off',
    summary: 'Tapping + Schedule adds a stop at once. There’s no delete; skip it instead.',
    where: 'Schedule → a route → + Schedule on a property',
    body: [
      {
        kind: 'p',
        text: 'Tapping a property that isn’t scheduled puts it on the week straight away and opens it. On a laptop, **S** does the same for the highlighted property.',
      },
      {
        kind: 'headsUp',
        text: 'There’s **no way to delete a stop**. If it shouldn’t happen, skip it. That also tells everyone it was decided, not forgotten.',
      },
      {
        kind: 'p',
        text: 'Stops you add by hand don’t get the route’s truck or regular crew. Only Generate fills those in.',
      },
    ],
    related: ['skipping', 'generate-week', 'select-stops'],
  },

  // ─── Routes ───────────────────────────────────────────────────────────────────
  {
    key: 'what-a-route-is',
    section: 'routes',
    title: 'What a route is',
    summary: 'A named cluster of properties one crew drives together.',
    where: 'Routes',
    body: [
      {
        kind: 'p',
        text: 'Each route has its properties in drive order, plus its usual **days**, **truck** and **regular crew**. The Routes page lists them in the same order as the schedule.',
      },
    ],
    related: ['route-defaults', 'drive-order', 'one-route-per-property'],
    tour: 'tour.routes',
  },
  {
    key: 'route-defaults',
    section: 'routes',
    title: 'Route defaults: days, truck, regular crew',
    summary: 'They fill in new stops when you generate a week. Nothing else.',
    roles: OFFICE,
    where: 'Routes → a route → Set crew, truck and days →, or ⋯ → Route defaults…',
    body: [
      {
        kind: 'list',
        items: [
          '**Truck** and **Regular crew** are put on each stop Generate creates.',
          '**Days** label the route, decide what shows under Running today, and help Generate pick each stop’s day.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'Changing defaults **never changes stops already on the schedule**. A stop’s own crew and truck always win.',
      },
      {
        kind: 'headsUp',
        text: 'Regular crew isn’t a fallback. A scheduled stop with nobody on it counts as **without crew**, even if the route has regulars.',
      },
      {
        kind: 'p',
        text: 'Stops added by hand get none of these. Route defaults need a connection.',
      },
    ],
    related: ['route-days-dont-move-stops', 'generate-week', 'route-crew-and-truck'],
    tour: 'tour.routes',
  },
  {
    key: 'route-days-dont-move-stops',
    section: 'routes',
    title: 'Route days don’t move stops',
    summary: 'A route’s days label the plan. Changing them never moves a stop to another day.',
    roles: OFFICE,
    where: 'Routes → a route → Set crew, truck and days →',
    body: [
      { kind: 'p', text: 'A route’s **Days** do three things:' },
      {
        kind: 'list',
        items: [
          'They show on the route, so everyone knows when it usually runs.',
          'They decide which routes appear under **Running today** on Today.',
          'When you generate a week, they help pre-fill each stop’s day.',
        ],
      },
      {
        kind: 'headsUp',
        text: 'Changing a route’s days doesn’t change any stop that’s already scheduled. To move stops, change their day on the stop itself, with Select stops → Day, or with Plan tomorrow.',
      },
      {
        kind: 'example',
        text: 'You switch a route from Mon/Tue to Wed/Thu. This week’s stops planned for Monday stay on Monday until you move them.',
      },
    ],
    related: ['route-defaults', 'planned-day', 'running-today'],
  },
  {
    key: 'drive-order',
    section: 'routes',
    title: 'Drive order',
    summary: 'Stops run top to bottom, the same order the schedule lists them.',
    roles: OFFICE,
    where: 'Routes → a route → ⇅ → Move here',
    body: [
      {
        kind: 'p',
        text: 'Tap ⇅ on a stop to lift it, then tap a **Move here** spot. Reordering works offline.',
      },
      {
        kind: 'p',
        text: 'The app doesn’t use maps to order stops. The order is whatever you set here.',
      },
    ],
    related: ['drive-order-or-priority', 'what-a-route-is'],
    tour: 'tour.routes',
  },
  {
    key: 'one-route-per-property',
    section: 'routes',
    title: 'One route per property',
    summary: 'Putting a property on a route moves it off any other.',
    roles: OFFICE,
    where: 'Routes → Manage properties, or an account’s property → Put on a route / Change route',
    body: [
      {
        kind: 'p',
        text: 'A property can only be on one route. Adding it to a second asks first (“Move to …?”), then moves it.',
      },
      {
        kind: 'headsUp',
        text: 'Its stops follow it, in **every week, including past ones**, with their crew, truck and day. Old weeks then show the stop under its new route.',
      },
    ],
    related: ['unrouted-properties', 'what-a-route-is'],
  },
  {
    key: 'unrouted-properties',
    section: 'routes',
    title: 'Properties not on a route',
    summary: 'They still get scheduled, just without a route’s days, truck or crew.',
    roles: OFFICE,
    where: 'Routes → Not on a route, or Schedule → Not on a route → Route all N',
    body: [
      {
        kind: 'p',
        text: 'A property on no route still shows on the schedule under **Not on a route**, and Generate still schedules it when it’s due. It just gets no truck, crew or day from a route.',
      },
      {
        kind: 'list',
        items: [
          'Routing one property works offline. Several at once needs a connection.',
          'Filtering the schedule to one route hides the Not on a route group.',
        ],
      },
      {
        kind: 'p',
        text: 'The Routes badge counts every property not on a route, including those on inactive or prospective accounts. It updates about once a minute.',
      },
    ],
    related: ['one-route-per-property', 'generate-week'],
    tour: 'tour.routes',
  },
  {
    key: 'deleting-a-route',
    section: 'routes',
    title: 'Deleting a route',
    summary: 'Its stops stay. Its properties become “Not on a route”.',
    roles: OFFICE,
    where: 'Routes → a route → ⋯ → Delete route',
    body: [
      {
        kind: 'p',
        text: 'Nothing on the schedule is deleted. Its properties and their stops move to Not on a route.',
      },
      {
        kind: 'headsUp',
        text: 'The route’s **regular crew** and **week notes** are deleted with it.',
      },
    ],
    related: ['unrouted-properties'],
  },

  // ─── Doing the work ───────────────────────────────────────────────────────────
  {
    key: 'start-finish-skip',
    section: 'stops',
    title: 'Start, Finish and Skip',
    summary: 'Start runs the on-site clock. Finish logs the work. Skip says it didn’t happen.',
    roles: FIELD,
    where: 'A stop → Start / Finish / Skip',
    body: [
      {
        kind: 'list',
        items: [
          '**Start** begins the on-site clock. The stop shows “On site” to everyone. Start turns into **Discard**, which clears the start if you tapped it by mistake.',
          '**Finish** opens Log Completion. The stop isn’t done until that’s saved.',
          '**Skip** marks it as not done this week.',
        ],
      },
      {
        kind: 'p',
        text: 'If you’re not on a stop yet, starting, finishing or skipping it adds you to it.',
      },
      { kind: 'p', text: 'All three work with no signal.' },
    ],
    related: ['log-completion', 'skipping', 'works-with-no-signal'],
  },
  {
    key: 'log-completion',
    section: 'stops',
    title: 'Logging a completion',
    summary: 'Times, who was on site, and what you did. Photos and a note are optional.',
    roles: FIELD,
    where: 'A stop → Finish → Log Completion',
    body: [
      {
        kind: 'list',
        items: [
          '**Start time** and **End time** must be inside the stop’s week, and not in the future.',
          '**Who was on site?** needs at least one person. It starts with whoever is on the stop.',
          '**Services performed** needs at least one.',
        ],
      },
      {
        kind: 'p',
        text: 'If nobody tapped Start, the start time fills in the same as the end time. Change it if the time on site matters.',
      },
      {
        kind: 'headsUp',
        text: 'Work that ran into the next week can’t be logged on its real date: the times stop at that week’s Sunday.',
      },
      {
        kind: 'p',
        text: 'To change a completion later, open the stop and tap **Edit**.',
      },
    ],
    related: ['who-gets-credit', 'photos', 'start-finish-skip'],
  },
  {
    key: 'skipping',
    section: 'stops',
    title: 'Skipping a stop',
    summary: 'The work didn’t happen this week. A reason helps the office.',
    roles: FIELD,
    where: 'A stop → Skip → Skip this stop?',
    body: [
      {
        kind: 'list',
        items: [
          'The reason is optional, but it shows to the office under Needs you.',
          'Skipping a stop someone is on stops the on-site clock.',
          'You can still skip a stop that was finished, and finish a skipped one. Finishing it un-skips it.',
        ],
      },
      {
        kind: 'p',
        text: 'A stop skipped before anyone started it doesn’t count as a visit, so the property stays due.',
      },
    ],
    related: ['cadence-and-due', 'needs-you', 'taking-a-stop-off'],
  },
  {
    key: 'who-gets-credit',
    section: 'stops',
    title: 'Who gets credit',
    summary: 'Whoever was on site, not whoever was assigned.',
    body: [
      {
        kind: 'p',
        text: 'Before a stop is done, lists show who’s **assigned**. Once it’s finished, they show who was **on site**, from Log Completion. The two are never mixed.',
      },
      {
        kind: 'p',
        text: 'Reports count each person who was on site, week by week.',
      },
      {
        kind: 'example',
        text: 'Sam was assigned, but Alex did the job and was ticked under Who was on site?. The stop shows Alex, and Alex gets the visit.',
      },
    ],
    related: ['log-completion', 'assign-one-stop'],
  },
  {
    key: 'fixing-the-plan-on-site',
    section: 'stops',
    title: 'Fixing the plan from the field',
    summary: 'You can change who’s on a stop and which vehicle it uses.',
    roles: ['crew'],
    where: 'A stop → Visit Plan → Assigned Crew → Manage, and Vehicle',
    body: [
      {
        kind: 'p',
        text: 'If the plan is wrong, fix it on the stop: add or remove people (yourself included) and change the vehicle. It works offline.',
      },
      {
        kind: 'p',
        text: 'The crew instruction is set by the office. Once a stop is finished or skipped, its plan is locked.',
      },
    ],
    related: ['who-gets-credit', 'four-kinds-of-notes'],
  },
  {
    key: 'four-kinds-of-notes',
    section: 'stops',
    title: 'The four kinds of notes',
    summary: 'One for this visit, standing notes for every visit, one for the week, and one back from crew.',
    body: [
      {
        kind: 'list',
        items: [
          '**Crew Instruction:** this stop, this week only. Set by the office, shown in terracotta, never copied forward.',
          '**Access, Crew Notes, Parking:** standing notes on the property, shown on every visit under **Property Notes**.',
          '**Week note:** across the top of a route, for everyone working it that week.',
          '**Completion note:** what crew write back when logging the stop.',
        ],
      },
      {
        kind: 'p',
        text: 'Account notes are for the office only. Crew never see them.',
      },
    ],
    related: ['crew-instruction', 'week-notes', 'log-completion'],
  },
  {
    key: 'photos',
    section: 'stops',
    title: 'Photos on a stop',
    summary: 'Add photos when you log a stop. They upload when you have signal.',
    roles: FIELD,
    where: 'A stop → Finish → Log Completion → photos',
    body: [
      {
        kind: 'p',
        text: 'Photos taken while logging are saved on your phone and upload once you’re back in service. Tap one to add a caption. Crew can caption their own photos; owners and leads can caption any.',
      },
      {
        kind: 'p',
        text: 'Photos of the property from earlier visits, and how-to photos, are under **Property Notes**.',
      },
      {
        kind: 'p',
        text: 'The office can add reference photos to a stop’s Visit Plan. Adding those needs a connection.',
      },
    ],
    related: ['log-completion', 'what-works-offline'],
  },
  {
    key: 'reverting-a-stop',
    section: 'stops',
    title: 'Setting a stop back to Scheduled',
    summary: 'Undo a finish or a skip from the stop’s Status.',
    roles: OFFICE,
    where: 'A stop → Status → Scheduled',
    body: [
      {
        kind: 'p',
        text: 'Choosing **Scheduled** clears the status and any skip reason. Choosing Completed or Skipped opens Log Completion or Skip, the same as crew see.',
      },
      {
        kind: 'headsUp',
        text: 'Setting it back keeps the services and completion note that were logged. If the stop is finished again, Log Completion starts with them filled in.',
      },
    ],
    related: ['skipping', 'log-completion'],
    tour: 'tour.schedule',
  },

  // ─── Offline & sync ───────────────────────────────────────────────────────────
  {
    key: 'what-works-offline',
    section: 'offline',
    title: 'What works offline',
    summary: 'Everything you do on a stop.',
    roles: FIELD,
    body: [
      {
        kind: 'list',
        items: [
          'Start, Finish, Skip, Discard, and editing a completion',
          'Photos and captions',
          'Who’s on a stop, and its vehicle',
        ],
      },
      {
        kind: 'p',
        text: 'Changes sync when you’re back online, when you open the app, or with your next change. The strip at the top says **You’re offline** or **Syncing N changes…** while they’re waiting.',
      },
    ],
    related: ['what-needs-a-connection', 'changes-didnt-save', 'cached-data'],
  },
  {
    key: 'what-needs-a-connection',
    section: 'offline',
    title: 'Planning with no signal',
    summary: 'Most planning works offline. Changes that replace a whole set at once don’t.',
    roles: OFFICE,
    body: [
      { kind: 'p', text: '**Works offline:**' },
      {
        kind: 'list',
        items: [
          'Scheduling a property, and generating a week',
          'A stop’s day, crew, truck and crew instruction',
          'Week notes',
          'A property’s notes and service interval',
          'Putting one property on a route, and reordering a route',
        ],
      },
      { kind: 'p', text: '**Needs a connection:**' },
      {
        kind: 'list',
        items: [
          'Crew and Truck for a whole route',
          'Route defaults',
          'Putting several properties on a route at once',
          'Creating, renaming, reordering or deleting a route',
          'A property’s address and frequency',
          'Reference photos on a stop’s Visit Plan',
          'Billing, Leads, Team, Reports, Fleet and the Activity log',
        ],
      },
      {
        kind: 'p',
        text: 'These say they need a connection instead of saving, because replaying them later could undo someone else’s change.',
      },
    ],
    related: ['what-works-offline', 'route-crew-and-truck', 'changes-didnt-save'],
  },
  {
    key: 'changes-didnt-save',
    section: 'offline',
    title: 'Changes that didn’t save',
    summary: 'A change that keeps failing stops retrying and waits for you.',
    roles: FIELD,
    where: 'The strip at the top → N changes didn’t save → Review',
    body: [
      {
        kind: 'p',
        text: 'A change is set aside after **5 failed tries**, or at once if it isn’t allowed. Review shows each one:',
      },
      {
        kind: 'list',
        items: [
          '**Try again** sends it once more.',
          '**Discard** drops it. Log it again if it still needs doing.',
        ],
      },
      {
        kind: 'p',
        text: 'If it still won’t save, ask an owner to check it.',
      },
    ],
    related: ['what-works-offline', 'signing-out-with-changes'],
  },
  {
    key: 'signing-out-with-changes',
    section: 'offline',
    title: 'Signing out with changes waiting',
    summary: 'Changes that haven’t synced stay on the phone.',
    roles: FIELD,
    body: [
      {
        kind: 'headsUp',
        text: 'Signing out doesn’t throw away changes that haven’t synced. They stay on the phone and sync under **whoever signs in next** on it. Let them sync before handing a phone to someone else.',
      },
    ],
    related: ['changes-didnt-save'],
  },
  {
    key: 'cached-data',
    section: 'offline',
    title: 'Your last saved copy',
    summary: 'With no signal you see what the app last loaded, marked as such.',
    body: [
      {
        kind: 'p',
        text: '“Showing your last saved copy — changes sync when you’re back online.” means you’re looking at what the app loaded last time. You can keep working from it.',
      },
      {
        kind: 'p',
        text: 'Offline, Today says **Last seen on site at h:mm** instead of running a clock it can’t update.',
      },
    ],
    related: ['live-updates', 'what-works-offline'],
  },
  {
    key: 'live-updates',
    section: 'offline',
    title: 'What updates live',
    summary: 'Stops and who’s on them update without a refresh. Routes and notes don’t.',
    body: [
      {
        kind: 'list',
        items: [
          'Live: Start, Finish, Skip, crew instructions and crew changes on stops you’re looking at, and new stops this week.',
          'Not live: week notes, routes and route defaults, and new stops in other weeks. Reopen the app to see them.',
          '**Your schedule was updated.** appears when someone changes which stops you’re on.',
        ],
      },
      {
        kind: 'p',
        text: 'Live updates only arrive while the app is open. Nobody gets a text or a notification.',
      },
    ],
    related: ['cached-data'],
  },
  {
    key: 'offline-timestamps',
    section: 'offline',
    title: 'Times on work logged with no signal',
    summary: 'The stop keeps the times crew entered. The Activity log shows when it synced.',
    roles: OFFICE,
    body: [
      {
        kind: 'p',
        text: 'A stop logged offline keeps the start and end times from Log Completion. The Activity log stamps the change when it reached the server, which can be hours later.',
      },
      {
        kind: 'p',
        text: 'On-site status is only as fresh as the crew member’s signal. A crew member with no service still looks on site until their Finish syncs.',
      },
    ],
    related: ['log-completion', 'cached-data'],
  },

  // ─── Billing & invoicing ──────────────────────────────────────────────────────
  {
    key: 'invoiced-is-not-sent',
    section: 'billing',
    title: '“Invoiced” isn’t “sent”',
    summary: 'Pushing to QuickBooks creates the invoice there. The customer gets nothing until it’s sent from QuickBooks.',
    where: 'Billing → Queue',
    body: [
      {
        kind: 'p',
        text: 'When you push visits from the Billing Queue, the app creates the invoice in QuickBooks and the visits leave the queue.',
      },
      {
        kind: 'headsUp',
        text: 'The app **never emails the customer**. The invoice shows as **Draft** until someone sends it from QuickBooks. After that its status here changes to Sent, then Paid.',
      },
    ],
  },
]

const sectionByKey = new Map(HELP_SECTIONS.map((s) => [s.key, s]))

export function topicRoles(topic: HelpTopic): HelpRoles {
  return topic.roles ?? sectionByKey.get(topic.section)?.roles ?? []
}

/** The sections and topics a role should see. Empty sections are dropped. */
export function helpFor(role: EmployeeRole | null): {
  sections: HelpSection[]
  topics: HelpTopic[]
} {
  if (!role) return { sections: [], topics: [] }
  const topics = HELP_TOPICS.filter(
    (t) => sectionByKey.get(t.section)?.roles.includes(role) && topicRoles(t).includes(role),
  )
  const sections = HELP_SECTIONS.filter(
    (s) => s.roles.includes(role) && topics.some((t) => t.section === s.key),
  )
  return { sections, topics }
}

export function findHelpTopic(key: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.key === key)
}

/** Plain text of a topic, for search. */
export function topicText(topic: HelpTopic): string {
  const body = topic.body.flatMap((b) => (b.kind === 'list' ? b.items : [b.text]))
  return [topic.title, topic.summary, topic.where ?? '', ...body].join(' ').replace(/\*\*/g, '')
}
