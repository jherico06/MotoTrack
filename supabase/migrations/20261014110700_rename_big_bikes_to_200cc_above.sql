-- Rename CC category display name and set range to 200cc and above.
UPDATE public.cc_categories
SET
  name = '200cc above',
  min_cc = 200,
  max_cc = NULL,
  updated_at = timezone('utc'::text, now())
WHERE id = 'cc-big-bikes';
