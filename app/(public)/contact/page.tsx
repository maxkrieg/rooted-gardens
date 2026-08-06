import type { Metadata } from 'next'
import { getPageContent, getSlot } from '@/lib/content/site'
import { EditableText } from '@/components/public/editing/EditableText'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('contact')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/**
 * 9.2 shell for the Contact page. The inquiry form (honeypot + rate limit +
 * Server Action inserting a `leads` row) is task 9.5 — until then this page
 * gives a prospect a direct way to reach each division by phone/email
 * rather than a dead end.
 */
export default async function ContactPage() {
  const content = await getPageContent('contact')
  const slot = (key: string) => getSlot(content, key)

  const divisions = [
    {
      label: 'Lawn · Stone · Pruning',
      nameKey: 'lawn_contact_name',
      emailKey: 'lawn_contact_email',
      phoneKey: 'lawn_contact_phone',
    },
    {
      label: 'Gardens',
      nameKey: 'garden_contact_name',
      emailKey: 'garden_contact_email',
      phoneKey: 'garden_contact_phone',
    },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="contact"
        slotKey="heading"
        kind="text"
        value={slot('heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="contact"
        slotKey="intro"
        kind="text"
        value={slot('intro')}
        as="p"
        className="mt-4 text-base text-muted-foreground leading-relaxed"
      />

      {/* Division contacts are `global` slots — the same ones the footer
          edits (see PublicFooter.tsx), so an edit made from either place
          shows up on both. */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {divisions.map((division) => (
          <div key={division.label} className="rounded-2xl border border-border bg-card shadow-warm p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {division.label}
            </p>
            <EditableText
              page="global"
              slotKey={division.nameKey}
              kind="text"
              value={slot(division.nameKey)}
              as="p"
              className="font-display text-lg font-semibold text-foreground mt-1"
            />
            <div className="mt-2 space-y-1 text-sm">
              <EditableText
                page="global"
                slotKey={division.emailKey}
                kind="email"
                value={slot(division.emailKey)}
                as="p"
                href={slot(division.emailKey) ? `mailto:${slot(division.emailKey)}` : undefined}
                className="block text-primary hover:underline"
              />
              <EditableText
                page="global"
                slotKey={division.phoneKey}
                kind="phone"
                value={slot(division.phoneKey)}
                as="p"
                href={
                  slot(division.phoneKey)
                    ? `tel:${slot(division.phoneKey).replace(/[^\d+]/g, '')}`
                    : undefined
                }
                className="block text-muted-foreground hover:text-foreground"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
