-- Description: Allow all authenticated users to view enabled associations
-- This supports the association picker in the division switcher,
-- where users can browse and switch between associations without
-- needing a pre-existing membership.

CREATE POLICY "Authenticated users can view enabled associations"
  ON associations FOR SELECT
  USING (auth.uid() IS NOT NULL AND join_enabled = true);
