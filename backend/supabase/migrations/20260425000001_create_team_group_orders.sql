-- Description: Create team_group_orders table
-- Stores each user's custom ordering of previous-team groups (sections)
-- team_order is an ordered array of previous_team labels (e.g., {"U15AA","U13A","U13BB"})
-- Used in Previous Teams view and inherited by Predictions default sort

CREATE TABLE team_group_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  team_order text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, division)
);

ALTER TABLE team_group_orders ENABLE ROW LEVEL SECURITY;

-- Users can only read their own orders
CREATE POLICY "Users can view own team group orders"
  ON team_group_orders FOR SELECT
  USING (user_id = auth.uid());

-- Users can create orders for associations they belong to
CREATE POLICY "Users can create own team group orders"
  ON team_group_orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_belongs_to_association(association_id)
  );

-- Users can update their own orders
CREATE POLICY "Users can update own team group orders"
  ON team_group_orders FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own orders
CREATE POLICY "Users can delete own team group orders"
  ON team_group_orders FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at (reuses function from migration 11)
CREATE TRIGGER trg_team_group_orders_updated_at
  BEFORE UPDATE ON team_group_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast lookup by user + association + division
CREATE INDEX idx_team_group_orders_lookup
  ON team_group_orders (user_id, association_id, division);
