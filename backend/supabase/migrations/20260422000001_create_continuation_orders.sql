-- Description: Create continuation_orders table
-- Stores each parent's custom player sort order within continuation rounds
-- player_order is an ordered array of jersey number strings (not UUIDs)
-- because unknown players (not yet linked to DB records) are identified by jersey number

CREATE TABLE continuation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES continuation_rounds (id) ON DELETE CASCADE,
  player_order text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, round_id)
);

ALTER TABLE continuation_orders ENABLE ROW LEVEL SECURITY;

-- Users can only read their own orders
CREATE POLICY "Users can view own continuation orders"
  ON continuation_orders FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own orders
CREATE POLICY "Users can create own continuation orders"
  ON continuation_orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own orders
CREATE POLICY "Users can update own continuation orders"
  ON continuation_orders FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own orders
CREATE POLICY "Users can delete own continuation orders"
  ON continuation_orders FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at (reuses function from migration 11)
CREATE TRIGGER trg_continuation_orders_updated_at
  BEFORE UPDATE ON continuation_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast lookup by user + round
CREATE INDEX idx_continuation_orders_lookup
  ON continuation_orders (user_id, round_id);
