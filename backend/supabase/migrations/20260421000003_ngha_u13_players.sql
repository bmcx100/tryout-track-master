-- NGHA (Nepean Wildcats) - U13 Division player import
-- Association ID: a1000000-0000-0000-0000-000000000001

-- Disable audit trigger (uses auth.uid() which is NULL in migrations)
ALTER TABLE tryout_players DISABLE TRIGGER trg_audit_players_insert;

-- Insert U13 players (previous team: U13A)
INSERT INTO tryout_players (association_id, jersey_number, name, position, division, previous_team, status)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '366', 'Allie Langis', 'D', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '414', 'Hailey Clark', 'D', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '610', 'Kailee Holwell', 'D', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '6', 'Grace Carter', 'F', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '497', 'Tessa Taniguchi', 'F', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '499', 'Ava Mitchell', 'F', 'U13', 'U13A', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', '933', 'Haddy', 'G', 'U13', 'U13A', 'registered');

-- Re-enable audit trigger
ALTER TABLE tryout_players ENABLE TRIGGER trg_audit_players_insert;
