CREATE TABLE scraper_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  selectors jsonb NOT NULL,
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;
