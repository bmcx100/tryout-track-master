-- Description: Add multi-team level support (sub-team splitting)
-- Adds sub_team column to tryout_players and split columns to continuation_level_status

-- 1. Add sub_team to tryout_players
ALTER TABLE tryout_players
  ADD COLUMN IF NOT EXISTS sub_team text DEFAULT NULL;

-- 2. Add split columns to continuation_level_status
ALTER TABLE continuation_level_status
  ADD COLUMN IF NOT EXISTS is_split boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_team_1_name text DEFAULT 'Team 1',
  ADD COLUMN IF NOT EXISTS sub_team_2_name text DEFAULT 'Team 2';
