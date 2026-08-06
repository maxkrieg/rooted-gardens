import Link from 'next/link'
import type { Metadata } from 'next'
import { getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'
import { EditableText } from '@/components/public/editing/EditableText'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('lawn')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/** 9.2 shell for the Lawn division page; 9.4 fills in the full service breakdown. */
export default async function LawnPage() {
  const content = await getPageContent('lawn')

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="lawn"
        slotKey="heading"
        kind="text"
        value={getSlot(content, 'heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="lawn"
        slotKey="intro"
        kind="text"
        value={getSlot(content, 'intro')}
        as="p"
        multiline
        className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
      />
      <div className="mt-8">
        <Button asChild>
          <Link href="/contact">Get a lawn quote</Link>
        </Button>
      </div>
    </div>
  )
}
