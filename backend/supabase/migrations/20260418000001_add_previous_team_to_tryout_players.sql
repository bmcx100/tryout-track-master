-- Description: Add previous_team column to tryout_players
-- Stores the player's full previous team label (e.g. "U13 AA", "U15 Minor A")
-- Needed for two-year cohorts: kids aging up + minors becoming majors

ALTER TABLE tryout_players
ADD COLUMN previous_team text;
