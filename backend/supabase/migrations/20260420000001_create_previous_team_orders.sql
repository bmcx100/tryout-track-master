-- Description: Create previous_team_orders table
-- Stores each parent's custom player sort order within previous-team groups
-- player_order is an ordered array of player UUIDs
-- Mirrors player_predictions structure but keyed by previous_team instead of division

CREATE TABLE previous_team_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  previous_team text NOT NULL,
  player_order uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, previous_team)
);

ALTER TABLE previous_team_orders ENABLE ROW LEVEL SECURITY;

-- Users can only read their own orders
CREATE POLICY "Users can view own previous team orders"
  ON previous_team_orders FOR SELECT
  USING (user_id = auth.uid());

-- Users can create orders for associations they belong to
CREATE POLICY "Users can create own previous team orders"
  ON previous_team_orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_belongs_to_association(association_id)
  );

-- Users can update their own orders
CREATE POLICY "Users can update own previous team orders"
  ON previous_team_orders FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own orders
CREATE POLICY "Users can delete own previous team orders"
  ON previous_team_orders FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at (reuses function from migration 11)
CREATE TRIGGER trg_previous_team_orders_updated_at
  BEFORE UPDATE ON previous_team_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast lookup by user + association + previous_team
CREATE INDEX idx_previous_team_orders_lookup
  ON previous_team_orders (user_id, association_id, previous_team);
