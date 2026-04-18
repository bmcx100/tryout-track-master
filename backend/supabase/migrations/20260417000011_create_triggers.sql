-- Auto-apply approved corrections to player records
CREATE FUNCTION apply_approved_correction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
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

CREATE TRIGGER trg_apply_correction
  AFTER UPDATE ON corrections
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION apply_approved_correction();

-- Audit logging for data-changing operations
CREATE FUNCTION log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_log (
    association_id,
    user_id,
    action,
    target_table,
    target_id,
    old_values,
    new_values
  ) VALUES (
    COALESCE(NEW.association_id, OLD.association_id),
    auth.uid(),
    TG_ARGV[0],
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Audit triggers on tryout_players
CREATE TRIGGER trg_audit_players_insert
  AFTER INSERT ON tryout_players
  FOR EACH ROW EXECUTE FUNCTION log_audit_event('player.create');

CREATE TRIGGER trg_audit_players_update
  AFTER UPDATE ON tryout_players
  FOR EACH ROW EXECUTE FUNCTION log_audit_event('player.update');

CREATE TRIGGER trg_audit_players_delete
  AFTER UPDATE ON tryout_players
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION log_audit_event('player.delete');

-- updated_at auto-touch
CREATE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_associations_updated_at
  BEFORE UPDATE ON associations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tryout_players_updated_at
  BEFORE UPDATE ON tryout_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scraper_configs_updated_at
  BEFORE UPDATE ON scraper_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
