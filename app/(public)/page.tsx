import Link from 'next/link'
import type { Metadata } from 'next'
import { Leaf, Sprout } from 'lucide-react'
import { getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'

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
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground tracking-tight max-w-3xl mx-auto text-balance">
          {getSlot(home, 'hero_heading')}
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {getSlot(home, 'hero_body')}
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/contact">{getSlot(home, 'cta_label')}</Link>
          </Button>
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
