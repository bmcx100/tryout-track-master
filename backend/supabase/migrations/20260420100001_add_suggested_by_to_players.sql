-- Description: Add suggested_by column to tryout_players for parent-suggested players.
-- When NULL, player is a normal record visible to all. When set, only visible
-- to the suggesting user and admins until approved.

-- Add column
ALTER TABLE tryout_players
  ADD COLUMN suggested_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Update RLS: drop old member SELECT policy and replace with suggested_by-aware version
DROP POLICY IF EXISTS "Members can view active players" ON tryout_players;

CREATE POLICY "Members can view active players"
  ON tryout_players FOR SELECT
  USING (
    (
      suggested_by IS NULL
      AND user_belongs_to_association(association_id)
      AND deleted_at IS NULL
    )
    OR (
      suggested_by = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Allow members to insert suggested players (for Part B — continuations linking)
CREATE POLICY "Members can suggest players"
  ON tryout_players FOR INSERT
  WITH CHECK (
    user_belongs_to_association(association_id)
    AND suggested_by = auth.uid()
  );
