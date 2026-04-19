-- Description: Create continuation_rounds and player_annotations tables
-- continuation_rounds stores tryout round results per team level
-- player_annotations stores per-user favorites and notes on players

-- Table 1: continuation_rounds
CREATE TABLE continuation_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  team_level text NOT NULL,
  round_number integer NOT NULL,
  is_final_team boolean NOT NULL DEFAULT false,
  jersey_numbers text[] NOT NULL,
  ip_players text[] NOT NULL DEFAULT '{}',
  sessions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, division, team_level, round_number)
);

ALTER TABLE continuation_rounds ENABLE ROW LEVEL SECURITY;

-- RLS: all association members can read
CREATE POLICY "Members can view continuation rounds"
  ON continuation_rounds FOR SELECT
  USING (user_belongs_to_association(association_id));

-- RLS: only admins can write
CREATE POLICY "Admins can insert continuation rounds"
  ON continuation_rounds FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Admins can update continuation rounds"
  ON continuation_rounds FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id))
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Admins can delete continuation rounds"
  ON continuation_rounds FOR DELETE
  USING (user_is_group_admin_or_admin(association_id));

-- Index for fast lookup by association + division
CREATE INDEX idx_continuation_rounds_lookup
  ON continuation_rounds (association_id, division, team_level, round_number);

-- Table 2: player_annotations
CREATE TABLE player_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES tryout_players (id) ON DELETE CASCADE,
  is_favorite boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

ALTER TABLE player_annotations ENABLE ROW LEVEL SECURITY;

-- RLS: users can only read/write their own annotations
CREATE POLICY "Users can view own annotations"
  ON player_annotations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own annotations"
  ON player_annotations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own annotations"
  ON player_annotations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own annotations"
  ON player_annotations FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at (reuses function from migration 11)
CREATE TRIGGER trg_player_annotations_updated_at
  BEFORE UPDATE ON player_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for fast lookup by user
CREATE INDEX idx_player_annotations_user
  ON player_annotations (user_id, player_id);
