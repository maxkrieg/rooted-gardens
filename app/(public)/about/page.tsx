import Link from 'next/link'
import type { Metadata } from 'next'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'
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
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {getSlot(content, 'heading')}
      </h1>
      <p className="mt-4 text-base text-muted-foreground leading-relaxed whitespace-pre-line">
        {getSlot(content, 'intro')}
      </p>

      {team.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {team.map((member) => (
            <div key={member.id} className="rounded-2xl border border-border bg-card shadow-warm p-5">
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

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>
    </div>
  )
}
