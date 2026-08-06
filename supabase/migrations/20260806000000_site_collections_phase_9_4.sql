-- =================================================================
-- Task 9.4 — real FAQ + team content for the site_collection_items
-- collections the FAQ and About pages render.
-- =================================================================
-- Unlike site_content slots (which fall back to lib/content/defaults.ts
-- when no row exists), site_collection_items has no default fallback — the
-- FAQ list and team grid render exactly what's in the table. The 9.2
-- migration seeded 2 placeholder FAQ entries and 0 team entries so the
-- pages didn't render empty; this migration replaces the FAQ placeholders
-- with the real starting set and adds the team's starting bios.
--
-- Both guards are written to be safe to re-run and to never clobber an
-- owner's edits made through the 9.2.5 inline editor:
--   * FAQ: only touched if the table still holds *exactly* the two 9.2
--     placeholder rows and nothing else — if an owner has already edited,
--     added, or removed an FAQ entry, this migration is a no-op for `faq`.
--   * team: only inserted if the `team` collection is still empty.
-- =================================================================

DO $$
DECLARE
  placeholder_1 jsonb := jsonb_build_object(
    'question', 'What areas do you serve?',
    'answer', 'We serve Norwich, VT and the surrounding Upper Valley.'
  );
  placeholder_2 jsonb := jsonb_build_object(
    'question', 'Do you offer one-time visits?',
    'answer', 'Most lawn service is weekly and route-based, but gardens work is often quoted per project — reach out and we''ll let you know what fits.'
  );
  total_count integer;
  placeholder_count integer;
BEGIN
  SELECT count(*) INTO total_count
  FROM public.site_collection_items
  WHERE collection = 'faq';

  SELECT count(*) INTO placeholder_count
  FROM public.site_collection_items
  WHERE collection = 'faq'
    AND data IN (placeholder_1, placeholder_2);

  IF total_count = placeholder_count THEN
    DELETE FROM public.site_collection_items
    WHERE collection = 'faq'
      AND data IN (placeholder_1, placeholder_2);

    INSERT INTO public.site_collection_items (collection, sort_order, data) VALUES
      ('faq', 0, jsonb_build_object(
        'question', 'What areas do you serve?',
        'answer', 'We''re based in Norwich, VT and serve most of the Upper Valley in person. Outside that range, we can sometimes do a virtual design consultation instead.'
      )),
      ('faq', 1, jsonb_build_object(
        'question', 'What kind of work do you take on?',
        'answer', 'Full-service lawn and garden care — pruning in early spring, edging and mulching through the growing season, and ongoing maintenance all summer. We steer clear of invasive species and focus on work that builds habitat rather than just tidying up.'
      )),
      ('faq', 2, jsonb_build_object(
        'question', 'How big (or small) can a project be?',
        'answer', 'Anywhere from a small pollinator bed to a multi-year plan to convert lawn into habitat. We also partner with existing landscaping crews on the ecological side of a larger project.'
      )),
      ('faq', 3, jsonb_build_object(
        'question', 'What about deer?',
        'answer', 'Deer pressure is real in this region. We lean on deer-resistant plant choices, and for some properties we''ll talk with you about ethical hunting as part of a longer-term balance.'
      )),
      ('faq', 4, jsonb_build_object(
        'question', 'What do you mean by "ecological gardening"?',
        'answer', 'Designing and maintaining a landscape with the site''s ecology in mind — choosing and caring for plants in a way that supports the pollinators, birds, and soil life around it, not just how it looks.'
      ));
  END IF;
END $$;

INSERT INTO public.site_collection_items (collection, sort_order, data)
SELECT 'team', v.sort_order, v.data
FROM (VALUES
  (0, jsonb_build_object(
    'name', 'Krystyna Oszkinis',
    'role', 'Owner & Lead Designer',
    'bio', 'Krystyna (she/her) studied environmental science and studio art at Dartmouth and has spent the past decade helping homeowners rethink what their yard can do for the ecosystem around it.',
    'image_path', NULL
  )),
  (1, jsonb_build_object(
    'name', 'Matt Stuart',
    'role', 'Owner',
    'bio', 'Matt runs the lawn and equipment side of the business — routes, mowers, and making sure the crew has what they need to do the job right.',
    'image_path', NULL
  )),
  (2, jsonb_build_object(
    'name', 'Jane LeMasurier',
    'role', 'Garden Guru',
    'bio', 'Jane came to gardening from a coaching background and brings the same patience to helping native plantings get established.',
    'image_path', NULL
  )),
  (3, jsonb_build_object(
    'name', 'Sarah Goldsmith',
    'role', 'Garden Guru & Education Coordinator',
    'bio', 'Sarah (they/she) has a background in soil science and leads on the "why" behind our practices — healthy dirt matters as much as what''s planted in it.',
    'image_path', NULL
  ))
) AS v(sort_order, data)
WHERE NOT EXISTS (SELECT 1 FROM public.site_collection_items WHERE collection = 'team');
