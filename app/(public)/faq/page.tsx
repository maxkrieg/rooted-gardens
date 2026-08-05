import Link from 'next/link'
import type { Metadata } from 'next'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'
import type { FaqItemData } from '@/types/app'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('faq')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/**
 * 9.2 shell for the FAQ page — the `faq` collection rendered as stacked
 * cards. 9.4 upgrades this to a shadcn `accordion` (added via CLI in that
 * task, not here) without touching the data layer.
 */
export default async function FaqPage() {
  const [content, faqs] = await Promise.all([getPageContent('faq'), getCollection<FaqItemData>('faq')])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {getSlot(content, 'heading')}
      </h1>
      <p className="mt-4 text-base text-muted-foreground leading-relaxed">{getSlot(content, 'intro')}</p>

      {faqs.length > 0 && (
        <div className="mt-10 space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="rounded-2xl border border-border bg-card shadow-warm p-5">
              <p className="font-display text-base font-semibold text-foreground">{faq.data.question}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{faq.data.answer}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/contact">Ask us directly</Link>
        </Button>
      </div>
    </div>
  )
}
