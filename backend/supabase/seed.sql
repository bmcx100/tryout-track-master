-- ============================================================
-- Development Seed Data
-- Run via: cd backend && supabase db reset
-- ============================================================

-- Association: Oakville Rangers Minor Hockey
INSERT INTO associations (id, name, abbreviation, join_code, join_enabled)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Oakville Rangers Minor Hockey',
  'ORMH',
  'ORMH2026',
  true
);

-- Teams for U13 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'U13', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'U13', 'A',   2, 17),
  ('t1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'U13', 'BB',  3, 17),
  ('t1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'U13', 'B',   4, 17);

-- Teams for U11 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'U11', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'U11', 'A',   2, 17),
  ('t1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'U11', 'BB',  3, 17),
  ('t1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'U11', 'B',   4, 17);

-- Teams for U15 division
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size) VALUES
  ('t1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'U15', 'AA',  1, 17),
  ('t1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'U15', 'A',   2, 17);

-- ============================================================
-- After signup, run this in Supabase SQL editor to make yourself admin:
--
-- INSERT INTO user_associations (user_id, association_id, role)
-- VALUES ('<your-user-uuid>', 'a1000000-0000-0000-0000-000000000001', 'group_admin');
-- ============================================================
