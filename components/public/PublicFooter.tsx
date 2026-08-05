import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { getPageContent, getSlot } from '@/lib/content/site'
import { PUBLIC_NAV } from '@/lib/content/routes'

/**
 * Public site footer. Every contact detail, social link, and the mission
 * line below is a `site_content` slot (page='global') — the 9.2.5 inline
 * editor makes all of it owner-editable in place, so nothing here should
 * ever become a hardcoded string again.
 */
export async function PublicFooter() {
  const content = await getPageContent('global')
  const slot = (key: string) => getSlot(content, key)

  const year = new Date().getFullYear()

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
    <footer className="border-t border-border bg-secondary/60 mt-16">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-primary" />
              <span className="font-display text-base font-semibold text-foreground">
                {slot('org_name')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{slot('org_tagline')}</p>
            <p className="text-xs text-muted-foreground">{slot('mailing_address')}</p>
          </div>

          {divisions.map((division) => (
            <div key={division.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {division.label}
              </p>
              {division.name && <p className="text-sm text-foreground">{division.name}</p>}
              {division.email && (
                <a
                  href={`mailto:${division.email}`}
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {division.email}
                </a>
              )}
              {division.phone && (
                <a
                  href={`tel:${division.phone.replace(/[^\d+]/g, '')}`}
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {division.phone}
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground border-t border-border pt-6">
          {slot('credentials_line')
            .split('·')
            .map((chip) => chip.trim())
            .filter(Boolean)
            .map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-card border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide"
              >
                {chip}
              </span>
            ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-6">
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {PUBLIC_NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>

          {/* lucide-react ships no brand/logo marks, so socials are text links
              rather than mismatched generic icons. */}
          <div className="flex items-center gap-4 text-sm">
            {slot('social_instagram') && (
              <a
                href={slot('social_instagram')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Instagram
              </a>
            )}
            {slot('social_facebook') && (
              <a
                href={slot('social_facebook')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Facebook
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            © {year} {slot('org_name')} · a {slot('parent_company')} company
          </p>
          <Link href="/login" className="hover:text-foreground">
            Staff log in
          </Link>
        </div>
      </div>
    </footer>
  )
}
