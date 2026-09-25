import StarterKit from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/core'

/**
 * The locked-down Tiptap extension set, shared by the editor and server-side generateHTML so they
 * can't drift. Only bold, italic, link, bullet list and H2. StarterKit v3 bundles Link: don't
 * also import @tiptap/extension-link.
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
      // Blocks javascript: and data: hrefs at the schema level.
      protocols: ['http', 'https', 'mailto', 'tel'],
      openOnClick: false,
    },
  }),
]
