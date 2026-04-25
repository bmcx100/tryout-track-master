-- Description: Add per-position estimated player counts to continuation_rounds
-- Adds estimated_players_f (forwards), estimated_players_d (defence), estimated_players_g (goalies)
-- The existing estimated_players column serves as the Total / All field

ALTER TABLE continuation_rounds
  ADD COLUMN estimated_players_f integer,
  ADD COLUMN estimated_players_d integer,
  ADD COLUMN estimated_players_g integer;
