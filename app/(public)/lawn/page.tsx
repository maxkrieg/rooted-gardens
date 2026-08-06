import { getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { EditableText } from '@/components/public/editing/EditableText'
import { EditableImageSlot } from '@/components/public/editing/EditableImageSlot'
import { EditableCtaButton } from '@/components/public/editing/EditableCtaButton'
import { SlotList } from '@/components/public/SlotList'
import { BulletList } from '@/components/public/BulletList'

export const generateMetadata = () => pageMetadata('lawn')

/**
 * The Electric Lawn division page (task 9.4). 9.2 shipped just heading +
 * intro + a hardcoded CTA button; this adds a hero photo, the "why
 * electric" stat cards, the mowing philosophy (SlotList), a services list,
 * and the division's own contact block (the `global.lawn_contact_*` slots —
 * same ones the footer and /contact edit, so a change in any one place
 * shows up everywhere).
 */
export default async function LawnPage() {
  const content = await getPageContent('lawn')
  const slot = (key: string) => getSlot(content, key)
  const heroImagePath = slot('hero_image') || null

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="lawn"
        slotKey="heading"
        kind="text"
        value={slot('heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="lawn"
        slotKey="intro"
        kind="text"
        value={slot('intro')}
        as="p"
        multiline
        className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
      />

      <EditableImageSlot
        page="lawn"
        slotKey="hero_image"
        path={heroImagePath}
        scope="lawn-hero_image"
        alt="The Electric Lawn crew at work"
        className="mt-8 h-56 sm:h-72 w-full rounded-2xl"
      />

      <div className="mt-8">
        <EditableCtaButton page="lawn" slotKey="cta_label" value={slot('cta_label')} href="/contact" />
      </div>

      <section className="mt-14">
        <EditableText
          page="lawn"
          slotKey="why_heading"
          kind="text"
          value={slot('why_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(['stat_1', 'stat_2'] as const).map((prefix) => (
            <div key={prefix} className="rounded-2xl border border-border bg-card shadow-warm p-5">
              <EditableText
                page="lawn"
                slotKey={`${prefix}_body`}
                kind="text"
                value={slot(`${prefix}_body`)}
                as="p"
                multiline
                className="text-sm text-foreground leading-relaxed whitespace-pre-line"
              />
              <EditableText
                page="lawn"
                slotKey={`${prefix}_source`}
                kind="text"
                value={slot(`${prefix}_source`)}
                as="p"
                className="mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <EditableText
          page="lawn"
          slotKey="philosophy_heading"
          kind="text"
          value={slot('philosophy_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <SlotList page="lawn" content={content} prefix="philosophy" count={4} />
      </section>

      <section className="mt-14">
        <EditableText
          page="lawn"
          slotKey="services_heading"
          kind="text"
          value={slot('services_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <BulletList page="lawn" slotKey="services_list" value={slot('services_list')} className="space-y-2.5" />
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-card shadow-warm p-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Lawn · Stone · Pruning
        </p>
        <EditableText
          page="global"
          slotKey="lawn_contact_name"
          kind="text"
          value={getSlot(content, 'lawn_contact_name')}
          as="p"
          className="font-display text-lg font-semibold text-foreground mt-1"
        />
        <div className="mt-2 space-y-1 text-sm">
          <EditableText
            page="global"
            slotKey="lawn_contact_email"
            kind="email"
            value={getSlot(content, 'lawn_contact_email')}
            as="p"
            href={getSlot(content, 'lawn_contact_email') ? `mailto:${getSlot(content, 'lawn_contact_email')}` : undefined}
            className="block text-primary hover:underline"
          />
          <EditableText
            page="global"
            slotKey="lawn_contact_phone"
            kind="phone"
            value={getSlot(content, 'lawn_contact_phone')}
            as="p"
            href={
              getSlot(content, 'lawn_contact_phone')
                ? `tel:${getSlot(content, 'lawn_contact_phone').replace(/[^\d+]/g, '')}`
                : undefined
            }
            className="block text-muted-foreground hover:text-foreground"
          />
        </div>
        <div className="mt-4">
          <EditableCtaButton page="lawn" slotKey="cta_label" value={slot('cta_label')} href="/contact" />
        </div>
      </section>
    </div>
  )
}
