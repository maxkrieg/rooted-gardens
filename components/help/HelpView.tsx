'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CircleHelp,
  Inbox,
  Link2,
  MapPin,
  PlayCircle,
  Receipt,
  Route,
  Search,
  Sprout,
  UserCircle,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/states/EmptyState'
import { useRole } from '@/components/app/RoleProvider'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { HelpOnboardingStrip } from '@/components/help/HelpOnboardingStrip'
import { HelpTopicBody } from '@/components/help/HelpTopicBody'
import { findHelpTopic, helpFor, topicText, type HelpIcon, type HelpTopic } from '@/lib/help/topics'

const ICONS: Record<HelpIcon, LucideIcon> = {
  sprout: Sprout,
  calendar: CalendarDays,
  calendarPlus: CalendarPlus,
  route: Route,
  mapPin: MapPin,
  users: Users,
  receipt: Receipt,
  inbox: Inbox,
  userCircle: UserCircle,
  wifiOff: WifiOff,
  barChart: BarChart3,
  helpCircle: CircleHelp,
}

const topicId = (key: string) => `topic-${key}`
const sectionId = (key: string) => `section-${key}`

/** The Help guide: tours and What's new up top, then every topic this role needs, searchable. */
export function HelpView() {
  const { role } = useRole()
  const { sections, topics } = useMemo(() => helpFor(role), [role])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string[]>([])

  const searchIndex = useMemo(
    () => new Map(topics.map((t) => [t.key, topicText(t).toLowerCase()])),
    [topics],
  )
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = terms.length
    ? topics.filter((t) => terms.every((term) => searchIndex.get(t.key)?.includes(term)))
    : topics
  const visibleSections = sections.filter((s) => visible.some((t) => t.section === s.key))
  const available = useMemo(() => new Set(topics.map((t) => t.key)), [topics])

  // Open and scroll to #key, on load and whenever the hash changes (related links, ⌘K).
  const openFromHash = useCallback(() => {
    const key = decodeURIComponent(window.location.hash.slice(1))
    if (!key || !topics.some((t) => t.key === key)) return
    setQuery('')
    setOpen((prev) => (prev.includes(key) ? prev : [...prev, key]))
    requestAnimationFrame(() => {
      document.getElementById(topicId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [topics])

  useEffect(() => {
    // After the first paint: server HTML has every topic closed, so opening in render would mismatch.
    const frame = requestAnimationFrame(openFromHash)
    window.addEventListener('hashchange', openFromHash)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', openFromHash)
    }
  }, [openFromHash])

  function setSectionOpen(sectionKey: string, next: string[]) {
    const inSection = new Set(topics.filter((t) => t.section === sectionKey).map((t) => t.key))
    const added = next.find((key) => !open.includes(key))
    setOpen([...open.filter((key) => !inSection.has(key)), ...next])
    // The open topic is the shareable one; replaceState so the hash doesn't pile up history.
    if (added) window.history.replaceState(null, '', `#${added}`)
  }

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
      {/* Desktop: a sticky section index. On a phone the chips below do this job. */}
      <nav aria-label="Help sections" className="hidden lg:block">
        <ul className="sticky top-6 space-y-0.5">
          {visibleSections.map((s) => {
            const Icon = ICONS[s.icon]
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => jumpTo(sectionId(s.key))}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {s.title}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <CircleHelp className="h-5 w-5 shrink-0 text-primary" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Help</h1>
        </div>

        <HelpOnboardingStrip />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help"
            aria-label="Search help"
            className="h-11 pl-9 pr-10 text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {visibleSections.length > 1 && (
          <div className="flex flex-wrap gap-2 lg:hidden">
            {visibleSections.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => jumpTo(sectionId(s.key))}
                className="min-h-9 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            compact
            title="Nothing matches that"
            hint="Try a shorter word, like “route” or “invoice”."
          />
        ) : (
          visibleSections.map((section) => {
            const Icon = ICONS[section.icon]
            const sectionTopics = visible.filter((t) => t.section === section.key)
            return (
              <section key={section.key} id={sectionId(section.key)} className="scroll-mt-6">
                <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {section.title}
                </h2>
                <Accordion
                  type="multiple"
                  value={open.filter((key) => sectionTopics.some((t) => t.key === key))}
                  onValueChange={(next) => setSectionOpen(section.key, next)}
                >
                  {sectionTopics.map((topic) => (
                    <HelpTopicItem key={topic.key} topic={topic} available={available} />
                  ))}
                </Accordion>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function HelpTopicItem({ topic, available }: { topic: HelpTopic; available: Set<string> }) {
  const { tours, startTour } = useOnboarding()
  const tour = topic.tour ? tours.find((t) => t.key === topic.tour) : undefined
  // Only link topics this role can see.
  const related = (topic.related ?? [])
    .filter((key) => available.has(key))
    .map((key) => findHelpTopic(key))
    .filter((t): t is HelpTopic => !!t)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/help#${topic.key}`)
      toast.success('Link copied')
    } catch {
      toast.error('Couldn’t copy the link.')
    }
  }

  return (
    <AccordionItem value={topic.key} id={topicId(topic.key)} className="scroll-mt-6 border-border">
      <AccordionTrigger className="min-h-14 gap-3 py-3 text-left hover:no-underline">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold leading-snug text-foreground">
            {topic.title}
          </span>
          <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{topic.summary}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-5">
        <HelpTopicBody blocks={topic.body} />

        {topic.where && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Where: </span>
            {topic.where}
          </p>
        )}

        {related.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">Related:</span>
            {related.map((r, i) => (
              <span key={r.key}>
                <a href={`#${r.key}`} className="text-primary underline-offset-2 hover:underline">
                  {r.title}
                </a>
                {i < related.length - 1 && <span className="text-muted-foreground"> · </span>}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tour && (
            <Button variant="outline" className="h-11 gap-2" onClick={() => startTour(tour.key)}>
              <PlayCircle className="h-4 w-4" />
              Show me
            </Button>
          )}
          <Button variant="ghost" className="h-11 gap-2 text-muted-foreground" onClick={copyLink}>
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
