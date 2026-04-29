-- Normalize previous_team values: remove spaces between division prefix and tier
-- e.g. "U15 B" → "U15B", "U18 AA" → "U18AA"

-- 1. Normalize tryout_players.previous_team
UPDATE tryout_players
SET previous_team = regexp_replace(previous_team, '^(U\d+)\s+', '\1', 'i')
WHERE previous_team ~ '^U\d+\s+';

-- 2. Normalize previous_team_orders and team_group_orders if they exist
DO $$
BEGIN
  -- Normalize previous_team_orders.previous_team (the grouping key)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'previous_team_orders') THEN
    -- Delete spaced variants that have a normalized counterpart (avoid unique constraint violation)
    DELETE FROM previous_team_orders
    WHERE previous_team ~ '^U\d+\s+'
      AND EXISTS (
        SELECT 1 FROM previous_team_orders AS pto2
        WHERE pto2.user_id = previous_team_orders.user_id
          AND pto2.association_id = previous_team_orders.association_id
          AND pto2.previous_team = regexp_replace(previous_team_orders.previous_team, '^(U\d+)\s+', '\1', 'i')
      );

    UPDATE previous_team_orders
    SET previous_team = regexp_replace(previous_team, '^(U\d+)\s+', '\1', 'i')
    WHERE previous_team ~ '^U\d+\s+';
  END IF;

  -- Normalize team_group_orders.team_order array entries
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_group_orders') THEN
    UPDATE team_group_orders
    SET team_order = (
      SELECT array_agg(regexp_replace(elem, '^(U\d+)\s+', '\1', 'i') ORDER BY ord)
      FROM unnest(team_order) WITH ORDINALITY AS t(elem, ord)
    )
    WHERE EXISTS (
      SELECT 1 FROM unnest(team_order) AS elem
      WHERE elem ~ '^U\d+\s+'
    );
  END IF;
END $$;
