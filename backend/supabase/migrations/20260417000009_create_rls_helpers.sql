-- Check if the authenticated user belongs to an association
CREATE FUNCTION user_belongs_to_association(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
  )
$$;

-- Check if the authenticated user is a group admin for an association
CREATE FUNCTION user_is_group_admin(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
      AND role = 'group_admin'
  )
$$;

-- Check if the authenticated user is a group admin OR site-level admin
CREATE FUNCTION user_is_group_admin_or_admin(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
      AND role IN ('group_admin', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Check if the authenticated user is a site-level admin
CREATE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;
