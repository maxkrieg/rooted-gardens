-- =================================================================
-- Task 9.2 — site_content / site_collection_items (owner-editable
-- marketing-site copy) + the site-media storage bucket
-- =================================================================
-- The public marketing site (app/(public)/*) reads every word, phone
-- number, email, and social link from these two tables instead of from
-- code, so an owner can edit the live site with no code change (9.2.5
-- ships the inline editor; this migration is the data model it writes
-- to). A row going missing must never blank out a page — the app-side
-- read layer (lib/content/defaults.ts) falls back to hardcoded copy, so
-- these seed rows are a starting point, not a dependency.
--
-- site_content: one row per named "slot" on a fixed page (or 'global',
--   shared across pages — footer contact info, socials, etc).
-- site_collection_items: ordered, owner-managed lists (FAQ, job
--   openings, team bios) rendered on a fixed page.
--
-- Following the leads (9.1) precedent: `anon` needs read access here
-- (public marketing content) but the base schema grants `anon` nothing,
-- so this is only the second anon-readable/writable surface in the app.
-- =================================================================

CREATE TABLE public.site_content (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'global' is shared across every public page (footer contacts, socials);
  -- otherwise the route slug the slot renders on.
  page        text        NOT NULL
    CHECK (page IN ('global', 'home', 'lawn', 'gardens', 'about', 'faq', 'jobs', 'contact')),
  key         text        NOT NULL
    CHECK (char_length(key) BETWEEN 1 AND 100),
  kind        text        NOT NULL
    CHECK (kind IN ('text', 'richtext', 'image', 'email', 'phone', 'url')),
  -- Plain JSON string for text/image/email/phone/url; a Tiptap document for
  -- richtext (9.2.5). Nullable so a slot can exist with "no value yet"
  -- without violating a NOT NULL default — the read layer's default-merge
  -- treats null the same as a missing row.
  value       jsonb,
  updated_by  uuid        REFERENCES public.employees(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page, key)
);

CREATE TABLE public.site_collection_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection  text        NOT NULL
    CHECK (collection IN ('faq', 'job', 'team')),
  sort_order  integer     NOT NULL DEFAULT 0,
  -- Lets an owner take an item down (e.g. a filled job opening) without
  -- deleting the content, mirroring accounts.status's soft-hide pattern.
  published   boolean     NOT NULL DEFAULT true,
  -- Shape is per-collection (faq: {question,answer}; job: {title,location,blurb};
  -- team: {name,role,bio,image_path}) — validated by Zod at every read and
  -- write boundary (lib/validators/site-content.ts), not by the DB.
  data        jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_collection_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_site_collection_items_updated_at
  BEFORE UPDATE ON public.site_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- INDEXES
-- =================================================================

-- Backs getPageContent()'s `.in('page', ['global', page])` read.
CREATE INDEX site_content_page_idx ON public.site_content (page);

-- Backs getCollection()'s ordered, published-only read.
CREATE INDEX site_collection_items_order_idx
  ON public.site_collection_items (collection, sort_order)
  WHERE published;

-- =================================================================
-- GRANTS
-- =================================================================
-- RLS alone confers no privilege (see 9.1) — anon needs an explicit grant
-- to read marketing content at all.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_collection_items TO authenticated;

GRANT SELECT ON public.site_content          TO anon;
GRANT SELECT ON public.site_collection_items TO anon;

-- =================================================================
-- RLS POLICIES
-- =================================================================
-- Public marketing content: anyone (anon or staff) can read it. Only
-- owners can write it — this is the inline-editor surface (9.2.5), and
-- the plan is explicit that editing is owner-only (not lead/accountant/
-- crew). DELETE has no authenticated-role policy for site_content itself
-- (slots are edited, not removed) but collection items can be deleted by
-- owners so a stale FAQ/job/team entry can go away entirely.

CREATE POLICY site_content_select
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY site_content_insert
  ON public.site_content
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY site_content_update
  ON public.site_content
  FOR UPDATE
  TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY site_collection_items_select
  ON public.site_collection_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY site_collection_items_insert
  ON public.site_collection_items
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY site_collection_items_update
  ON public.site_collection_items
  FOR UPDATE
  TO authenticated
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');

CREATE POLICY site_collection_items_delete
  ON public.site_collection_items
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'owner');

-- =================================================================
-- STORAGE — site-media bucket
-- =================================================================
-- Public (not signed-URL, unlike `photos`): marketing images need stable,
-- cacheable, crawlable URLs. Owner-only writes; anyone can read.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  20971520,           -- 20 MB per file, matching the photos bucket (20260625142525)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public can read site media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'site-media');

CREATE POLICY "owners can upload site media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-media'
  AND get_my_role() = 'owner'
);

CREATE POLICY "owners can update site media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-media'
  AND get_my_role() = 'owner'
);

CREATE POLICY "owners can delete site media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-media'
  AND get_my_role() = 'owner'
);

-- =================================================================
-- SEED — starting copy, verified against the live site
-- (myrootedgardens.com) on 2026-08-04. ON CONFLICT DO NOTHING so this
-- migration stays idempotent and never clobbers an owner's edit if it's
-- ever re-run. This project's workflow is cloud-only (CLAUDE.md), so the
-- migration itself carries the seed rather than supabase/seed.sql.
--
-- `seo_title` values are deliberately short (no "| Rooted Gardens" suffix):
-- the root layout (app/layout.tsx) sets `title.template = '%s · Rooted
-- Gardens'`, which every page's `generateMetadata` inherits automatically —
-- baking the brand into the slot value too would double it.
-- =================================================================

INSERT INTO public.site_content (page, key, kind, value) VALUES
  -- Global — footer contacts, socials, credentials
  ('global', 'org_name',            'text',  to_jsonb('Rooted Gardens'::text)),
  ('global', 'org_tagline',         'text',  to_jsonb('Rooted Gardens mindfully cares for your property to maximize your family''s enjoyment while simultaneously benefiting the surrounding ecosystem.'::text)),
  ('global', 'parent_company',      'text',  to_jsonb('Tigertown Farm LLC'::text)),
  ('global', 'credentials_line',    'text',  to_jsonb('Fully Insured · Equal Opportunity Employer · Environmentally Minded · Proud member of the Ecological Landscape Alliance'::text)),
  ('global', 'mailing_address',     'text',  to_jsonb('PO Box 501, Norwich, VT 05055'::text)),
  ('global', 'lawn_contact_name',   'text',  to_jsonb('Matt'::text)),
  ('global', 'lawn_contact_email',  'email', to_jsonb('matt@myrootedgardens.com'::text)),
  ('global', 'lawn_contact_phone',  'phone', to_jsonb('(802) 291-2228'::text)),
  ('global', 'garden_contact_name', 'text',  to_jsonb('Krystyna'::text)),
  ('global', 'garden_contact_email','email', to_jsonb('krystyna@myrootedgardens.com'::text)),
  ('global', 'garden_contact_phone','phone', to_jsonb('(802) 281-0781'::text)),
  ('global', 'social_instagram',    'url',   to_jsonb('https://www.instagram.com/myrootedgardens'::text)),
  ('global', 'social_facebook',     'url',   to_jsonb('https://www.facebook.com/myRootedGardens'::text)),
  ('global', 'blog_url',            'url',   to_jsonb('https://myrootedgardens.com/blog'::text)),

  -- Home
  ('home', 'hero_heading',    'text', to_jsonb('Your yard, part of a connected ecosystem'::text)),
  ('home', 'hero_body',       'text', to_jsonb('Rooted Gardens mindfully cares for your property to maximize your family''s enjoyment while simultaneously benefiting the surrounding ecosystem.'::text)),
  ('home', 'cta_label',       'text', to_jsonb('Get a quote'::text)),
  ('home', 'seo_title',       'text', to_jsonb('Eco-Landscaping in Norwich, VT'::text)),
  ('home', 'seo_description', 'text', to_jsonb('The Electric Lawn and Rooted Gardens — eco-minded lawn care and garden design serving the Upper Valley.'::text)),

  -- Lawn
  ('lawn', 'heading',         'text', to_jsonb('The Electric Lawn'::text)),
  ('lawn', 'intro',           'text', to_jsonb('Weekly, route-based electric mowing — quiet, emissions-free, and easy on the neighborhood.'::text)),
  ('lawn', 'seo_title',       'text', to_jsonb('The Electric Lawn'::text)),
  ('lawn', 'seo_description', 'text', to_jsonb('Electric mowing, trimming, and edging for Upper Valley lawns.'::text)),

  -- Gardens
  ('gardens', 'heading',         'text', to_jsonb('Rooted Gardens'::text)),
  ('gardens', 'intro',           'text', to_jsonb('Ecological garden design, installation, and maintenance that works with the land, not against it.'::text)),
  ('gardens', 'seo_title',       'text', to_jsonb('Garden Design & Installation'::text)),
  ('gardens', 'seo_description', 'text', to_jsonb('Ecological garden design, installation, and maintenance in the Upper Valley.'::text)),

  -- About
  ('about', 'heading',         'text', to_jsonb('About Us'::text)),
  ('about', 'intro',           'text', to_jsonb('We''re a small, local crew who care as much about the ecosystem as we do about your yard.'::text)),
  ('about', 'seo_title',       'text', to_jsonb('About Us'::text)),
  ('about', 'seo_description', 'text', to_jsonb('Meet the team behind Rooted Gardens and The Electric Lawn.'::text)),

  -- FAQ
  ('faq', 'heading',         'text', to_jsonb('Frequently Asked Questions'::text)),
  ('faq', 'intro',           'text', to_jsonb('Answers to what we hear most. Don''t see yours? Reach out.'::text)),
  ('faq', 'seo_title',       'text', to_jsonb('FAQ'::text)),
  ('faq', 'seo_description', 'text', to_jsonb('Common questions about Rooted Gardens and The Electric Lawn services.'::text)),

  -- Jobs
  ('jobs', 'heading',         'text', to_jsonb('Join the Crew'::text)),
  ('jobs', 'intro',           'text', to_jsonb('We''re a small, local team that cares about doing this work right. Open positions below.'::text)),
  ('jobs', 'seo_title',       'text', to_jsonb('Jobs'::text)),
  ('jobs', 'seo_description', 'text', to_jsonb('Career opportunities with Rooted Gardens, an equal opportunity employer in Norwich, VT.'::text)),

  -- Contact
  ('contact', 'heading',         'text', to_jsonb('Get in Touch'::text)),
  ('contact', 'intro',           'text', to_jsonb('Tell us about your property and which service you''re interested in — we''ll follow up soon.'::text)),
  ('contact', 'seo_title',       'text', to_jsonb('Contact'::text)),
  ('contact', 'seo_description', 'text', to_jsonb('Request a quote from Rooted Gardens or The Electric Lawn.'::text))
ON CONFLICT (page, key) DO NOTHING;

INSERT INTO public.site_collection_items (collection, sort_order, data) VALUES
  ('faq', 0, jsonb_build_object(
    'question', 'What areas do you serve?',
    'answer', 'We serve Norwich, VT and the surrounding Upper Valley.'
  )),
  ('faq', 1, jsonb_build_object(
    'question', 'Do you offer one-time visits?',
    'answer', 'Most lawn service is weekly and route-based, but gardens work is often quoted per project — reach out and we''ll let you know what fits.'
  )),
  ('job', 0, jsonb_build_object(
    'title', 'Crew Member — The Electric Lawn',
    'location', 'Norwich, VT',
    'blurb', 'Seasonal mowing crew position. No experience required — we train.'
  ));
