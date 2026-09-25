/**
 * The fixed public route set: owners edit content, not pages. Isomorphic, since proxy.ts
 * (Edge) imports it.
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

type PublicRoute = (typeof PUBLIC_ROUTES)[number]

export const PUBLIC_NAV: { href: PublicRoute; label: string }[] = [
  { href: '/lawn', label: 'Lawn' },
  { href: '/gardens', label: 'Gardens' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/contact', label: 'Contact' },
]
