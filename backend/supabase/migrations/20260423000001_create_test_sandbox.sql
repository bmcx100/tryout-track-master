-- Description: Create Test Sandbox association by cloning NGHA U15 data.
-- The sandbox is hidden from regular users (join_enabled = false) and only
-- accessible to admin/group_admin accounts. Provides a safe copy of real
-- data for testing features without risking live Nepean Wildcats data.

-- ============================================================
-- 1. Create the sandbox association
-- ============================================================
INSERT INTO associations (id, name, abbreviation, join_code, join_enabled)
VALUES (
  'a2000000-0000-0000-0000-000000000002',
  'Test Sandbox (U15)',
  'TEST',
  'TEST2026',
  false
);

-- ============================================================
-- 2. Clone U15 teams from NGHA into the sandbox
-- ============================================================
INSERT INTO teams (association_id, division, name, display_order, max_roster_size)
SELECT
  'a2000000-0000-0000-0000-000000000002',
  division,
  name,
  display_order,
  max_roster_size
FROM teams
WHERE association_id = 'a1000000-0000-0000-0000-000000000001'
  AND division = 'U15';

-- ============================================================
-- 3. Clone U15 players from NGHA into the sandbox
--    Remap team_id using (division, name) join
-- ============================================================

-- Disable audit trigger (uses auth.uid() which is NULL in migrations)
ALTER TABLE tryout_players DISABLE TRIGGER trg_audit_players_insert;

INSERT INTO tryout_players (
  association_id, name, jersey_number, position, division,
  previous_team, team_id, status, status_updated_at
)
SELECT
  'a2000000-0000-0000-0000-000000000002',
  p.name,
  p.jersey_number,
  p.position,
  p.division,
  p.previous_team,
  sandbox_team.id,
  p.status,
  p.status_updated_at
FROM tryout_players p
LEFT JOIN teams src_team
  ON src_team.id = p.team_id
LEFT JOIN teams sandbox_team
  ON sandbox_team.association_id = 'a2000000-0000-0000-0000-000000000002'
  AND sandbox_team.division = src_team.division
  AND sandbox_team.name = src_team.name
WHERE p.association_id = 'a1000000-0000-0000-0000-000000000001'
  AND p.division = 'U15'
  AND p.deleted_at IS NULL
  AND p.suggested_by IS NULL;

ALTER TABLE tryout_players ENABLE TRIGGER trg_audit_players_insert;

-- ============================================================
-- 4. Clone continuation rounds for U15 from NGHA
-- ============================================================
INSERT INTO continuation_rounds (
  association_id, division, team_level, round_number,
  is_final_team, jersey_numbers, ip_players, sessions,
  status, source_url, scraped_at
)
SELECT
  'a2000000-0000-0000-0000-000000000002',
  division,
  team_level,
  round_number,
  is_final_team,
  jersey_numbers,
  ip_players,
  sessions,
  status,
  source_url,
  scraped_at
FROM continuation_rounds
WHERE association_id = 'a1000000-0000-0000-0000-000000000001'
  AND division = 'U15';

-- ============================================================
-- 5. Clone continuations URLs for U15 from NGHA
-- ============================================================
INSERT INTO continuations_urls (association_id, division, url)
SELECT
  'a2000000-0000-0000-0000-000000000002',
  division,
  url
FROM continuations_urls
WHERE association_id = 'a1000000-0000-0000-0000-000000000001'
  AND division = 'U15';

-- ============================================================
-- 6. Clone scraper configs from NGHA (association-level, not division-scoped)
-- ============================================================
INSERT INTO scraper_configs (association_id, label, url, selectors, last_scraped_at)
SELECT
  'a2000000-0000-0000-0000-000000000002',
  label,
  url,
  selectors,
  last_scraped_at
FROM scraper_configs
WHERE association_id = 'a1000000-0000-0000-0000-000000000001';

-- ============================================================
-- 7. Grant access to all NGHA admin/group_admin users
-- ============================================================
INSERT INTO user_associations (user_id, association_id, role)
SELECT
  user_id,
  'a2000000-0000-0000-0000-000000000002',
  'group_admin'
FROM user_associations
WHERE association_id = 'a1000000-0000-0000-0000-000000000001'
  AND role IN ('admin', 'group_admin');
