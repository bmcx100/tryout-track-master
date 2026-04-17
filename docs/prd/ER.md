# Track Master -- Entity-Relationship Diagram

**Version:** 1.0
**Date:** 2026-04-17
**Status:** Approved
**Role System:** Three-tier (admin, group_admin, member)

---

## Entity-Relationship Diagram

```
+------------------+         +---------------------+
|   auth.users     |         |   associations      |
|  (Supabase-      |         |                     |
|   managed)       |         |  id (PK, uuid)      |
|                  |         |  name                |
|  id (PK, uuid)   |         |  abbreviation        |
|  email           |         |  logo_url (nullable) |
|  ...             |         |  join_code (unique)  |
+--------+---------+         |  join_enabled        |
         |                   |  season_end_date     |
         |                   |  data_purge_date     |
         |  1                |  created_at          |
         |                   |  updated_at          |
         |                   +----------+-----------+
         |                              | 1
         |                              |
         +----------+-------------------+
                    |
         +----------v-----------+
         |  user_associations   |
         |                      |
         |  user_id (FK)   PK   |
         |  association_id (FK) |  (composite PK)
         |  role (app_role)     |  -- admin | group_admin | member
         |  joined_at           |
         |  consent_given_at    |
         +----------------------+

+-------------------+        +---------------------+
|  associations     | 1    N |     teams            |
|  (id)             +--------+                     |
+-------------------+        |  id (PK, uuid)      |
                             |  association_id (FK) |
                             |  division            |
                             |  name                |
                             |  display_order       |
                             |  max_roster_size     |
                             |  is_archived         |
                             |  created_at          |
                             +----------+-----------+
                                        | 1
                                        |
                                        | (optional FK)
                                        |
+-------------------+        +----------v-----------+
|  associations     | 1    N |  tryout_players      |
|  (id)             +--------+                      |
+-------------------+        |  id (PK, uuid)       |
                             |  association_id (FK)  |
                             |  name                 |
                             |  jersey_number        |
                             |  division             |
                             |  team_id (FK, null)   |
                             |  status (player_status)|
                             |  status_updated_at    |
                             |  created_at           |
                             |  updated_at           |
                             |  deleted_at (null)    |
                             +----------+-----------+
                                        | 1
                                        |
                                        |
+-------------------+        +----------v-----------+
|  auth.users       | 1    N |    corrections       |
|  (id)             +--------+                      |
+-------------------+        |  id (PK, uuid)       |
                             |  player_id (FK)      |
                             |  user_id (FK)        |
                             |  association_id (FK)  |
                             |  field_name           |
                             |  old_value            |
                             |  new_value            |
                             |  note (nullable)      |
                             |  status (correction_  |
                             |          status)      |
                             |  reviewed_by (FK,null)|
                             |  reviewed_at (null)   |
                             |  created_at           |
                             +----------------------+

+-------------------+        +---------------------+
|  associations     | 1    N |  scraper_configs    |
|  (id)             +--------+                     |
+-------------------+        |  id (PK, uuid)      |
                             |  association_id (FK) |
                             |  label               |
                             |  url                 |
                             |  selectors (JSONB)   |
                             |  last_scraped_at     |
                             |  created_at          |
                             |  updated_at          |
                             +---------------------+

+-------------------+        +---------------------+
|  associations     | 1    N |    audit_log        |
|  (id)             +--------+                     |
+-------------------+        |  id (PK, uuid)      |
                             |  association_id (FK) |
                             |  user_id (FK)        |
                             |  action              |
                             |  target_table        |
                             |  target_id           |
                             |  old_values (JSONB)  |
                             |  new_values (JSONB)  |
                             |  created_at          |
                             +---------------------+
```

---

## Relationship Summary

```
auth.users 1 ---< N user_associations N >--- 1 associations
                        |
                        | (role: admin | group_admin | member)
                        |

associations 1 ---< N teams
associations 1 ---< N tryout_players
associations 1 ---< N corrections
associations 1 ---< N scraper_configs
associations 1 ---< N audit_log

teams 1 ---< N tryout_players (optional: team_id nullable)
tryout_players 1 ---< N corrections
auth.users 1 ---< N corrections (submitted by)
auth.users 1 ---< N corrections (reviewed by, nullable)
auth.users 1 ---< N audit_log (action performed by)
```

---

## PostgreSQL Enums

### player_status

Tracks a player's progression through the tryout process.

```sql
CREATE TYPE player_status AS ENUM (
  'registered',    -- Initial state: player registered for tryouts
  'trying_out',    -- Actively participating in tryouts
  'cut',           -- Eliminated from tryouts (terminal)
  'made_team',     -- Selected for a team roster (terminal)
  'moved_up',      -- Promoted to a higher division
  'moved_down',    -- Demoted to a lower division
  'withdrew'       -- Voluntarily left tryouts (terminal)
)
```

**Status Flow:**

```
registered --> trying_out --> cut (terminal)
                          --> made_team (terminal)
                          --> moved_up
                          --> moved_down
                          --> withdrew (terminal)
```

### app_role

Three-tier role system for access control.

```sql
CREATE TYPE app_role AS ENUM (
  'admin',         -- Site-level platform administrator
                   -- Full access to ALL associations
                   -- Manages platform health, user issues, system config
                   -- Not scoped to a single association

  'group_admin',   -- Association-level manager
                   -- Full read/write access to ONE association's data
                   -- Imports players, reviews corrections, configures scrapers
                   -- Manages members and join codes
                   -- Scoped to a specific association via user_associations

  'member'         -- Regular user (parent)
                   -- Read access to player data and team projections
                   -- Can submit corrections
                   -- Can view own correction history
                   -- Scoped to a specific association via user_associations
)
```

**Role Hierarchy:**

```
admin (platform-wide)
  |
  +-- group_admin (per association)
        |
        +-- member (per association)
```

A single user can hold different roles in different associations:
- User A could be `group_admin` in Association X and `member` in Association Y
- A user with `admin` role has implicit access to all associations regardless of specific `user_associations` records

### correction_status

Tracks the lifecycle of a correction request.

```sql
CREATE TYPE correction_status AS ENUM (
  'pending',    -- Submitted by member, awaiting review
  'approved',   -- Accepted by group admin, auto-applied to player record
  'rejected'    -- Declined by group admin
)
```

---

## Table Definitions

### associations

The top-level tenant entity. Each association represents a hockey organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| name | text | NOT NULL | Full association name (e.g., "Oakville Rangers Minor Hockey") |
| abbreviation | text | NOT NULL | Short name (e.g., "ORMH") |
| logo_url | text | NULLABLE | URL to association logo image |
| join_code | text | UNIQUE, NOT NULL | Code members use to join this association |
| join_enabled | boolean | NOT NULL, DEFAULT true | Whether new members can join via code |
| season_end_date | date | NULLABLE | Date the tryout season ends |
| data_purge_date | date | NULLABLE | Computed: season_end_date + 90 days |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

### user_associations

Many-to-many join table linking users to associations with role information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | PK (composite), FK -> auth.users | The user |
| association_id | uuid | PK (composite), FK -> associations | The association |
| role | app_role | NOT NULL, DEFAULT 'member' | User's role in this association |
| joined_at | timestamptz | NOT NULL, DEFAULT now() | When the user joined |
| consent_given_at | timestamptz | NULLABLE | When parental consent was given |

### teams

Teams within an age division of an association.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| association_id | uuid | FK -> associations, NOT NULL | Parent association |
| division | text | NOT NULL | Age division (e.g., "U13") |
| name | text | NOT NULL | Team name (e.g., "AA", "A", "BB") |
| display_order | integer | NOT NULL, DEFAULT 0 | Sort order within division |
| max_roster_size | integer | NOT NULL | Maximum players on this team |
| is_archived | boolean | NOT NULL, DEFAULT false | Whether team is archived |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation timestamp |

### tryout_players

Individual players in the tryout process. The core data entity of the application.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| association_id | uuid | FK -> associations, NOT NULL | Parent association |
| name | text | NOT NULL | Player's full name |
| jersey_number | text | NOT NULL | Jersey number |
| division | text | NOT NULL | Age division (e.g., "U13") |
| team_id | uuid | FK -> teams, NULLABLE | Assigned team (null if unassigned) |
| status | player_status | NOT NULL, DEFAULT 'registered' | Current tryout status |
| status_updated_at | timestamptz | NOT NULL, DEFAULT now() | When status last changed |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |
| deleted_at | timestamptz | NULLABLE | Soft delete timestamp (null = active) |

### corrections

Change requests submitted by members to fix inaccurate player data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| player_id | uuid | FK -> tryout_players, NOT NULL | The player being corrected |
| user_id | uuid | FK -> auth.users, NOT NULL | The member who submitted the correction |
| association_id | uuid | FK -> associations, NOT NULL | Parent association |
| field_name | text | NOT NULL | Which field is being corrected (e.g., "status", "team", "jersey_number") |
| old_value | text | NOT NULL | The current (incorrect) value |
| new_value | text | NOT NULL | The proposed (correct) value |
| note | text | NULLABLE | Optional explanation from the submitter |
| status | correction_status | NOT NULL, DEFAULT 'pending' | Review status |
| reviewed_by | uuid | FK -> auth.users, NULLABLE | The group admin who reviewed |
| reviewed_at | timestamptz | NULLABLE | When the review occurred |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Submission timestamp |

### scraper_configs

Per-association web scraper configurations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| association_id | uuid | FK -> associations, NOT NULL | Parent association |
| label | text | NOT NULL | Human-readable label for this config |
| url | text | NOT NULL | Target URL to scrape |
| selectors | jsonb | NOT NULL | CSS selectors and status mappings (see Selectors Schema below) |
| last_scraped_at | timestamptz | NULLABLE | When this config was last used |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Selectors JSONB Schema:**

```json
{
  "row": "table.results tbody tr",
  "name": "td:nth-child(1)",
  "jersey_number": "td:nth-child(2)",
  "status": "td:nth-child(3)",
  "team": "td:nth-child(4)",
  "division": "td:nth-child(5)",
  "status_map": {
    "RELEASED": "cut",
    "ACTIVE": "trying_out",
    "ROSTERED": "made_team"
  }
}
```

### audit_log

Immutable log of all data-changing operations. Written by database triggers, not by application code.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, gen_random_uuid() | Unique identifier |
| association_id | uuid | FK -> associations, NOT NULL | Parent association |
| user_id | uuid | FK -> auth.users, NOT NULL | User who performed the action |
| action | text | NOT NULL | Action type (e.g., "player.create", "player.status_change", "import.csv", "correction.approve") |
| target_table | text | NOT NULL | Table affected (e.g., "tryout_players") |
| target_id | uuid | NOT NULL | ID of the affected record |
| old_values | jsonb | NULLABLE | Previous values (for updates) |
| new_values | jsonb | NULLABLE | New values (for creates and updates) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | When the action occurred |

---

## Key Indexes

```sql
-- Player list queries (the most common operation)
CREATE INDEX idx_players_assoc_div_status
  ON tryout_players (association_id, division, status)
  WHERE deleted_at IS NULL

-- Player search by name
CREATE INDEX idx_players_assoc_name
  ON tryout_players (association_id, name)
  WHERE deleted_at IS NULL

-- Pending corrections count (group admin badge)
CREATE INDEX idx_corrections_pending
  ON corrections (association_id, status)
  WHERE status = 'pending'

-- Audit log chronological view
CREATE INDEX idx_audit_assoc_created
  ON audit_log (association_id, created_at DESC)

-- Join code lookup
CREATE UNIQUE INDEX idx_assoc_join_code
  ON associations (join_code)

-- Duplicate correction prevention
CREATE UNIQUE INDEX idx_corrections_unique_pending
  ON corrections (player_id, field_name)
  WHERE status = 'pending'

-- User association lookups (used by RLS helper functions)
CREATE INDEX idx_user_assoc_user
  ON user_associations (user_id)

CREATE INDEX idx_user_assoc_association
  ON user_associations (association_id)
```

---

## RLS Helper Functions

```sql
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
$$

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
$$

-- Check if the authenticated user is a group admin OR admin for an association
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
$$

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
$$
```

---

## RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `associations` | Member of association OR admin | Group admin or admin (create) | Group admin (own) or admin | Never (soft operations only) |
| `user_associations` | Own rows only (or admin sees all) | Self (join via code) or admin | Group admin (own association) or admin | Group admin (own association) or admin (remove members) |
| `tryout_players` | Member of association OR admin | Group admin (own association) or admin | Group admin (own association) or admin | Group admin (own association) or admin (soft delete) |
| `teams` | Member of association OR admin | Group admin (own association) or admin | Group admin (own association) or admin | Group admin (own association) or admin |
| `corrections` | Own rows (member) or all in association (group admin) or all (admin) | Member of association | Group admin (own association) or admin (approve/reject) | Never |
| `scraper_configs` | Group admin (own association) or admin | Group admin (own association) or admin | Group admin (own association) or admin | Group admin (own association) or admin |
| `audit_log` | Group admin (own association) or admin (all) | System only (via triggers) | Never | Never |

---

## Example RLS Policies (Updated for Three-Tier Roles)

```sql
-- tryout_players: anyone in the association can read active players
CREATE POLICY "Members can view players"
  ON tryout_players FOR SELECT
  USING (
    user_belongs_to_association(association_id)
    AND deleted_at IS NULL
  )

-- tryout_players: group admins and admins can insert
CREATE POLICY "Group admins can create players"
  ON tryout_players FOR INSERT
  WITH CHECK (
    user_is_group_admin_or_admin(association_id)
  )

-- tryout_players: group admins and admins can update
CREATE POLICY "Group admins can update players"
  ON tryout_players FOR UPDATE
  USING (
    user_is_group_admin_or_admin(association_id)
  )

-- corrections: members can submit corrections for their association
CREATE POLICY "Members can submit corrections"
  ON corrections FOR INSERT
  WITH CHECK (
    user_belongs_to_association(association_id)
    AND user_id = auth.uid()
  )

-- corrections: group admins can review corrections in their association
CREATE POLICY "Group admins can review corrections"
  ON corrections FOR UPDATE
  USING (
    user_is_group_admin_or_admin(association_id)
  )

-- audit_log: group admins can view their association's logs, admins can view all
CREATE POLICY "Group admins can view audit log"
  ON audit_log FOR SELECT
  USING (
    user_is_group_admin_or_admin(association_id)
  )
```

---

## Database Triggers

### Auto-Apply Approved Corrections

```sql
CREATE FUNCTION apply_approved_correction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Dynamically update the target field on the player record
    EXECUTE format(
      'UPDATE tryout_players SET %I = $1, updated_at = now() WHERE id = $2',
      NEW.field_name
    ) USING NEW.new_value, NEW.player_id;

    -- If the corrected field is 'status', also update status_updated_at
    IF NEW.field_name = 'status' THEN
      UPDATE tryout_players
      SET status_updated_at = now()
      WHERE id = NEW.player_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$

CREATE TRIGGER trg_apply_correction
  AFTER UPDATE ON corrections
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION apply_approved_correction()
```

### Audit Logging Trigger

```sql
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
$$

-- Applied to tryout_players for all operations
CREATE TRIGGER trg_audit_players_insert
  AFTER INSERT ON tryout_players
  FOR EACH ROW EXECUTE FUNCTION log_audit_event('player.create')

CREATE TRIGGER trg_audit_players_update
  AFTER UPDATE ON tryout_players
  FOR EACH ROW EXECUTE FUNCTION log_audit_event('player.update')

CREATE TRIGGER trg_audit_players_delete
  AFTER UPDATE ON tryout_players
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION log_audit_event('player.delete')
```
