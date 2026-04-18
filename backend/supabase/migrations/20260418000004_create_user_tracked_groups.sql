-- Description: Create user_tracked_groups table
-- Stores custom group labels and active division selection per user
-- e.g. label "Wildcats U15" for association ORMH, division U15
-- is_active tracks which division the user last viewed

CREATE TABLE user_tracked_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, division)
);

ALTER TABLE user_tracked_groups ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tracked groups
CREATE POLICY "Users can view own tracked groups"
  ON user_tracked_groups FOR SELECT
  USING (user_id = auth.uid());

-- Users can create tracked groups for associations they belong to
CREATE POLICY "Users can create own tracked groups"
  ON user_tracked_groups FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_belongs_to_association(association_id)
  );

-- Users can update their own tracked groups
CREATE POLICY "Users can update own tracked groups"
  ON user_tracked_groups FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own tracked groups
CREATE POLICY "Users can delete own tracked groups"
  ON user_tracked_groups FOR DELETE
  USING (user_id = auth.uid());

-- Index for fetching tracked groups by user
CREATE INDEX idx_user_tracked_groups_lookup
  ON user_tracked_groups (user_id, association_id);
