import type { SiteContentKind, SitePage } from '@/types/app'

/**
 * Canonical starting copy for the public marketing site (task 9.2), page
 * structure adapted from the live site (myrootedgardens.com) as of
 * 2026-08-06 — copy itself is written fresh for this app, not copied.
 * Serves three jobs:
 *   1. The source the 9.2 migration's seed INSERTs were hand-copied from.
 *   2. The fallback `getPageContent` merges under the DB rows, so a deleted or
 *      not-yet-created slot renders this instead of a blank page.
 *   3. The list of slots the 9.2.5 editor knows how to offer.
 *
 * Task 9.3/9.4 note: every key added here needs **no migration** — a slot's
 * DB row is created the first time an owner edits it, via `updateSiteSlot`'s
 * upsert (app/(public)/actions.ts). Only `site_collection_items` (FAQ/team
 * entries, which have no default fallback) need a seed migration; see
 * supabase/migrations/20260806000000_site_collections_phase_9_4.sql.
 * `hero_body`-style slots declared `kind: 'text'` here (e.g. `mission_body`,
 * `gardens.philosophy_body`) are meant for `EditableRichText` — they flip to
 * `kind: 'richtext'` in the DB the first time an owner saves through Tiptap
 * (lib/content/site.ts handles both states).
 * An `image`-kind slot's default `value` is `''`, meaning "no photo
 * uploaded yet" — pages should treat an empty value as `path: null`.
 */

type DefaultSlot = { kind: SiteContentKind; value: string }

export const CONTENT_DEFAULTS: Record<SitePage, Record<string, DefaultSlot>> = {
  global: {
    org_name: { kind: 'text', value: 'Rooted Gardens' },
    org_tagline: {
      kind: 'text',
      value:
        "Rooted Gardens mindfully cares for your property to maximize your family's enjoyment while simultaneously benefiting the surrounding ecosystem.",
    },
    parent_company: { kind: 'text', value: 'Tigertown Farm LLC' },
    credentials_line: {
      kind: 'text',
      value:
        'Fully Insured · Equal Opportunity Employer · Environmentally Minded · Proud member of the Ecological Landscape Alliance',
    },
    mailing_address: { kind: 'text', value: 'PO Box 501, Norwich, VT 05055' },
    lawn_contact_name: { kind: 'text', value: 'Matt' },
    lawn_contact_email: { kind: 'email', value: 'matt@myrootedgardens.com' },
    lawn_contact_phone: { kind: 'phone', value: '(802) 291-2228' },
    garden_contact_name: { kind: 'text', value: 'Krystyna' },
    garden_contact_email: { kind: 'email', value: 'krystyna@myrootedgardens.com' },
    garden_contact_phone: { kind: 'phone', value: '(802) 281-0781' },
    social_instagram: { kind: 'url', value: 'https://www.instagram.com/myrootedgardens' },
    social_facebook: { kind: 'url', value: 'https://www.facebook.com/myRootedGardens' },
    blog_url: { kind: 'url', value: 'https://myrootedgardens.com/blog' },
    ela_url: { kind: 'url', value: 'https://www.ecolandscaping.org' },
  },

  home: {
    eyebrow: { kind: 'text', value: 'Norwich, VT · Serving the Upper Valley' },
    hero_heading: { kind: 'text', value: 'Your yard, part of a connected ecosystem' },
    hero_body: {
      kind: 'text',
      value:
        "Rooted Gardens mindfully cares for your property to maximize your family's enjoyment while simultaneously benefiting the surrounding ecosystem.",
    },
    cta_label: { kind: 'text', value: 'Get a quote' },
    hero_image: { kind: 'image', value: '' },
    mission_heading: { kind: 'text', value: 'Part of something bigger than one yard' },
    mission_body: {
      kind: 'text',
      value:
        "Every property we care for is a small piece of a larger habitat. When you choose Rooted Gardens, your yard joins a growing, connected network of regenerative landscapes across the Upper Valley — supporting the pollinators, soil, and wildlife that pass through it.",
    },
    services_heading: { kind: 'text', value: 'What we do' },
    services_body: {
      kind: 'text',
      value:
        'Garden design and installation, all-electric weekly lawn care, seasonal tree and shrub pruning, and stonework — all handled by one local, eco-minded crew.',
    },
    ela_label: { kind: 'text', value: 'Proud member of the Ecological Landscape Alliance' },
    notes_heading: { kind: 'text', value: 'Field Notes' },
    notes_body: {
      kind: 'text',
      value: "Seasonal tips, plant profiles, and what's happening on our routes — over on our blog.",
    },
    notes_cta_label: { kind: 'text', value: 'Read our Field Notes' },
    closing_heading: { kind: 'text', value: 'Invest in more than just your property' },
    closing_cta_label: { kind: 'text', value: 'Get started' },
    seo_title: { kind: 'text', value: 'Eco-Landscaping in Norwich, VT' },
    seo_description: {
      kind: 'text',
      value:
        'The Electric Lawn and Rooted Gardens — eco-minded lawn care and garden design serving the Upper Valley.',
    },
  },

  lawn: {
    heading: { kind: 'text', value: 'The Electric Lawn' },
    intro: {
      kind: 'text',
      value: 'Weekly, route-based electric mowing — quiet, emissions-free, and easy on the neighborhood.',
    },
    seo_title: { kind: 'text', value: 'The Electric Lawn' },
    seo_description: { kind: 'text', value: 'Electric mowing, trimming, and edging for Upper Valley lawns.' },
  },

  gardens: {
    heading: { kind: 'text', value: 'Rooted Gardens' },
    intro: {
      kind: 'text',
      value: 'Ecological garden design, installation, and maintenance that works with the land, not against it.',
    },
    seo_title: { kind: 'text', value: 'Garden Design & Installation' },
    seo_description: {
      kind: 'text',
      value: 'Ecological garden design, installation, and maintenance in the Upper Valley.',
    },
  },

  about: {
    heading: { kind: 'text', value: 'About Us' },
    intro: {
      kind: 'text',
      value: "We're a small, local crew who care as much about the ecosystem as we do about your yard.",
    },
    seo_title: { kind: 'text', value: 'About Us' },
    seo_description: { kind: 'text', value: 'Meet the team behind Rooted Gardens and The Electric Lawn.' },
  },

  faq: {
    heading: { kind: 'text', value: 'Frequently Asked Questions' },
    intro: { kind: 'text', value: "Answers to what we hear most. Don't see yours? Reach out." },
    seo_title: { kind: 'text', value: 'FAQ' },
    seo_description: {
      kind: 'text',
      value: 'Common questions about Rooted Gardens and The Electric Lawn services.',
    },
  },

  jobs: {
    heading: { kind: 'text', value: 'Join the Crew' },
    intro: {
      kind: 'text',
      value: "We're a small, local team that cares about doing this work right. Open positions below.",
    },
    seo_title: { kind: 'text', value: 'Jobs' },
    seo_description: {
      kind: 'text',
      value: 'Career opportunities with Rooted Gardens, an equal opportunity employer in Norwich, VT.',
    },
  },

  contact: {
    heading: { kind: 'text', value: 'Get in Touch' },
    intro: {
      kind: 'text',
      value: "Tell us about your property and which service you're interested in — we'll follow up soon.",
    },
    seo_title: { kind: 'text', value: 'Contact' },
    seo_description: { kind: 'text', value: 'Request a quote from Rooted Gardens or The Electric Lawn.' },
  },
}
