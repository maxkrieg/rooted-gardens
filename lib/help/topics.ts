import type { EmployeeRole } from '@/types/app'

/**
 * The Help guide's content, as data. No React or Supabase here: ⌘K and the check script import it.
 * When a rule documented here changes, update its topic in the same change.
 */

type HelpRoles = readonly EmployeeRole[]

const ALL: HelpRoles = ['owner', 'lead', 'crew', 'accountant']
const OFFICE: HelpRoles = ['owner', 'lead']
const OFFICE_AND_BOOKS: HelpRoles = ['owner', 'lead', 'accountant']

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
    tour: 'tour.schedule',
  },
  {
    key: 'route-days-dont-move-stops',
    section: 'routes',
    title: 'Route days don’t move stops',
    summary: 'A route’s days label the plan. Changing them never moves a stop to another day.',
    where: 'Routes → a route card → Set crew, truck and days',
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
  },
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
