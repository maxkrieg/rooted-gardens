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
    hero_image: { kind: 'image', value: '' },
    cta_label: { kind: 'text', value: 'Get a lawn quote' },
    why_heading: { kind: 'text', value: 'Why go electric?' },
    stat_1_body: {
      kind: 'text',
      value:
        'Turf lawn is one of the most widespread irrigated surfaces in the country — how we mow it adds up fast across a neighborhood.',
    },
    stat_1_source: { kind: 'text', value: 'Based on national land-use research' },
    stat_2_body: {
      kind: 'text',
      value:
        "Small gas engines aren't held to the same emissions standards as cars, so gas-powered lawn equipment is a real source of local air pollution. Going electric takes that off the table entirely.",
    },
    stat_2_source: { kind: 'text', value: 'U.S. EPA' },
    philosophy_heading: { kind: 'text', value: 'Our approach' },
    philosophy_1_title: { kind: 'text', value: 'Mow High' },
    philosophy_1_body: {
      kind: 'text',
      value:
        'Taller grass grows deeper roots, crowds out weeds on its own, and holds up better through a dry summer.',
    },
    philosophy_2_title: { kind: 'text', value: 'Frequency That Follows the Season' },
    philosophy_2_body: {
      kind: 'text',
      value:
        "Spring growth is fast and late summer is slow. We adjust our route cadence to match, instead of mowing on a fixed schedule that ignores the grass.",
    },
    philosophy_3_title: { kind: 'text', value: 'Leaves Stay On the Lawn' },
    philosophy_3_body: {
      kind: 'text',
      value:
        'Each fall we mulch leaves back into the turf instead of bagging them — free fertilizer, less waste, and shelter for overwintering insects.',
    },
    philosophy_4_title: { kind: 'text', value: 'Better Rates for Neighbors' },
    philosophy_4_body: {
      kind: 'text',
      value:
        "Clustered stops on the same street mean less drive time and fewer emissions — so neighbors who sign up together get our best pricing.",
    },
    services_heading: { kind: 'text', value: 'Services' },
    services_list: {
      kind: 'text',
      value: 'Weekly electric mowing\nTrimming & edging\nSeasonal cleanups\nTree & shrub pruning\nStonework & walkways',
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
    hero_image: { kind: 'image', value: '' },
    cta_label: { kind: 'text', value: 'Get a garden quote' },
    principles_heading: { kind: 'text', value: 'Our ecological principles' },
    principles_1_title: { kind: 'text', value: 'Right Plant, Right Place' },
    principles_1_body: {
      kind: 'text',
      value:
        'We choose species suited to your soil and light instead of fighting the site — less water, less intervention, healthier plants.',
    },
    principles_2_title: { kind: 'text', value: 'Soil First' },
    principles_2_body: {
      kind: 'text',
      value: 'Healthy soil holds water, feeds microbes, and needs less synthetic input. Most of our design work starts underground.',
    },
    principles_3_title: { kind: 'text', value: 'Layered, Not Lawn' },
    principles_3_body: {
      kind: 'text',
      value:
        'Trees, shrubs, and groundcover planted together mimic a real ecosystem — more habitat in the same footprint as a single layer of turf.',
    },
    principles_4_title: { kind: 'text', value: 'Leave the Leaves' },
    principles_4_body: {
      kind: 'text',
      value: 'Fallen leaves are free mulch and winter shelter for pollinators — we tuck them into beds instead of hauling them away.',
    },
    principles_5_title: { kind: 'text', value: 'Winter Structure' },
    principles_5_body: {
      kind: 'text',
      value: 'Seed heads and standing stems feed birds through the cold months and give a garden real shape when nothing is in bloom.',
    },
    philosophy_body: {
      kind: 'text',
      value:
        "We design for the birds and pollinators as much as for the people who live here — gardens that bloom in stages across the whole season and give wildlife somewhere to actually live, not just visit.",
    },
    services_heading: { kind: 'text', value: 'Services' },
    services_list: {
      kind: 'text',
      value:
        'Garden design & installation\nEcological maintenance\nLawn-to-garden conversions\nSpring & fall cleanups\nTree & shrub pruning',
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
    process_heading: { kind: 'text', value: 'How a project starts' },
    process_1_title: { kind: 'text', value: 'Free Phone Call' },
    process_1_body: {
      kind: 'text',
      value: 'We start with a quick call about your property, your goals, and your budget — no cost, no obligation.',
    },
    process_2_title: { kind: 'text', value: 'On-Site Visit' },
    process_2_body: {
      kind: 'text',
      value:
        'A designer walks the property with you to look at sun, soil, and how you actually use the space. A $150 visit fee applies, credited toward a design if you move forward.',
    },
    process_3_title: { kind: 'text', value: 'Design & Plant List' },
    process_3_body: {
      kind: 'text',
      value: "You get a real plan — layout, species, and a materials list — not just a verbal sketch.",
    },
    process_4_title: { kind: 'text', value: 'Groundbreaking' },
    process_4_body: {
      kind: 'text',
      value: 'Soil prep, planting, and any hardscape work happens on a schedule we agree on together.',
    },
    process_5_title: { kind: 'text', value: 'Ongoing Care' },
    process_5_body: {
      kind: 'text',
      value: "Most new gardens need a season or two of follow-up weeding, pruning, and edging while plantings establish — we're there for it.",
    },
    team_heading: { kind: 'text', value: 'Meet the crew' },
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
