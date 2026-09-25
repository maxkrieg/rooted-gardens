import { getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { EditableText } from '@/components/public/editing/EditableText'
import { InquiryForm } from '@/components/public/InquiryForm'

export const generateMetadata = () => pageMetadata('contact')

/** The inquiry form, with division phone/email as a "prefer to call?" footnote. */
export default async function ContactPage() {
  const content = await getPageContent('contact')
  const slot = (key: string) => getSlot(content, key)

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
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="contact"
        slotKey="heading"
        kind="text"
        value={slot('heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="contact"
        slotKey="intro"
        kind="text"
        value={slot('intro')}
        as="p"
        className="mt-4 text-base text-muted-foreground leading-relaxed"
      />

      <div className="mt-10">
        <InquiryForm />
      </div>

      {/* Division contacts are `global` slots shared with the footer. */}
      <div className="mt-10 border-t border-border pt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Prefer to call or email?
        </p>
        <div className="mt-3 space-y-2">
          {divisions.map((division) => (
            <div
              key={division.label}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            >
              <span className="text-muted-foreground">{division.label}</span>
              <EditableText
                page="global"
                slotKey={division.nameKey}
                kind="text"
                value={slot(division.nameKey)}
                as="span"
                className="font-medium text-foreground"
              />
              <span className="text-border">·</span>
              <EditableText
                page="global"
                slotKey={division.phoneKey}
                kind="phone"
                value={slot(division.phoneKey)}
                as="span"
                href={
                  slot(division.phoneKey)
                    ? `tel:${slot(division.phoneKey).replace(/[^\d+]/g, '')}`
                    : undefined
                }
                className="text-muted-foreground hover:text-foreground"
              />
              <span className="text-border">·</span>
              <EditableText
                page="global"
                slotKey={division.emailKey}
                kind="email"
                value={slot(division.emailKey)}
                as="span"
                href={slot(division.emailKey) ? `mailto:${slot(division.emailKey)}` : undefined}
                className="text-primary hover:underline"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
