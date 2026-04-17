# Backend CLAUDE.md

Guidance for Claude Code when working in the `backend/` directory of Track Master. This directory contains Supabase configuration: database migrations, seed data, and Edge Functions.

## Supabase CLI Commands

Run all commands from `backend/`:

```bash
supabase init                    # One-time project initialization
supabase start                   # Start local Supabase (requires Docker)
supabase stop                    # Stop local Supabase
supabase db push                 # Apply migrations to local database
supabase db reset                # Reset local DB and re-apply all migrations + seed
supabase migration new <name>    # Create a new migration file
supabase functions serve         # Run Edge Functions locally
supabase functions deploy <name> # Deploy an Edge Function to production

# Generate TypeScript types from local schema, output to frontend
supabase gen types typescript --local > ../frontend/types/database.ts
```

## Directory Structure

```
backend/
|-- supabase/
|   |-- config.toml              # Supabase local dev configuration
|   |-- migrations/              # Sequential SQL migration files
|   |-- seed.sql                 # Development seed data
|   |-- functions/               # Supabase Edge Functions (Deno)
|       |-- purge-expired-data/
|       |   |-- index.ts         # Cron: delete data 90 days post-season
|       |-- purge-warning/
|           |-- index.ts         # Cron: warn admins 30 days before purge
|-- .env.local.example           # Template for Supabase env vars
```

## Migration File Conventions

Migrations use sequential five-digit numbering with descriptive names:

```
migrations/
|-- 00001_create_enums.sql
|-- 00002_create_associations.sql
|-- 00003_create_user_associations.sql
|-- 00004_create_teams.sql
|-- 00005_create_tryout_players.sql
|-- 00006_create_corrections.sql
|-- 00007_create_scraper_configs.sql
|-- 00008_create_audit_log.sql
|-- 00009_create_rls_policies.sql
|-- 00010_create_helper_functions.sql
|-- 00011_create_triggers.sql
|-- 00012_create_indexes.sql
```

**Rules:**
- Never modify an existing migration that has been applied. Create a new migration instead.
- Use the next sequential number: if the last file is `00012_`, the next is `00013_`.
- Each migration should be self-contained and idempotent where possible (use `IF NOT EXISTS`).
- Include `-- Description:` comment at the top of each migration file.
- All table creations must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

## PostgreSQL Enum Types

Three enums are used throughout the schema:

```sql
-- Player tryout status (7 values)
CREATE TYPE player_status AS ENUM (
  'registered',
  'trying_out',
  'cut',
  'made_team',
  'moved_up',
  'moved_down',
  'withdrew'
)

-- User role within an association (2 values)
CREATE TYPE app_role AS ENUM ('admin', 'parent')

-- Correction review status (3 values)
CREATE TYPE correction_status AS ENUM ('pending', 'approved', 'rejected')
```

When adding new enum values, use `ALTER TYPE ... ADD VALUE` in a new migration. Enum values cannot be removed or renamed in PostgreSQL without recreating the type.

## RLS Policy Patterns

### SECURITY DEFINER Helper Functions

All RLS policies use two helper functions to centralize access logic:

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

-- Check if the authenticated user is an admin for an association
CREATE FUNCTION user_is_admin(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
      AND role = 'admin'
  )
$$
```

### Policy Templates

**Read access for association members:**
```sql
CREATE POLICY "Members can view [table]"
  ON [table_name] FOR SELECT
  USING (user_belongs_to_association(association_id))
```

**Write access for admins only:**
```sql
CREATE POLICY "Admins can insert [table]"
  ON [table_name] FOR INSERT
  WITH CHECK (user_is_admin(association_id))

CREATE POLICY "Admins can update [table]"
  ON [table_name] FOR UPDATE
  USING (user_is_admin(association_id))
  WITH CHECK (user_is_admin(association_id))
```

**User's own rows (e.g., corrections submitted by parents):**
```sql
CREATE POLICY "Users can view own corrections"
  ON corrections FOR SELECT
  USING (user_id = auth.uid())
```

### RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `associations` | Member | Admin (create) | Admin | Never |
| `user_associations` | Own rows | Self (join) | Admin (role) | Admin (remove) |
| `tryout_players` | Member | Admin | Admin | Admin (soft) |
| `teams` | Member | Admin | Admin | Admin |
| `corrections` | Own (parent) / All (admin) | Member | Admin | Never |
| `scraper_configs` | Admin | Admin | Admin | Admin |
| `audit_log` | Admin | System (triggers) | Never | Never |

## Database Triggers

### Auto-Apply Corrections

When an admin sets a correction's status to `approved`, a trigger automatically updates the corresponding field on the `tryout_players` record:

```sql
CREATE OR REPLACE FUNCTION apply_correction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    EXECUTE format(
      'UPDATE tryout_players SET %I = $1, updated_at = NOW() WHERE id = $2',
      NEW.field_name
    ) USING NEW.new_value, NEW.player_id
  END IF
  RETURN NEW
END
$$

CREATE TRIGGER trigger_apply_correction
  AFTER UPDATE ON corrections
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION apply_correction()
```

### Audit Logging

Player mutations and correction reviews are recorded in `audit_log` via triggers. The trigger captures the acting user, action type, target record, and old/new values as JSONB.

## Edge Function Patterns

Edge Functions use Deno runtime. Located in `supabase/functions/`.

### purge-expired-data

Runs daily via Supabase cron at 3:00 AM UTC. Deletes player data, corrections, and audit logs for associations where `data_purge_date <= NOW()`.

```typescript
// supabase/functions/purge-expired-data/index.ts
import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js"

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Delete expired player data
  const { error } = await supabase
    .from("tryout_players")
    .delete()
    .lte("association_id", /* subquery for expired associations */)

  return new Response(JSON.stringify({ success: !error }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

### purge-warning

Runs daily at 3:30 AM UTC. Queries associations where `data_purge_date` is within 30 days and stores in-app notifications for admins.

### Cron Schedule (configured via migration or dashboard)

```sql
SELECT cron.schedule(
  'purge-expired-data',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/purge-expired-data',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
)

SELECT cron.schedule(
  'purge-warning',
  '30 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/purge-warning',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
)
```

## Type Generation Workflow

After any schema change (new migration, altered table, new enum value):

```bash
cd backend
supabase db reset                # Re-apply all migrations
supabase gen types typescript --local > ../frontend/types/database.ts
```

The generated `database.ts` file provides full type safety for all Supabase queries in the frontend. It includes table types, insert types, update types, and enum types.

## Environment Variables

`backend/.env.local` (for Supabase CLI):

```bash
SUPABASE_ACCESS_TOKEN=sbp_...     # Personal access token for CLI
SUPABASE_PROJECT_ID=<project-ref> # Remote project reference
SUPABASE_DB_PASSWORD=<password>   # Database password
```

Never commit `.env.local`. The `.env.local.example` template shows required variables without values.

## Coding Standards

- No semicolons in TypeScript files (Edge Functions).
- Use the `git switch -c` command for new branches, not `git checkout`.
- Write descriptive comments in SQL migrations explaining the purpose of each object.
