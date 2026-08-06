import StarterKit from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/core'

/**
 * The single locked-down Tiptap extension set for the public site's rich-text
 * slots (task 9.2.5 — `global.org_tagline`, `home.hero_body`). Imported by
 * both `components/public/editing/RichTextEditor.tsx` (the client editor) and
 * `app/(public)/actions.ts` (server-side `generateHTML` at save time), so the
 * schema the owner edits against and the schema used to render it can never
 * drift apart.
 *
 * Deliberately minimal — bold, italic, a link, a bullet list, and an H2.
 * Everything else StarterKit ships (code blocks, blockquotes, horizontal
 * rules, strikethrough, inline code, ordered lists, H1/H3+) is disabled: this
 * is marketing-page body copy, not a document editor. `@tiptap/starter-kit`
 * v3 bundles Link itself (configured via the `link` key below) — do NOT also
 * install/import `@tiptap/extension-link` directly, or Link registers twice.
 */
export const RICHTEXT_EXTENSIONS: Extensions = [
  StarterKit.configure({
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    code: false,
    orderedList: false,
    heading: { levels: [2] },
    link: {
      // Restricts what a pasted/typed URL can resolve to — the schema-level
      // half of "no HTML sanitizer needed" (see app/(public)/actions.ts):
      // even a malicious paste can't produce a javascript: or data: href.
      protocols: ['http', 'https', 'mailto', 'tel'],
      openOnClick: false,
    },
  }),
]
