import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { getPageContent, getSlot } from '@/lib/content/site'
import { PUBLIC_NAV } from '@/lib/content/routes'
import { EditableText } from '@/components/public/editing/EditableText'
import { EditableRichText } from '@/components/public/editing/EditableRichText'
import { CredentialsLine } from '@/components/public/CredentialsLine'

/**
 * Public site footer. Every contact detail, social link, and the mission
 * line below is a `site_content` slot (page='global') — the 9.2.5 inline
 * editor makes all of it owner-editable in place, so nothing here should
 * ever become a hardcoded string again. `org_name`/`parent_company` are
 * deliberately left plain (not Editable) — the root layout's title template
 * and this footer's own copyright line assume a stable brand name.
 */
export async function PublicFooter() {
  const content = await getPageContent('global')
  const slot = (key: string) => getSlot(content, key)

  const year = new Date().getFullYear()

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
            <EditableRichText
              page="global"
              slotKey="org_tagline"
              value={slot('org_tagline')}
              doc={content.slots['org_tagline']?.doc}
              className="text-sm text-muted-foreground max-w-sm leading-relaxed"
            />
            <EditableText
              page="global"
              slotKey="mailing_address"
              kind="text"
              value={slot('mailing_address')}
              as="p"
              className="text-xs text-muted-foreground"
            />
          </div>

          {divisions.map((division) => (
            <div key={division.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {division.label}
              </p>
              <EditableText
                page="global"
                slotKey={division.nameKey}
                kind="text"
                value={slot(division.nameKey)}
                as="p"
                className="text-sm text-foreground"
              />
              <EditableText
                page="global"
                slotKey={division.emailKey}
                kind="email"
                value={slot(division.emailKey)}
                as="p"
                href={slot(division.emailKey) ? `mailto:${slot(division.emailKey)}` : undefined}
                className="block text-sm text-muted-foreground hover:text-foreground"
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
                className="block text-sm text-muted-foreground hover:text-foreground"
              />
            </div>
          ))}
        </div>

        <CredentialsLine value={slot('credentials_line')} />

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
            <EditableText
              page="global"
              slotKey="social_instagram"
              kind="url"
              value={slot('social_instagram')}
              href={slot('social_instagram') || undefined}
              className="text-muted-foreground hover:text-foreground"
            />
            <EditableText
              page="global"
              slotKey="social_facebook"
              kind="url"
              value={slot('social_facebook')}
              href={slot('social_facebook') || undefined}
              className="text-muted-foreground hover:text-foreground"
            />
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
