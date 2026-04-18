CREATE TABLE corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES tryout_players (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  note text,
  status correction_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
