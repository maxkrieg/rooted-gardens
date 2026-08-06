import Link from 'next/link'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { EditableText } from '@/components/public/editing/EditableText'
import { CollectionSection } from '@/components/public/editing/CollectionSection'
import type { FaqItemData } from '@/types/app'

export const generateMetadata = () => pageMetadata('faq')

/**
 * FAQ page (task 9.4) — upgrades the 9.2 stacked-card list to a shadcn
 * `accordion` (added via `npx shadcn@latest add accordion`; see
 * components/ui/accordion.tsx). Only this page's read-only rendering
 * changes — `CollectionSection` swaps the whole block for `CollectionEditor`
 * in edit mode, so the accordion and the owner editor never conflict.
 */
export default async function FaqPage() {
  const [content, faqs] = await Promise.all([getPageContent('faq'), getCollection<FaqItemData>('faq')])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="faq"
        slotKey="heading"
        kind="text"
        value={getSlot(content, 'heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="faq"
        slotKey="intro"
        kind="text"
        value={getSlot(content, 'intro')}
        as="p"
        className="mt-4 text-base text-muted-foreground leading-relaxed"
      />

      <div className="mt-10">
        <CollectionSection collection="faq" items={faqs}>
          {faqs.length > 0 && (
            <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card shadow-warm px-5">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id} className="border-border last:border-b-0">
                  <AccordionTrigger className="font-display text-base font-semibold text-foreground hover:no-underline">
                    {faq.data.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.data.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CollectionSection>
      </div>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/contact">Ask us directly</Link>
        </Button>
      </div>
    </div>
  )
}
