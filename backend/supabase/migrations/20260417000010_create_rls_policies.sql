-- ============================================================
-- associations
-- ============================================================

CREATE POLICY "Members can view their associations"
  ON associations FOR SELECT
  USING (user_belongs_to_association(id));

CREATE POLICY "Admins can view all associations"
  ON associations FOR SELECT
  USING (user_is_admin());

CREATE POLICY "Admins can create associations"
  ON associations FOR INSERT
  WITH CHECK (user_is_admin());

CREATE POLICY "Group admins can update own association"
  ON associations FOR UPDATE
  USING (user_is_group_admin_or_admin(id));

-- ============================================================
-- user_associations
-- ============================================================

CREATE POLICY "Users can view own memberships"
  ON user_associations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all memberships"
  ON user_associations FOR SELECT
  USING (user_is_admin());

CREATE POLICY "Group admins can view association members"
  ON user_associations FOR SELECT
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Users can join associations"
  ON user_associations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins can update member roles"
  ON user_associations FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can remove members"
  ON user_associations FOR DELETE
  USING (user_is_group_admin_or_admin(association_id));

-- ============================================================
-- teams
-- ============================================================

CREATE POLICY "Members can view teams"
  ON teams FOR SELECT
  USING (user_belongs_to_association(association_id));

CREATE POLICY "Group admins can create teams"
  ON teams FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can update teams"
  ON teams FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can delete teams"
  ON teams FOR DELETE
  USING (user_is_group_admin_or_admin(association_id));

-- ============================================================
-- tryout_players
-- ============================================================

CREATE POLICY "Members can view active players"
  ON tryout_players FOR SELECT
  USING (
    user_belongs_to_association(association_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "Group admins can view all players including deleted"
  ON tryout_players FOR SELECT
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can create players"
  ON tryout_players FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can update players"
  ON tryout_players FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id));

-- ============================================================
-- corrections
-- ============================================================

CREATE POLICY "Members can view own corrections"
  ON corrections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Group admins can view association corrections"
  ON corrections FOR SELECT
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Members can submit corrections"
  ON corrections FOR INSERT
  WITH CHECK (
    user_belongs_to_association(association_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "Group admins can review corrections"
  ON corrections FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id));

-- ============================================================
-- scraper_configs
-- ============================================================

CREATE POLICY "Group admins can view scraper configs"
  ON scraper_configs FOR SELECT
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can create scraper configs"
  ON scraper_configs FOR INSERT
  WITH CHECK (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can update scraper configs"
  ON scraper_configs FOR UPDATE
  USING (user_is_group_admin_or_admin(association_id));

CREATE POLICY "Group admins can delete scraper configs"
  ON scraper_configs FOR DELETE
  USING (user_is_group_admin_or_admin(association_id));

-- ============================================================
-- audit_log
-- ============================================================

CREATE POLICY "Group admins can view audit log"
  ON audit_log FOR SELECT
  USING (user_is_group_admin_or_admin(association_id));
