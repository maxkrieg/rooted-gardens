import Link from 'next/link'
import type { Metadata } from 'next'
import { Leaf, Sprout } from 'lucide-react'
import { getPageContent, getSlot } from '@/lib/content/site'
import { EditableText } from '@/components/public/editing/EditableText'
import { EditableRichText } from '@/components/public/editing/EditableRichText'
import { EditableCtaButton } from '@/components/public/editing/EditableCtaButton'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('home')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/**
 * Marketing home page. This is the 9.2 shell — hero + two service-line
 * teasers reading straight from `site_content` — that 9.3 expands into the
 * full landing page (ELA badge, Field Notes teaser, etc).
 */
export default async function HomePage() {
  const [home, lawn, gardens] = await Promise.all([
    getPageContent('home'),
    getPageContent('lawn'),
    getPageContent('gardens'),
  ])

  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Norwich, VT · Upper Valley
        </p>
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

      <section className="mx-auto max-w-5xl px-4 pb-20 grid gap-5 sm:grid-cols-2">
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
    </div>
  )
}
