-- Player list queries (the most common operation)
CREATE INDEX idx_players_assoc_div_status
  ON tryout_players (association_id, division, status)
  WHERE deleted_at IS NULL;

-- Player search by name
CREATE INDEX idx_players_assoc_name
  ON tryout_players (association_id, name)
  WHERE deleted_at IS NULL;

-- Pending corrections count (group admin badge)
CREATE INDEX idx_corrections_pending
  ON corrections (association_id, status)
  WHERE status = 'pending';

-- Audit log chronological view
CREATE INDEX idx_audit_assoc_created
  ON audit_log (association_id, created_at DESC);

-- Join code lookup
CREATE UNIQUE INDEX idx_assoc_join_code
  ON associations (join_code);

-- Duplicate correction prevention
CREATE UNIQUE INDEX idx_corrections_unique_pending
  ON corrections (player_id, field_name)
  WHERE status = 'pending';

-- User association lookups (used by RLS helper functions)
CREATE INDEX idx_user_assoc_user
  ON user_associations (user_id);

CREATE INDEX idx_user_assoc_association
  ON user_associations (association_id);
