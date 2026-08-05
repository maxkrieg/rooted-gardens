/**
 * The fixed public marketing route set (task 9.2). Owners can edit every
 * page's *content* (site_content / site_collection_items) but not add new
 * pages or nav items — the route list itself is code, not data.
 *
 * Deliberately isomorphic: no React, no `next/headers`, no Supabase import.
 * `proxy.ts` imports PUBLIC_ROUTES directly (Edge runtime), and
 * PublicHeader/PublicFooter import PUBLIC_NAV client-side.
 */

export const PUBLIC_ROUTES = [
  '/',
  '/lawn',
  '/gardens',
  '/about',
  '/faq',
  '/jobs',
  '/contact',
] as const

export type PublicRoute = (typeof PUBLIC_ROUTES)[number]

export const PUBLIC_NAV: { href: PublicRoute; label: string }[] = [
  { href: '/lawn', label: 'Lawn' },
  { href: '/gardens', label: 'Gardens' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/contact', label: 'Contact' },
]
