# Monorepo Restructure, Database, and Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the flat Next.js project into a monorepo with frontend/, backend/ (Supabase), and infrastructure/ directories, then build the full database schema and implement Supabase authentication.

**Architecture:** Move existing Next.js files into `frontend/`, initialize Supabase in `backend/supabase/`, write SQL migrations for all tables/enums/RLS/triggers from the ER diagram, and implement `@supabase/ssr` auth with `proxy.ts`, OAuth callback, and login/signup pages.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL + Auth), `@supabase/ssr`

---

## File Structure

### Files to Move (root -> frontend/)

```
app/                    -> frontend/app/
components/             -> frontend/components/
lib/                    -> frontend/lib/
public/                 -> frontend/public/
package.json            -> frontend/package.json
package-lock.json       -> frontend/package-lock.json
tsconfig.json           -> frontend/tsconfig.json
next.config.ts          -> frontend/next.config.ts
postcss.config.mjs      -> frontend/postcss.config.mjs
eslint.config.mjs       -> frontend/eslint.config.mjs
components.json         -> frontend/components.json
next-env.d.ts           -> frontend/next-env.d.ts
tool-use.json           -> frontend/tool-use.json
```

### Files to Create

```
frontend/
  proxy.ts                          # Root proxy (session refresh)
  lib/supabase/
    client.ts                       # Browser Supabase client
    server.ts                       # Server Supabase client
    proxy.ts                        # Proxy helper (updateSession)
  app/
    (public)/
      layout.tsx                    # Public layout (no nav)
      login/page.tsx                # Login page
      signup/page.tsx               # Signup page
    auth/
      callback/route.ts            # OAuth/email code exchange
      auth-code-error/page.tsx     # Auth error fallback
    logout/page.tsx                 # Server component sign out
  types/
    database.ts                     # Placeholder for generated types
  .env.local.example                # Env var template

backend/
  supabase/
    config.toml                     # Supabase local dev config
    seed.sql                        # Dev seed data
    migrations/
      20260417000001_create_enums.sql
      20260417000002_create_associations.sql
      20260417000003_create_user_associations.sql
      20260417000004_create_teams.sql
      20260417000005_create_tryout_players.sql
      20260417000006_create_corrections.sql
      20260417000007_create_scraper_configs.sql
      20260417000008_create_audit_log.sql
      20260417000009_create_rls_helpers.sql
      20260417000010_create_rls_policies.sql
      20260417000011_create_triggers.sql
      20260417000012_create_indexes.sql
```

### Files to Modify

```
.gitignore              # Update for monorepo paths
vercel.json             # Move to frontend/ and simplify
frontend/package.json   # Rename, add @supabase/ssr dep
frontend/app/layout.tsx # Update metadata for Track Master
frontend/app/page.tsx   # Replace boilerplate with landing content
```

---

### Task 1: Move Next.js Source Files to frontend/

**Files:**
- Move: `app/` -> `frontend/app/`
- Move: `components/` -> `frontend/components/`
- Move: `lib/` -> `frontend/lib/`
- Move: `public/` -> `frontend/public/`

- [ ] **Step 1: Move source directories with git**

```bash
cd /home/data/Documents/webapps/track-master
git mv app/ frontend/app/
git mv components/ frontend/components/
git mv lib/ frontend/lib/
git mv public/ frontend/public/
```

- [ ] **Step 2: Verify the moves**

Run: `ls frontend/`
Expected: `app/  CLAUDE.md  components/  lib/  public/`

---

### Task 2: Move Config Files to frontend/

**Files:**
- Move: `package.json` -> `frontend/package.json`
- Move: `package-lock.json` -> `frontend/package-lock.json`
- Move: `tsconfig.json` -> `frontend/tsconfig.json`
- Move: `next.config.ts` -> `frontend/next.config.ts`
- Move: `postcss.config.mjs` -> `frontend/postcss.config.mjs`
- Move: `eslint.config.mjs` -> `frontend/eslint.config.mjs`
- Move: `components.json` -> `frontend/components.json`
- Move: `next-env.d.ts` -> `frontend/next-env.d.ts`
- Move: `tool-use.json` -> `frontend/tool-use.json`
- Move: `vercel.json` -> `frontend/vercel.json`

- [ ] **Step 1: Move config files with git**

```bash
cd /home/data/Documents/webapps/track-master
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv tsconfig.json frontend/tsconfig.json
git mv next.config.ts frontend/next.config.ts
git mv postcss.config.mjs frontend/postcss.config.mjs
git mv eslint.config.mjs frontend/eslint.config.mjs
git mv components.json frontend/components.json
git mv next-env.d.ts frontend/next-env.d.ts
git mv tool-use.json frontend/tool-use.json
git mv vercel.json frontend/vercel.json
```

- [ ] **Step 2: Delete root-level build artifacts**

```bash
rm -rf /home/data/Documents/webapps/track-master/.next
rm -rf /home/data/Documents/webapps/track-master/node_modules
```

---

### Task 3: Update Configs for Monorepo

**Files:**
- Modify: `frontend/package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update package.json name**

In `frontend/package.json`, change the `name` field:

```json
"name": "track-master"
```

- [ ] **Step 2: Update .gitignore for monorepo**

Replace the contents of `.gitignore` with:

```gitignore
# dependencies
node_modules/
.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
coverage/

# next.js
.next/
out/

# production
build/

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files
.env*
!.env.local.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# supabase
.branches
.temp
```

Note: removed leading `/` from paths so patterns match recursively in the monorepo.

- [ ] **Step 3: Install dependencies in frontend/**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npm install
```

- [ ] **Step 4: Verify the build**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit the monorepo restructure**

```bash
cd /home/data/Documents/webapps/track-master
git add -A
git commit -m "$(cat <<'EOF'
refactor: restructure repo into monorepo layout

Move all Next.js source files and configs into frontend/.
Update .gitignore for recursive monorepo patterns.
backend/ and infrastructure/ directories already exist from PRD generation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Initialize Supabase in backend/

**Files:**
- Create: `backend/supabase/config.toml`
- Create: `backend/supabase/migrations/` (empty directory)
- Create: `backend/supabase/seed.sql` (placeholder)
- Create: `backend/.env.local.example`

- [ ] **Step 1: Check if Supabase CLI is available**

```bash
which supabase || npx supabase --version
```

If not available, install:

```bash
npm install -g supabase
```

- [ ] **Step 2: Initialize Supabase in backend/**

```bash
cd /home/data/Documents/webapps/track-master/backend && supabase init
```

This creates `backend/supabase/` with `config.toml` and the `migrations/` directory.

If the CLI is not available or init fails, create the structure manually:

```bash
mkdir -p /home/data/Documents/webapps/track-master/backend/supabase/migrations
mkdir -p /home/data/Documents/webapps/track-master/backend/supabase/functions
```

And create `backend/supabase/config.toml` with default local dev config.

- [ ] **Step 3: Create env template**

Create `backend/.env.local.example`:

```env
# Supabase project credentials
# Get these from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 4: Create frontend env template**

Create `frontend/.env.local.example`:

```env
# Supabase project credentials
# For local dev, get these from `cd backend && supabase status`
# For production, get from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

---

### Task 5: Create Database Enums Migration

**Files:**
- Create: `backend/supabase/migrations/20260417000001_create_enums.sql`

- [ ] **Step 1: Write the enums migration**

```sql
-- 20260417000001_create_enums.sql
-- Track Master database enums

-- Player tryout status progression
CREATE TYPE player_status AS ENUM (
  'registered',
  'trying_out',
  'cut',
  'made_team',
  'moved_up',
  'moved_down',
  'withdrew'
);

-- Three-tier role system
CREATE TYPE app_role AS ENUM (
  'admin',
  'group_admin',
  'member'
);

-- Correction request lifecycle
CREATE TYPE correction_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);
```

---

### Task 6: Create Table Migrations

**Files:**
- Create: `backend/supabase/migrations/20260417000002_create_associations.sql`
- Create: `backend/supabase/migrations/20260417000003_create_user_associations.sql`
- Create: `backend/supabase/migrations/20260417000004_create_teams.sql`
- Create: `backend/supabase/migrations/20260417000005_create_tryout_players.sql`
- Create: `backend/supabase/migrations/20260417000006_create_corrections.sql`
- Create: `backend/supabase/migrations/20260417000007_create_scraper_configs.sql`
- Create: `backend/supabase/migrations/20260417000008_create_audit_log.sql`

- [ ] **Step 1: Create associations table**

`backend/supabase/migrations/20260417000002_create_associations.sql`:

```sql
CREATE TABLE associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL,
  logo_url text,
  join_code text UNIQUE NOT NULL,
  join_enabled boolean NOT NULL DEFAULT true,
  season_end_date date,
  data_purge_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Create user_associations table**

`backend/supabase/migrations/20260417000003_create_user_associations.sql`:

```sql
CREATE TABLE user_associations (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  consent_given_at timestamptz,
  PRIMARY KEY (user_id, association_id)
);

ALTER TABLE user_associations ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Create teams table**

`backend/supabase/migrations/20260417000004_create_teams.sql`:

```sql
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  division text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  max_roster_size integer NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Create tryout_players table**

`backend/supabase/migrations/20260417000005_create_tryout_players.sql`:

```sql
CREATE TABLE tryout_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  name text NOT NULL,
  jersey_number text NOT NULL,
  division text NOT NULL,
  team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
  status player_status NOT NULL DEFAULT 'registered',
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE tryout_players ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 5: Create corrections table**

`backend/supabase/migrations/20260417000006_create_corrections.sql`:

```sql
CREATE TABLE corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES tryout_players (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  note text,
  status correction_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 6: Create scraper_configs table**

`backend/supabase/migrations/20260417000007_create_scraper_configs.sql`:

```sql
CREATE TABLE scraper_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  selectors jsonb NOT NULL,
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 7: Create audit_log table**

`backend/supabase/migrations/20260417000008_create_audit_log.sql`:

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id),
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

---

### Task 7: Create RLS Helper Functions Migration

**Files:**
- Create: `backend/supabase/migrations/20260417000009_create_rls_helpers.sql`

- [ ] **Step 1: Write all four helper functions**

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
```

---

### Task 8: Create RLS Policies Migration

**Files:**
- Create: `backend/supabase/migrations/20260417000010_create_rls_policies.sql`

- [ ] **Step 1: Write RLS policies for all tables**

```sql
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
```

---

### Task 9: Create Triggers Migration

**Files:**
- Create: `backend/supabase/migrations/20260417000011_create_triggers.sql`

- [ ] **Step 1: Write the auto-apply correction trigger**

```sql
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
```

- [ ] **Step 2: Write the audit logging trigger**

Append to the same migration file:

```sql
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

-- updated_at auto-touch for associations
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
```

---

### Task 10: Create Indexes Migration

**Files:**
- Create: `backend/supabase/migrations/20260417000012_create_indexes.sql`

- [ ] **Step 1: Write all indexes**

```sql
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

-- Join code lookup (already unique constraint, but explicit)
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
```

---

### Task 11: Create Seed Data and Commit Database

**Files:**
- Create: `backend/supabase/seed.sql`

- [ ] **Step 1: Write seed data**

```sql
-- ============================================================
-- Seed data for local development
-- Run: cd backend && supabase db reset
-- ============================================================

-- Test associations
INSERT INTO associations (id, name, abbreviation, join_code, season_end_date)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oakville Rangers Minor Hockey', 'ORMH', 'ORMH2026', '2026-06-30'),
  ('a1000000-0000-0000-0000-000000000002', 'Burlington Eagles Hockey', 'BEH', 'BEH2026', '2026-06-30');

-- Compute purge dates (90 days after season end)
UPDATE associations
SET data_purge_date = season_end_date + INTERVAL '90 days';

-- Teams for ORMH
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size)
VALUES
  ('t1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'U11', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'U11', 'A', 2, 17),
  ('t1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'U13', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'U13', 'A', 2, 17);

-- Teams for BEH
INSERT INTO teams (id, association_id, division, name, display_order, max_roster_size)
VALUES
  ('t1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'U11', 'AA', 1, 17),
  ('t1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'U13', 'AA', 1, 17);

-- Sample players for ORMH U11
INSERT INTO tryout_players (association_id, name, jersey_number, division, status)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Liam Johnson', '12', 'U11', 'trying_out'),
  ('a1000000-0000-0000-0000-000000000001', 'Noah Williams', '7', 'U11', 'trying_out'),
  ('a1000000-0000-0000-0000-000000000001', 'Ethan Brown', '19', 'U11', 'registered'),
  ('a1000000-0000-0000-0000-000000000001', 'Mason Davis', '4', 'U11', 'cut'),
  ('a1000000-0000-0000-0000-000000000001', 'Lucas Wilson', '22', 'U11', 'made_team');

-- Sample players for ORMH U13
INSERT INTO tryout_players (association_id, name, jersey_number, division, status)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oliver Taylor', '9', 'U13', 'trying_out'),
  ('a1000000-0000-0000-0000-000000000001', 'James Anderson', '15', 'U13', 'trying_out'),
  ('a1000000-0000-0000-0000-000000000001', 'Benjamin Thomas', '33', 'U13', 'moved_up');

-- Assign a made_team player to a team
UPDATE tryout_players
SET team_id = 't1000000-0000-0000-0000-000000000001'
WHERE name = 'Lucas Wilson';

-- Note: user_associations seed data requires actual auth.users records.
-- After creating a user via Supabase Auth (email signup or dashboard),
-- manually insert into user_associations:
--
-- INSERT INTO user_associations (user_id, association_id, role)
-- VALUES ('<your-user-id>', 'a1000000-0000-0000-0000-000000000001', 'group_admin');
```

- [ ] **Step 2: Commit database migrations**

```bash
cd /home/data/Documents/webapps/track-master
git add backend/
git commit -m "$(cat <<'EOF'
feat(db): add all database migrations, RLS policies, and seed data

Migrations create enums (player_status, app_role, correction_status),
all seven tables with RLS enabled, SECURITY DEFINER helper functions,
RLS policies for multi-tenant access control, audit logging triggers,
auto-apply correction trigger, and performance indexes.

Includes seed data with two test associations, teams, and sample players.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Install Auth Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install @supabase/ssr**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Verify installation**

Run: `cd /home/data/Documents/webapps/track-master/frontend && node -e "require('@supabase/ssr')"`
Expected: No error.

---

### Task 13: Create Supabase Client Factories

**Files:**
- Create: `frontend/lib/supabase/client.ts`
- Create: `frontend/lib/supabase/server.ts`
- Create: `frontend/lib/supabase/proxy.ts`
- Create: `frontend/types/database.ts`

Reference: Follow patterns EXACTLY from `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md`

- [ ] **Step 1: Create browser client**

`frontend/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

`frontend/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create proxy helper**

`frontend/lib/supabase/proxy.ts`:

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims()

  const user = data?.claims

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 4: Create placeholder types file**

`frontend/types/database.ts`:

```typescript
// Auto-generated Supabase types
// Regenerate with: cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
// This placeholder allows TypeScript compilation before types are generated.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      app_role: "admin" | "group_admin" | "member"
      correction_status: "pending" | "approved" | "rejected"
      player_status:
        | "registered"
        | "trying_out"
        | "cut"
        | "made_team"
        | "moved_up"
        | "moved_down"
        | "withdrew"
    }
    CompositeTypes: Record<string, never>
  }
}
```

---

### Task 14: Create Root Proxy

**Files:**
- Create: `frontend/proxy.ts`

Reference: Follow patterns EXACTLY from `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md`

- [ ] **Step 1: Create root proxy.ts**

`frontend/proxy.ts`:

```typescript
import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Common image extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

---

### Task 15: Create Auth Routes and Pages

**Files:**
- Create: `frontend/app/auth/callback/route.ts`
- Create: `frontend/app/auth/auth-code-error/page.tsx`
- Create: `frontend/app/logout/page.tsx`
- Create: `frontend/app/(public)/layout.tsx`
- Create: `frontend/app/(public)/login/page.tsx`
- Create: `frontend/app/(public)/signup/page.tsx`
- Modify: `frontend/app/page.tsx` (move to `(public)` route group)

- [ ] **Step 1: Create auth callback route**

`frontend/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  let next = searchParams.get("next") ?? "/"
  if (!next.startsWith("/")) {
    next = "/"
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = process.env.NODE_ENV === "development"
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

- [ ] **Step 2: Create auth error page**

`frontend/app/auth/auth-code-error/page.tsx`:

```tsx
import Link from "next/link"

export default function AuthCodeError() {
  return (
    <div className="auth-error-page">
      <div className="auth-error-card">
        <h1 className="auth-error-title">Authentication Error</h1>
        <p className="auth-error-message">
          Something went wrong during authentication.
          Please try again.
        </p>
        <Link href="/login" className="auth-error-link">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
```

Add styles to `frontend/app/globals.css` (append before closing):

```css
.auth-error-page {
  @apply flex min-h-screen items-center justify-center px-4;
}

.auth-error-card {
  @apply flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm;
}

.auth-error-title {
  @apply text-2xl font-bold text-foreground;
}

.auth-error-message {
  @apply text-muted-foreground;
}

.auth-error-link {
  @apply text-sm font-medium text-primary underline underline-offset-4;
}
```

- [ ] **Step 3: Create logout page (server component)**

`frontend/app/logout/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function LogoutPage() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
```

- [ ] **Step 4: Create public route group layout**

`frontend/app/(public)/layout.tsx`:

```tsx
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="public-layout">
      {children}
    </div>
  )
}
```

Add styles to `frontend/app/globals.css`:

```css
.public-layout {
  @apply flex min-h-screen flex-col items-center justify-center bg-background;
}
```

- [ ] **Step 5: Move landing page into (public) route group**

Move `frontend/app/page.tsx` to `frontend/app/(public)/page.tsx`:

```bash
cd /home/data/Documents/webapps/track-master
git mv frontend/app/page.tsx frontend/app/\(public\)/page.tsx
```

Update the content of `frontend/app/(public)/page.tsx`:

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="landing-main">
      <div className="landing-content">
        <h1 className="landing-title">Track Master</h1>
        <p className="landing-subtitle">
          Hockey tryout tracking for&nbsp;parents
          and&nbsp;associations
        </p>
        <div className="landing-actions">
          <Button asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
```

Add styles to `frontend/app/globals.css`:

```css
.landing-main {
  @apply flex w-full max-w-lg flex-col gap-8 px-6 py-12 text-center;
}

.landing-content {
  @apply flex flex-col items-center gap-6;
}

.landing-title {
  @apply text-4xl font-bold tracking-tight text-foreground;
}

.landing-subtitle {
  @apply text-lg text-muted-foreground;
}

.landing-actions {
  @apply flex gap-3;
}
```

- [ ] **Step 6: Create login page**

`frontend/app/(public)/login/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    })
  }

  return (
    <div className="auth-form-container">
      <h1 className="auth-form-title">Log in to Track&nbsp;Master</h1>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleLogin}
      >
        Continue with Google
      </Button>

      <div className="auth-divider">
        <span className="auth-divider-text">or</span>
      </div>

      <form onSubmit={handleEmailLogin} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
            placeholder="you@example.com"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="auth-input"
            placeholder="Your password"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="auth-footer-link">
          Sign up
        </Link>
      </p>
    </div>
  )
}
```

Add styles to `frontend/app/globals.css`:

```css
.auth-form-container {
  @apply flex w-full max-w-sm flex-col gap-4 px-6;
}

.auth-form-title {
  @apply text-center text-2xl font-bold text-foreground;
}

.auth-divider {
  @apply relative flex items-center py-2;
}

.auth-divider::before,
.auth-divider::after {
  @apply flex-1 border-t border-border content-[''];
}

.auth-divider-text {
  @apply px-3 text-xs uppercase text-muted-foreground;
}

.auth-form {
  @apply flex flex-col gap-4;
}

.auth-field {
  @apply flex flex-col gap-1.5;
}

.auth-label {
  @apply text-sm font-medium text-foreground;
}

.auth-input {
  @apply rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring;
}

.auth-error {
  @apply text-sm text-destructive;
}

.auth-footer {
  @apply text-center text-sm text-muted-foreground;
}

.auth-footer-link {
  @apply font-medium text-primary underline underline-offset-4;
}
```

- [ ] **Step 7: Create signup page**

`frontend/app/(public)/signup/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleGoogleSignup() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    })
  }

  if (success) {
    return (
      <div className="auth-form-container">
        <h1 className="auth-form-title">Check your email</h1>
        <p className="auth-footer">
          We sent a confirmation link to <strong>{email}</strong>.
          Click the link to activate your&nbsp;account.
        </p>
      </div>
    )
  }

  return (
    <div className="auth-form-container">
      <h1 className="auth-form-title">Create your account</h1>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignup}
      >
        Continue with Google
      </Button>

      <div className="auth-divider">
        <span className="auth-divider-text">or</span>
      </div>

      <form onSubmit={handleSignup} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
            placeholder="you@example.com"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="auth-input"
            placeholder="At least 6 characters"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="auth-footer">
        Already have an account?{" "}
        <Link href="/login" className="auth-footer-link">
          Log in
        </Link>
      </p>
    </div>
  )
}
```

---

### Task 16: Update Root Layout

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Update metadata and keep existing font setup**

Replace `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Track Master",
  description: "Hockey tryout tracking for parents and associations",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
```

---

### Task 17: Final Verification and Commit

- [ ] **Step 1: Run TypeScript check**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npx tsc --noEmit
```

Expected: No errors (or only expected warnings from placeholder types).

- [ ] **Step 2: Run lint**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npm run lint
```

Expected: No errors.

- [ ] **Step 3: Run build**

```bash
cd /home/data/Documents/webapps/track-master/frontend && npm run build
```

Expected: Build succeeds. The proxy and auth routes compile without error.

- [ ] **Step 4: Fix any type/lint/build errors**

Address any issues found in steps 1-3 before committing.

- [ ] **Step 5: Commit auth implementation**

```bash
cd /home/data/Documents/webapps/track-master
git add frontend/
git commit -m "$(cat <<'EOF'
feat(auth): implement Supabase auth with proxy.ts and login/signup

Add @supabase/ssr client factories (browser, server, proxy helper).
Create root proxy.ts with getClaims() for session refresh.
Add auth callback route for OAuth/email code exchange.
Create login page with email/password and Google OAuth.
Create signup page with email confirmation flow.
Add logout server component.
Set up (public) route group for unauthenticated pages.
Update root layout metadata for Track Master.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
