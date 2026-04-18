-- Track Master database enums

-- Player tryout status progression
CREATE TYPE player_status AS ENUM (
  'registered',
  'trying_out',
  'cut',
  'made_team',
  'moved_up',
  'moved_down',
  'withdrew'
);

-- Three-tier role system
CREATE TYPE app_role AS ENUM (
  'admin',
  'group_admin',
  'member'
);

-- Correction request lifecycle
CREATE TYPE correction_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);
