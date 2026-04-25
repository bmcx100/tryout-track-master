-- Allow admins to insert audit log entries from server actions
-- Previously, audit_log only had a SELECT policy (inserts came from triggers via SECURITY DEFINER)
CREATE POLICY "Admins can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));
