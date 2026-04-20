-- Description: Add draft/published status to continuation_rounds,
-- add source_url and scraped_at columns, and create continuations_urls config table.

-- 1. Add status column (draft/published) to continuation_rounds
ALTER TABLE continuation_rounds
  ADD COLUMN status text NOT NULL DEFAULT 'published';

-- 2. Add source_url and scraped_at columns
ALTER TABLE continuation_rounds
  ADD COLUMN source_url text,
  ADD COLUMN scraped_at timestamptz;

-- 3. Create continuations_urls config table
CREATE TABLE continuations_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, division)
);

ALTER TABLE continuations_urls ENABLE ROW LEVEL SECURITY;

-- RLS: members can read
CREATE POLICY "Members can view continuations urls"
  ON continuations_urls FOR SELECT
  USING (user_belongs_to_association(association_id));

-- RLS: admins can write
CREATE POLICY "Admins can insert continuations urls"
  ON continuations_urls FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Admins can update continuations urls"
  ON continuations_urls FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id))
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Admins can delete continuations urls"
  ON continuations_urls FOR DELETE
  USING (user_is_group_admin_or_admin(association_id));

-- Auto-update updated_at
CREATE TRIGGER trg_continuations_urls_updated_at
  BEFORE UPDATE ON continuations_urls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. Seed NGHA continuations URLs
INSERT INTO continuations_urls (association_id, division, url) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'U13', 'http://www.gowildcats.ca/content/U13-Continuations'),
  ('a1000000-0000-0000-0000-000000000001', 'U15', 'http://www.gowildcats.ca/content/U15-Continuations'),
  ('a1000000-0000-0000-0000-000000000001', 'U18', 'http://www.gowildcats.ca/content/U18-Continuations');
