CREATE TABLE associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL,
  logo_url text,
  join_code text UNIQUE NOT NULL,
  join_enabled boolean NOT NULL DEFAULT true,
  season_end_date date,
  data_purge_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
