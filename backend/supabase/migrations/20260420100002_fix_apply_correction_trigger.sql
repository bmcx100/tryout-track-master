-- Description: Fix apply_approved_correction trigger to skip add_player corrections.
-- The add_player field_name is not a real column on tryout_players — it's a
-- special correction type handled by application code (reviewSuggestedPlayer).

CREATE OR REPLACE FUNCTION apply_approved_correction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Skip add_player corrections; they are handled by application code
    IF NEW.field_name = 'add_player' THEN
      RETURN NEW;
    END IF;

    EXECUTE format(
      'UPDATE tryout_players SET %I = $1, updated_at = now() WHERE id = $2',
      NEW.field_name
    ) USING NEW.new_value, NEW.player_id;

    IF NEW.field_name = 'status' THEN
      UPDATE tryout_players
      SET status_updated_at = now()
      WHERE id = NEW.player_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
