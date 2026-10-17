import { Fragment } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { HelpBlock } from '@/lib/help/topics'

/** `**bold**` is the only markup help text supports. */
export function HelpText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function HelpTopicBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'p':
            return (
              <p key={i}>
                <HelpText text={block.text} />
              </p>
            )
          case 'list':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <HelpText text={item} />
                  </li>
                ))}
              </ul>
            )
          case 'headsUp':
            return (
              <div
                key={i}
                className="flex gap-2.5 rounded-xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.07] px-3.5 py-3"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay)]" aria-hidden />
                <p>
                  <span className="font-semibold text-[var(--clay)]">Heads up: </span>
                  <HelpText text={block.text} />
                </p>
              </div>
            )
          case 'example':
            return (
              <p key={i} className="rounded-xl bg-secondary px-3.5 py-3 text-[14px] text-secondary-foreground">
                <span className="font-semibold">For example: </span>
                <HelpText text={block.text} />
              </p>
            )
        }
      })}
    </div>
  )
}
