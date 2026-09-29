import type { Capabilities } from '@/lib/auth/access'
import type { EmployeeRole } from '@/types/app'
import type { TourEvent } from '@/lib/onboarding/events'

/**
 * Everything the app teaches, as data. Progress rows (onboarding_progress) only record what a
 * person has done; this file decides what exists and when it's due again.
 *
 * Upkeep when a feature changes:
 * - Copy tweak: edit it. No bump.
 * - A tour's flow changed: edit the steps and bump its `version`. Everyone gets a soft re-offer.
 * - Something new or changed that existing users should notice: add a `NEWS` item.
 * - Every `anchor` must exist as data-tour="…" in the source (npm run check:tours).
 */

type Roles = readonly EmployeeRole[]

export interface TourStep {
  id: string
  /** data-tour value. Omit for a card with no spotlight. */
  anchor?: string
  title: string
  body: string
  breakpoint?: 'mobile' | 'desktop'
  capability?: keyof Capabilities
  /** A "do it" step: Next is hidden until this event fires. */
  advanceOn?: TourEvent
  /** Skip the step when this anchor is already on screen (the thing it asks for is done). */
  skipIfVisible?: string
  /** Skip unless one of these step ids was completed (a skipped "do it" step skips its follow-ons). */
  requires?: string[]
}

export interface Tour {
  key: string
  version: number
  title: string
  summary: string
  roles: Roles
  /** Offered on this path; the runner navigates here when replayed from elsewhere. */
  route: string
  capability?: keyof Capabilities
  steps: TourStep[]
}

export interface Welcome {
  key: string
  version: number
  roles: Roles
  slides: Array<{ title: string; body: string }>
  /** Tour started by the last slide's primary button. */
  startTour?: string
}

export interface Task {
  key: string
  roles: Roles
  title: string
  hint: string
  href: string
  /** Completes on this event, or when this tour is completed. */
  doneOn: TourEvent | { tour: string }
}

export interface NewsItem {
  key: string
  roles: Roles
  /** YYYY-MM-DD. Only people active in the app before this date see it. */
  introduced: string
  title: string
  body: string
  /** Finishing this tour marks the item seen: the tour already taught it. */
  parentTour?: string
  route?: string
  /** Beacon target on `route`. Omit to list it in Help only. */
  anchor?: string
}

const OFFICE: Roles = ['owner', 'lead']

export const WELCOMES: Welcome[] = [
  {
    key: 'welcome.office',
    version: 1,
    roles: OFFICE,
    startTour: 'tour.schedule',
    slides: [
      {
        title: 'The week is the unit',
        body: 'Like the old sheet, every stop belongs to a week, not a day. Plan the week, and crew work through it.',
      },
      {
        title: 'Routes carry the plan',
        body: 'A route is a cluster of stops a crew drives together. Its days, truck and regular crew fill in every week you generate.',
      },
      {
        title: 'Accounts pay, properties get the work',
        body: 'An account is who gets the invoice. Its properties are the addresses crew visit, each with its own cadence and notes.',
      },
      {
        title: 'Works with no signal',
        body: 'Changes save on your phone and sync when you’re back in service. Nothing is lost on a back road.',
      },
    ],
  },
]

export const TOURS: Tour[] = [
  {
    key: 'tour.schedule',
    version: 1,
    title: 'Schedule',
    summary: 'Plan the week, open a stop, generate a week, change many stops at once.',
    roles: OFFICE,
    route: '/app/schedule',
    capability: 'editSchedule',
    steps: [
      {
        id: 'view',
        anchor: 'schedule.viewToggle',
        capability: 'seeDashboard',
        title: 'Today or the week',
        body: 'Today shows who’s on site and what’s left. Week is the plan. Tap Week.',
        advanceOn: 'schedule.viewWeek',
        skipIfVisible: 'schedule.routeBand',
      },
      {
        id: 'nav-mobile',
        anchor: 'schedule.weekNav',
        breakpoint: 'mobile',
        title: 'One week at a time',
        body: 'Arrows move a week. Tap the dates to jump to any week.',
      },
      {
        id: 'nav-desktop',
        anchor: 'schedule.weekNav',
        breakpoint: 'desktop',
        title: 'Four weeks side by side',
        body: 'The grid shows four weeks. Arrows slide the window; This week brings you back.',
      },
      {
        id: 'band',
        anchor: 'schedule.routeBand',
        title: 'Each route has a header',
        body: 'Crew, truck and how many stops are done. Its ⋯ menu assigns the whole route, sets its defaults, or adds a note for the week.',
      },
      {
        id: 'open-stop',
        anchor: 'schedule.stop',
        title: 'Open a stop',
        body: 'Tap any scheduled stop to see its details.',
        advanceOn: 'schedule.visitOpened',
      },
      {
        id: 'status',
        requires: ['open-stop'],
        anchor: 'visit.status',
        title: 'Status',
        body: 'Mark it done or skipped here if the crew didn’t log it themselves.',
      },
      {
        id: 'plan',
        requires: ['open-stop'],
        anchor: 'visit.plan',
        title: 'The plan for this visit',
        body: 'The crew instruction (the orange cell), who’s on it, and which truck. Changes save even without signal.',
      },
      {
        id: 'close-stop',
        requires: ['open-stop'],
        title: 'Close the stop',
        body: 'Close this sheet to keep going.',
        advanceOn: 'schedule.visitClosed',
      },
      {
        id: 'actions-mobile',
        anchor: 'schedule.actions',
        breakpoint: 'mobile',
        title: 'Week actions live in ⋯',
        body: 'Tap ⋯ to see what you can do with the whole week.',
        advanceOn: 'schedule.menuOpened',
      },
      {
        id: 'generate-mobile',
        requires: ['actions-mobile'],
        anchor: 'schedule.actionsMenu',
        breakpoint: 'mobile',
        title: 'Generate the week',
        body: 'Tap Generate week… You get a preview first. Nothing is saved until you confirm.',
        advanceOn: 'schedule.generateOpened',
      },
      {
        id: 'generate-desktop',
        anchor: 'schedule.actions',
        breakpoint: 'desktop',
        title: 'Generate the week',
        body: 'Click Generate week… for a preview of everything due. Nothing is saved until you confirm.',
        advanceOn: 'schedule.generateOpened',
      },
      {
        id: 'preview',
        requires: ['generate-mobile', 'generate-desktop'],
        anchor: 'generate.list',
        title: 'Everything that’s due',
        body: 'Grouped by route, with crew and truck from each route’s defaults. Tap a stop to leave it out.',
      },
      {
        id: 'confirm',
        requires: ['generate-mobile', 'generate-desktop'],
        anchor: 'generate.confirm',
        title: 'Confirm when it looks right',
        body: 'This creates the stops. For now, close the sheet without confirming.',
        advanceOn: 'schedule.generateClosed',
      },
      {
        id: 'select-desktop',
        anchor: 'schedule.select',
        breakpoint: 'desktop',
        title: 'Change many stops at once',
        body: 'Select stops, then set crew or truck, or skip them, all together.',
      },
      {
        id: 'select-mobile',
        anchor: 'schedule.actions',
        breakpoint: 'mobile',
        title: 'Change many stops at once',
        body: 'Select stops is in ⋯ too. Tick several, then set crew or truck, or skip them together.',
      },
      {
        id: 'filters',
        anchor: 'schedule.filters',
        title: 'Filter',
        body: 'Narrow to one route, account, crew member or status.',
      },
      {
        id: 'help-mobile',
        anchor: 'nav.more',
        breakpoint: 'mobile',
        title: 'Replay any time',
        body: 'More → Help & tours has this tour, the others, and what’s new.',
      },
      {
        id: 'help-desktop',
        anchor: 'nav.help',
        breakpoint: 'desktop',
        title: 'Replay any time',
        body: 'Help & tours has this tour, the others, and what’s new.',
      },
    ],
  },
  {
    key: 'tour.routes',
    version: 1,
    title: 'Routes',
    summary: 'Route groups, their standing plan, drive order, and unrouted properties.',
    roles: OFFICE,
    route: '/app/routes',
    capability: 'editRoutes',
    steps: [
      {
        id: 'unrouted',
        anchor: 'routes.unrouted',
        title: 'Not on a route',
        body: 'These properties are left out when you generate a week. Pick a route for each.',
      },
      {
        id: 'card',
        anchor: 'routes.card',
        title: 'A route group',
        body: 'A cluster of stops one crew drives together.',
      },
      {
        id: 'defaults',
        anchor: 'routes.defaults',
        title: 'The standing plan',
        body: 'Days, truck and regular crew. Generated weeks start from these; any single visit can still differ.',
      },
      {
        id: 'stops',
        anchor: 'routes.stops',
        title: 'Drive order',
        body: 'Stops run top to bottom, the same order the schedule lists them.',
      },
      {
        id: 'menu',
        anchor: 'routes.groupMenu',
        title: 'Tap ⋯',
        body: 'Each route has its own menu.',
        advanceOn: 'routes.groupMenuOpened',
      },
      {
        id: 'menu-content',
        requires: ['menu'],
        anchor: 'routes.groupMenuContent',
        title: 'Reorder, defaults, delete',
        body: 'Move routes up or down the list, set defaults, or delete a route.',
      },
      {
        id: 'new',
        anchor: 'routes.newGroup',
        title: 'New route group',
        body: 'Start a new cluster when you pick up work in a new area.',
      },
    ],
  },
  {
    key: 'tour.accounts',
    version: 1,
    title: 'Accounts',
    summary: 'Find and add accounts, properties, routes and photos.',
    roles: OFFICE,
    route: '/app/accounts',
    capability: 'editAccounts',
    steps: [
      {
        id: 'search',
        anchor: 'accounts.search',
        title: 'Find an account',
        body: 'Search by account or contact name, or filter by status.',
      },
      {
        id: 'new',
        anchor: 'accounts.new',
        title: 'Add an account',
        body: 'Who gets the invoice. Per-visit accounts need a price.',
      },
      {
        id: 'open',
        anchor: 'accounts.list',
        title: 'Open an account',
        body: 'Tap any account.',
        advanceOn: 'accounts.accountOpened',
      },
      {
        id: 'header',
        requires: ['open'],
        anchor: 'account.header',
        title: 'The account',
        body: 'Edit contact and billing here. Archiving (owners only) hides it but keeps its history.',
      },
      {
        id: 'properties',
        requires: ['open'],
        anchor: 'account.properties',
        title: 'Properties get the work',
        body: 'An account can have several. Each has its own cadence and crew notes.',
      },
      {
        id: 'route',
        requires: ['open'],
        anchor: 'account.route',
        capability: 'editRoutes',
        title: 'Is it on a route?',
        body: 'A property only gets scheduled once it’s on a route. Change it right here.',
      },
      {
        id: 'tabs',
        requires: ['open'],
        anchor: 'account.tabs',
        title: 'Photos',
        body: 'How-to and customer photos for every property on the account.',
      },
    ],
  },
]

export const TASKS: Task[] = [
  {
    key: 'task.scheduleTour',
    roles: OFFICE,
    title: 'Take the schedule tour',
    hint: 'Two minutes, on your real schedule.',
    href: '/app/schedule',
    doneOn: { tour: 'tour.schedule' },
  },
  {
    key: 'task.generateWeek',
    roles: OFFICE,
    title: 'Generate a week',
    hint: 'Schedule → Week → Generate week…',
    href: '/app/schedule',
    doneOn: 'schedule.weekGenerated',
  },
  {
    key: 'task.assignCrew',
    roles: OFFICE,
    title: 'Put crew on a stop',
    hint: 'Open a stop, or use a route’s ⋯ → Assign route…',
    href: '/app/schedule',
    doneOn: 'schedule.crewAssigned',
  },
  {
    key: 'task.routeDefaults',
    roles: OFFICE,
    title: 'Set a route’s defaults',
    hint: 'Routes → a route’s days, truck and crew line.',
    href: '/app/routes',
    doneOn: 'routes.defaultsSaved',
  },
  {
    key: 'task.routeProperty',
    roles: OFFICE,
    title: 'Put a property on a route',
    hint: 'Routes → Not on a route, or from an account.',
    href: '/app/routes',
    doneOn: 'routes.propertyRouted',
  },
  {
    key: 'task.addAccount',
    roles: OFFICE,
    title: 'Add an account',
    hint: 'Accounts → New.',
    href: '/app/accounts',
    doneOn: 'accounts.created',
  },
]

/** Newest last. See the upkeep note at the top of this file. */
export const NEWS: NewsItem[] = []

export function forRole<T extends { roles: Roles }>(items: T[], role: EmployeeRole | null): T[] {
  return role ? items.filter((item) => item.roles.includes(role)) : []
}

export function findTour(key: string): Tour | undefined {
  return TOURS.find((tour) => tour.key === key)
}
