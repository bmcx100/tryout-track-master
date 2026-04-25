CREATE TABLE continuation_level_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  division text NOT NULL,
  team_level text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  UNIQUE (association_id, division, team_level)
);

ALTER TABLE continuation_level_status ENABLE ROW LEVEL SECURITY;

-- Members can read (needed to know which levels are active for parent-facing pages)
CREATE POLICY "Members can read level status"
  ON continuation_level_status FOR SELECT
  USING (user_belongs_to_association(association_id));

-- Admins can insert/update/delete
CREATE POLICY "Admins can manage level status"
  ON continuation_level_status FOR ALL
  USING (user_is_group_admin_or_admin(association_id))
  WITH CHECK (user_is_group_admin_or_admin(association_id));

-- Allow admins to insert audit log entries from server actions
CREATE POLICY "Admins can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));
