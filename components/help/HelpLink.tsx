'use client'

import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { useRole } from '@/components/app/RoleProvider'
import { findHelpTopic, topicRoles } from '@/lib/help/topics'
import { cn } from '@/lib/utils'

interface HelpLinkProps {
  /** A HELP_TOPICS key; `npm run check:tours` fails if it doesn't exist. */
  topic: string
  className?: string
}

/**
 * A compact "How this works" link into the Help guide. A plain link, so it can stay small.
 * Renders nothing for a role that can't read the topic, so it never lands on a missing one.
 */
export function HelpLink({ topic, className }: HelpLinkProps) {
  const { role } = useRole()
  const found = findHelpTopic(topic)
  if (!role || !found || !topicRoles(found).includes(role)) return null

  return (
    <Link
      href={`/app/help#${topic}`}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        className,
      )}
    >
      <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      How this works
    </Link>
  )
}
