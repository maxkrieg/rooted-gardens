import type { Metadata } from 'next'
import { getPageContent, getSlot } from '@/lib/content/site'

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
      name: slot('lawn_contact_name'),
      email: slot('lawn_contact_email'),
      phone: slot('lawn_contact_phone'),
    },
    {
      label: 'Gardens',
      name: slot('garden_contact_name'),
      email: slot('garden_contact_email'),
      phone: slot('garden_contact_phone'),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {slot('heading')}
      </h1>
      <p className="mt-4 text-base text-muted-foreground leading-relaxed">{slot('intro')}</p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {divisions.map((division) => (
          <div key={division.label} className="rounded-2xl border border-border bg-card shadow-warm p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {division.label}
            </p>
            {division.name && <p className="font-display text-lg font-semibold text-foreground mt-1">{division.name}</p>}
            <div className="mt-2 space-y-1 text-sm">
              {division.email && (
                <a href={`mailto:${division.email}`} className="block text-primary hover:underline">
                  {division.email}
                </a>
              )}
              {division.phone && (
                <a
                  href={`tel:${division.phone.replace(/[^\d+]/g, '')}`}
                  className="block text-muted-foreground hover:text-foreground"
                >
                  {division.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
