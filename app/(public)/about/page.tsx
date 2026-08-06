import Link from 'next/link'
import Image from 'next/image'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { pageMetadata } from '@/lib/content/metadata'
import { Button } from '@/components/ui/button'
import { EditableText } from '@/components/public/editing/EditableText'
import { CollectionSection } from '@/components/public/editing/CollectionSection'
import { EmptyState } from '@/components/states/EmptyState'
import { siteMediaPublicUrl } from '@/lib/utils/site-media'
import type { TeamItemData } from '@/types/app'
import { SlotList } from '@/components/public/SlotList'

export const generateMetadata = () => pageMetadata('about')

/**
 * About page (task 9.4) — the 9.2 shell had just heading/intro/team grid;
 * this adds the "how a project starts" process steps (SlotList, numbered)
 * and the empty state the team grid was missing at 9.2 (the `team`
 * collection ships with real bios as of the 9.4 seed migration, but a
 * signed-out visitor should never see a blank hole if it's ever emptied out
 * again through the editor).
 */
export default async function AboutPage() {
  const [content, team] = await Promise.all([
    getPageContent('about'),
    getCollection<TeamItemData>('team'),
  ])
  const slot = (key: string) => getSlot(content, key)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="about"
        slotKey="heading"
        kind="text"
        value={slot('heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="about"
        slotKey="intro"
        kind="text"
        value={slot('intro')}
        as="p"
        multiline
        className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
      />

      <section className="mt-14">
        <EditableText
          page="about"
          slotKey="process_heading"
          kind="text"
          value={slot('process_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <SlotList page="about" content={content} prefix="process" count={5} numbered />
      </section>

      <section className="mt-14">
        <EditableText
          page="about"
          slotKey="team_heading"
          kind="text"
          value={slot('team_heading')}
          as="h2"
          className="font-display text-2xl font-semibold text-foreground mb-5"
        />
        <CollectionSection collection="team" items={team}>
          {team.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {team.map((member) => (
                <div key={member.id} className="rounded-2xl border border-border bg-card shadow-warm p-5">
                  {member.data.image_path && (
                    <div className="relative mb-3 h-32 w-32 overflow-hidden rounded-full">
                      <Image
                        src={siteMediaPublicUrl(member.data.image_path)}
                        alt={member.data.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="font-display text-lg font-semibold text-foreground">{member.data.name}</p>
                  {member.data.role && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                      {member.data.role}
                    </p>
                  )}
                  {member.data.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">{member.data.bio}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState variant="seed" title="Team bios coming soon" compact />
          )}
        </CollectionSection>
      </section>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>
    </div>
  )
}
