import Link from 'next/link'
import type { Metadata } from 'next'
import { getCollection, getPageContent, getSlot } from '@/lib/content/site'
import { Button } from '@/components/ui/button'
import type { JobItemData } from '@/types/app'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('jobs')
  return {
    title: getSlot(content, 'seo_title') || undefined,
    description: getSlot(content, 'seo_description') || undefined,
  }
}

/**
 * 9.2 shell for the careers page — the `job` collection rendered as cards.
 * The actual application form (upload to Storage, insert a
 * `kind='job_application'` lead) is task 9.6; for now "Apply" routes to the
 * general inquiry page.
 */
export default async function JobsPage() {
  const [content, jobs] = await Promise.all([getPageContent('jobs'), getCollection<JobItemData>('job')])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
        {getSlot(content, 'heading')}
      </h1>
      <p className="mt-4 text-base text-muted-foreground leading-relaxed">{getSlot(content, 'intro')}</p>

      {jobs.length > 0 ? (
        <div className="mt-10 space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-border bg-card shadow-warm p-5">
              <p className="font-display text-lg font-semibold text-foreground">{job.data.title}</p>
              {job.data.location && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {job.data.location}
                </p>
              )}
              {job.data.blurb && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">{job.data.blurb}</p>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/contact">Apply</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-muted-foreground">
          No open positions right now — check back soon, or{' '}
          <Link href="/contact" className="text-primary hover:underline">
            reach out
          </Link>{' '}
          to introduce yourself.
        </p>
      )}
    </div>
  )
}
