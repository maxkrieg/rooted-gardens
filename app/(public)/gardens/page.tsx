import { getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { EditableText } from '@/components/public/editing/EditableText'
import { EditableRichText } from '@/components/public/editing/EditableRichText'
import { EditableImageSlot } from '@/components/public/editing/EditableImageSlot'
import { EditableCtaButton } from '@/components/public/editing/EditableCtaButton'
import { SlotList } from '@/components/public/SlotList'
import { BulletList } from '@/components/public/BulletList'

export const generateMetadata = () => pageMetadata('gardens')

/**
 * Rooted Gardens (garden design/maintenance) division page (task 9.4) —
 * mirrors the shape of the Lawn page: hero photo, ecological principles
 * (SlotList), a philosophy paragraph, a services list, and the division's
 * own `global.garden_contact_*` contact block.
 */
export default async function GardensPage() {
  const content = await getPageContent('gardens')
  const slot = (key: string) => getSlot(content, key)
  const heroImagePath = slot('hero_image') || null

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="gardens"
        slotKey="heading"
        kind="text"
        value={slot('heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="gardens"
        slotKey="intro"
        kind="text"
        value={slot('intro')}
        as="p"
        multiline
        className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
      />

      <EditableImageSlot
        page="gardens"
        slotKey="hero_image"
        path={heroImagePath}
        scope="gardens-hero_image"
        alt="A Rooted Gardens design in bloom"
        className="mt-8 h-56 sm:h-72 w-full rounded-2xl"
      />

      <div className="mt-8">
        <EditableCtaButton page="gardens" slotKey="cta_label" value={slot('cta_label')} href="/contact" />
      </div>

      <section className="mt-14">
        <EditableText
          page="gardens"
          slotKey="principles_heading"
          kind="text"
          value={slot('principles_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <SlotList page="gardens" content={content} prefix="principles" count={5} />
      </section>

      <section className="mt-14 rounded-2xl border-l-4 border-[var(--clay)] bg-secondary/50 p-6">
        <EditableRichText
          page="gardens"
          slotKey="philosophy_body"
          value={slot('philosophy_body')}
          doc={content.slots['philosophy_body']?.doc}
          className="text-base text-foreground leading-relaxed"
        />
      </section>

      <section className="mt-14">
        <EditableText
          page="gardens"
          slotKey="services_heading"
          kind="text"
          value={slot('services_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <BulletList page="gardens" slotKey="services_list" value={slot('services_list')} className="space-y-2.5" />
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-card shadow-warm p-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Gardens</p>
        <EditableText
          page="global"
          slotKey="garden_contact_name"
          kind="text"
          value={getSlot(content, 'garden_contact_name')}
          as="p"
          className="font-display text-lg font-semibold text-foreground mt-1"
        />
        <div className="mt-2 space-y-1 text-sm">
          <EditableText
            page="global"
            slotKey="garden_contact_email"
            kind="email"
            value={getSlot(content, 'garden_contact_email')}
            as="p"
            href={
              getSlot(content, 'garden_contact_email') ? `mailto:${getSlot(content, 'garden_contact_email')}` : undefined
            }
            className="block text-primary hover:underline"
          />
          <EditableText
            page="global"
            slotKey="garden_contact_phone"
            kind="phone"
            value={getSlot(content, 'garden_contact_phone')}
            as="p"
            href={
              getSlot(content, 'garden_contact_phone')
                ? `tel:${getSlot(content, 'garden_contact_phone').replace(/[^\d+]/g, '')}`
                : undefined
            }
            className="block text-muted-foreground hover:text-foreground"
          />
        </div>
        <div className="mt-4">
          <EditableCtaButton page="gardens" slotKey="cta_label" value={slot('cta_label')} href="/contact" />
        </div>
      </section>
    </div>
  )
}
