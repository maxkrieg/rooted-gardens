import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'
import { EditableText } from '@/components/public/editing/EditableText'
import { CollectionSection } from '@/components/public/editing/CollectionSection'
import { siteMediaPublicUrl } from '@/lib/utils/site-media'
import type { TeamItemData } from '@/types/app'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('about')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/**
 * 9.2 shell for the About page. The `team` collection is owner-managed
 * (9.2.5) and starts empty — the page must render cleanly with zero team
 * members, since 9.2 ships before any bios have been entered.
 */
export default async function AboutPage() {
  const [content, team] = await Promise.all([
    getPageContent('about'),
    getCollection<TeamItemData>('team'),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <EditableText
        page="about"
        slotKey="heading"
        kind="text"
        value={getSlot(content, 'heading')}
        as="h1"
        className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
      />
      <EditableText
        page="about"
        slotKey="intro"
        kind="text"
        value={getSlot(content, 'intro')}
        as="p"
        multiline
        className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line"
      />

      <div className="mt-10">
        <CollectionSection collection="team" items={team}>
          {team.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              {team.map((member) => (
                <div key={member.id} className="rounded-2xl border border-border bg-card shadow-warm p-5">
                  {member.data.image_path && (
                    <div className="relative mb-3 h-32 w-32 overflow-hidden rounded-lg">
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
          )}
        </CollectionSection>
      </div>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>
    </div>
  )
}
