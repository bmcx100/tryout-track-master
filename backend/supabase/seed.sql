-- ============================================================
-- Seed data for local development
-- Run: cd backend && supabase db reset
-- ============================================================

-- Test associations
INSERT INTO associations (id, name, abbreviation, join_code, season_end_date)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oakville Rangers Minor Hockey', 'ORMH', 'ORMH2026', '2026-06-30'),
  ('a1000000-0000-0000-0000-000000000002', 'Burlington Eagles Hockey', 'BEH', 'BEH2026', '2026-06-30');

-- Compute purge dates (90 days after season end)
UPDATE associations
SET data_purge_date = season_end_date + INTERVAL '90 days';

-- Teams for ORMH
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size)
VALUES
  ('t1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'U11', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'U11', 'A', 2, 17),
  ('t1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'U13', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'U13', 'A', 2, 17);

-- Teams for BEH
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size)
VALUES
  ('t1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'U11', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'U13', 'AA', 1, 17);

-- Sample players for ORMH U11
INSERT INTO tryout_players (association_id, name, jersey_number, division, status, previous_team)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Liam Johnson', '12', 'U11', 'trying_out', 'U9 AA'),
  ('a1000000-0000-0000-0000-000000000001', 'Noah Williams', '7', 'U11', 'trying_out', 'U9 A'),
  ('a1000000-0000-0000-0000-000000000001', 'Ethan Brown', '19', 'U11', 'registered', NULL),
  ('a1000000-0000-0000-0000-000000000001', 'Mason Davis', '4', 'U11', 'cut', 'U9 A'),
  ('a1000000-0000-0000-0000-000000000001', 'Lucas Wilson', '22', 'U11', 'made_team', 'U9 AA');

-- Sample players for ORMH U13
INSERT INTO tryout_players (association_id, name, jersey_number, division, status, previous_team)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oliver Taylor', '9', 'U13', 'trying_out', 'U11 AA'),
  ('a1000000-0000-0000-0000-000000000001', 'James Anderson', '15', 'U13', 'trying_out', 'U11 A'),
  ('a1000000-0000-0000-0000-000000000001', 'Benjamin Thomas', '33', 'U13', 'moved_up', 'U11 A');

-- Assign a made_team player to a team
UPDATE tryout_players
SET team_id = 't1000000-0000-0000-0000-000000000001'
WHERE name = 'Lucas Wilson';

-- Note: user_associations seed data requires actual auth.users records.
-- After creating a user via Supabase Auth (email signup or dashboard),
-- manually insert into user_associations:
--
-- INSERT INTO user_associations (user_id, association_id, role)
-- VALUES ('<your-user-id>', 'a1000000-0000-0000-0000-000000000001', 'group_admin');
