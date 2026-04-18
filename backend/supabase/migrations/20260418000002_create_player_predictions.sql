-- Description: Create player_predictions table
-- Stores each parent's private player ranking per division
-- player_order is an ordered array of player UUIDs (position = rank)
-- Optimistic updates with debounced save on the client

CREATE TABLE player_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  player_order uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, division)
);

ALTER TABLE player_predictions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own predictions
CREATE POLICY "Users can view own predictions"
  ON player_predictions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create predictions for associations they belong to
CREATE POLICY "Users can create own predictions"
  ON player_predictions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_belongs_to_association(association_id)
  );

-- Users can update their own predictions
CREATE POLICY "Users can update own predictions"
  ON player_predictions FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own predictions
CREATE POLICY "Users can delete own predictions"
  ON player_predictions FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at (reuses function from migration 11)
CREATE TRIGGER trg_player_predictions_updated_at
  BEFORE UPDATE ON player_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast lookup by user + association + division
CREATE INDEX idx_player_predictions_lookup
  ON player_predictions (user_id, association_id, division);
