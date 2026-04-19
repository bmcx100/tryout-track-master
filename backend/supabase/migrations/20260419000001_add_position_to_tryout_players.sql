-- Description: Add position column to tryout_players
-- Stores player position: F (forward), D (defense), G (goalie), or ? (unknown)

ALTER TABLE tryout_players
ADD COLUMN position text NOT NULL DEFAULT '?';
