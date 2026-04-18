CREATE TABLE tryout_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  name text NOT NULL,
  jersey_number text NOT NULL,
  division text NOT NULL,
  team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
  status player_status NOT NULL DEFAULT 'registered',
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE tryout_players ENABLE ROW LEVEL SECURITY;
