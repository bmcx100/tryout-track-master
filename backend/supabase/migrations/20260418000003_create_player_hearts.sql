-- Description: Create player_hearts table
-- Private per-parent heart/friends tracking
-- Parents can heart individual players for quick visual identification
-- Red heart icon + pink row tint in the UI

CREATE TABLE player_hearts (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES tryout_players (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);

ALTER TABLE player_hearts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own hearts
CREATE POLICY "Users can view own hearts"
  ON player_hearts FOR SELECT
  USING (user_id = auth.uid());

-- Users can heart players in their associations
CREATE POLICY "Users can create own hearts"
  ON player_hearts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tryout_players p
      WHERE p.id = player_id
        AND p.deleted_at IS NULL
        AND user_belongs_to_association(p.association_id)
    )
  );

-- Users can unheart their own
CREATE POLICY "Users can delete own hearts"
  ON player_hearts FOR DELETE
  USING (user_id = auth.uid());

-- Index for fetching all hearts for a user
CREATE INDEX idx_player_hearts_user
  ON player_hearts (user_id);
