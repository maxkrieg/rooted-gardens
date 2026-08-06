import Link from 'next/link'
import { Leaf, Sprout } from 'lucide-react'
import { getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { EditableText } from '@/components/public/editing/EditableText'
import { EditableRichText } from '@/components/public/editing/EditableRichText'
import { EditableCtaButton } from '@/components/public/editing/EditableCtaButton'
import { EditableImageSlot } from '@/components/public/editing/EditableImageSlot'

export const generateMetadata = () => pageMetadata('home')

/**
 * Marketing home page (task 9.3). The 9.2 shell was just the hero + two
 * service-line teaser cards; this expands it into the full landing page:
 * hero, mission statement, service teasers, a services overview, the ELA
 * membership badge, a Field Notes teaser (linking out — the blog itself is
 * deferred), and a closing CTA band. Every heading/body/CTA is a `home`
 * (or `global`) `site_content` slot, editable in place via 9.2.5.
 */
export default async function HomePage() {
  const [home, lawn, gardens] = await Promise.all([
    getPageContent('home'),
    getPageContent('lawn'),
    getPageContent('gardens'),
  ])
  const heroImagePath = getSlot(home, 'hero_image') || null
  const elaUrl = getSlot(home, 'ela_url') || getSlot(home, 'blog_url')
  const blogUrl = getSlot(home, 'blog_url')

  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <EditableText
          page="home"
          slotKey="eyebrow"
          kind="text"
          value={getSlot(home, 'eyebrow')}
          as="p"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
        />
        <EditableText
          page="home"
          slotKey="hero_heading"
          kind="text"
          value={getSlot(home, 'hero_heading')}
          as="h1"
          className="font-display text-4xl sm:text-5xl font-semibold text-foreground tracking-tight max-w-3xl mx-auto text-balance"
        />
        <EditableRichText
          page="home"
          slotKey="hero_body"
          value={getSlot(home, 'hero_body')}
          doc={home.slots['hero_body']?.doc}
          className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
        />
        <div className="mt-8">
          <EditableCtaButton page="home" slotKey="cta_label" value={getSlot(home, 'cta_label')} href="/contact" size="lg" />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        <EditableImageSlot
          page="home"
          slotKey="hero_image"
          path={heroImagePath}
          scope="home-hero_image"
          alt="A Rooted Gardens property"
          className="h-56 sm:h-80 w-full rounded-2xl"
        />
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-16 grid gap-5 sm:grid-cols-2">
        <Link
          href="/lawn"
          className="group rounded-2xl border border-border bg-card shadow-warm p-6 hover:shadow-warm-lg transition-shadow"
        >
          <Leaf className="h-6 w-6 text-primary mb-3" />
          <h2 className="font-display text-xl font-semibold text-foreground mb-1.5">
            {getSlot(lawn, 'heading')}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{getSlot(lawn, 'intro')}</p>
        </Link>
        <Link
          href="/gardens"
          className="group rounded-2xl border border-border bg-card shadow-warm p-6 hover:shadow-warm-lg transition-shadow"
        >
          <Sprout className="h-6 w-6 text-[var(--clay)] mb-3" />
          <h2 className="font-display text-xl font-semibold text-foreground mb-1.5">
            {getSlot(gardens, 'heading')}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{getSlot(gardens, 'intro')}</p>
        </Link>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 text-center">
        <EditableText
          page="home"
          slotKey="mission_heading"
          kind="text"
          value={getSlot(home, 'mission_heading')}
          as="h2"
          className="font-display text-2xl sm:text-3xl font-semibold text-foreground tracking-tight"
        />
        <EditableText
          page="home"
          slotKey="mission_body"
          kind="text"
          value={getSlot(home, 'mission_body')}
          as="p"
          multiline
          className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 rounded-2xl border border-border bg-card shadow-warm p-6 sm:p-8">
        <EditableText
          page="home"
          slotKey="services_heading"
          kind="text"
          value={getSlot(home, 'services_heading')}
          as="h2"
          className="font-display text-xl font-semibold text-foreground"
        />
        <EditableText
          page="home"
          slotKey="services_body"
          kind="text"
          value={getSlot(home, 'services_body')}
          as="p"
          multiline
          className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 flex justify-center">
        <a
          href={elaUrl || undefined}
          target={elaUrl?.startsWith('http') ? '_blank' : undefined}
          rel={elaUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="rounded-full bg-card border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          <EditableText page="home" slotKey="ela_label" kind="text" value={getSlot(home, 'ela_label')} as="span" />
        </a>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 rounded-2xl border border-dashed border-border p-6 sm:p-8 text-center">
        <EditableText
          page="home"
          slotKey="notes_heading"
          kind="text"
          value={getSlot(home, 'notes_heading')}
          as="h2"
          className="font-display text-lg font-semibold text-foreground"
        />
        <EditableText
          page="home"
          slotKey="notes_body"
          kind="text"
          value={getSlot(home, 'notes_body')}
          as="p"
          className="mt-2 text-sm text-muted-foreground leading-relaxed"
        />
        <a
          href={blogUrl || undefined}
          target={blogUrl?.startsWith('http') ? '_blank' : undefined}
          rel={blogUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
        >
          <EditableText
            page="home"
            slotKey="notes_cta_label"
            kind="text"
            value={getSlot(home, 'notes_cta_label')}
            as="span"
          />
        </a>
      </section>

      <section className="bg-accent">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <EditableText
            page="home"
            slotKey="closing_heading"
            kind="text"
            value={getSlot(home, 'closing_heading')}
            as="h2"
            className="font-display text-2xl sm:text-3xl font-semibold text-[var(--accent-foreground)] tracking-tight text-balance"
          />
          <div className="mt-6">
            <EditableCtaButton
              page="home"
              slotKey="closing_cta_label"
              value={getSlot(home, 'closing_cta_label')}
              href="/contact"
              size="lg"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
