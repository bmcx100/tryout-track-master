# Project Domain Rules

**Description:** Enforces domain-specific business rules for Track Master, including player status values, correction workflows, multi-tenant data isolation, scraper configuration, association membership, and data lifecycle management.

**Trigger:** Use this skill when:
- Working with player status logic or UI
- Implementing the correction workflow
- Writing queries or mutations involving association-scoped data
- Configuring or modifying scraper functionality
- Implementing association join or membership features
- Working with data retention or season-end logic

---

## Enforcement Rules

### 1. Player Status Values

Player tryout status is a PostgreSQL enum with exactly seven values. These values must be used consistently across the database, TypeScript types, UI components, and any filtering or sorting logic.

**Enum values (in lifecycle order):**

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `registered` | Player signed up for tryouts but tryouts have not started | No |
| `trying_out` | Player is actively participating in tryouts | No |
| `cut` | Player was removed from tryouts | Yes |
| `made_team` | Player was assigned to a final team roster | Yes |
| `moved_up` | Player was moved to a higher division | No |
| `moved_down` | Player was moved to a lower division | No |
| `withdrew` | Player voluntarily left tryouts | Yes |

**TypeScript definition:**
```ts
type PlayerStatus =
  | "registered"
  | "trying_out"
  | "cut"
  | "made_team"
  | "moved_up"
  | "moved_down"
  | "withdrew"
```

**SQL enum:**
```sql
CREATE TYPE player_status AS ENUM (
  'registered',
  'trying_out',
  'cut',
  'made_team',
  'moved_up',
  'moved_down',
  'withdrew'
)
```

**Rules:**
- Every player has exactly one status at any given time
- Status transitions must record a `status_updated_at` timestamp
- The UI must visually distinguish active statuses (`registered`, `trying_out`, `moved_up`, `moved_down`) from terminal statuses (`cut`, `made_team`, `withdrew`)
- Never add, rename, or remove status values without a database migration and corresponding TypeScript type update

**Incorrect:**
```ts
// WRONG: using strings not in the enum
status = "active"        // Should be "trying_out"
status = "eliminated"    // Should be "cut"
status = "selected"      // Should be "made_team"
status = "dropped"       // Not a valid status
```

---

### 2. Correction Workflow

Corrections follow a three-state lifecycle. The workflow is strictly: `pending` -> `approved` OR `pending` -> `rejected`. No other transitions are valid.

**Correction status enum:**
```ts
type CorrectionStatus = "pending" | "approved" | "rejected"
```

**Workflow rules:**

1. **Submission (parent):**
   - Parent selects a player and indicates which field is wrong (`status`, `team`, `jersey_number`)
   - Parent provides the corrected value and an optional note
   - Correction is created with `status = 'pending'`
   - `user_id` is set to the submitting parent
   - `association_id` must match the player's `association_id`

2. **Duplicate prevention:**
   - If a `pending` correction already exists for the same `player_id` and `field_name`, reject the submission with an informative error
   - Multiple corrections for different fields on the same player are allowed

3. **Review (admin):**
   - Admin sees pending corrections in a review queue
   - Admin can approve or reject each correction
   - On approve: `status` changes to `approved`, `reviewed_by` is set to admin's `user_id`, `reviewed_at` is set to `now()`
   - On reject: `status` changes to `rejected`, same metadata fields are set

4. **Auto-apply (database trigger):**
   - When a correction's status changes to `approved`, a database trigger automatically updates the corresponding field on the `tryout_players` record
   - An `audit_log` entry is created recording the change

**Correct:**
```sql
-- Trigger: auto-apply approved corrections
CREATE OR REPLACE FUNCTION apply_approved_correction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Update the player record dynamically
    -- Create audit log entry
  END IF
  RETURN NEW
END
$$ LANGUAGE plpgsql SECURITY DEFINER
```

**Incorrect:**
```ts
// WRONG: manually updating player after approval instead of using trigger
async function approveCorrection(id: string) {
  await supabase.from("corrections").update({ status: "approved" })
  await supabase.from("tryout_players").update({ ... }) // Trigger handles this
}
```

---

### 3. Association-Scoped Data (Multi-Tenant)

All data queries and mutations must be scoped to the current user's association. Cross-association data access must be impossible at both the application and database levels.

**Rules:**
- Every query against tenant-scoped tables must filter by `association_id`
- RLS policies enforce this at the database level as a safety net
- The application layer should also pass `association_id` explicitly (defense in depth)
- Users may belong to multiple associations via `user_associations`
- The "current association" is determined by session state or URL parameter

**Correct:**
```ts
const { data: players } = await supabase
  .from("tryout_players")
  .select("*")
  .eq("association_id", currentAssociationId)
```

**Incorrect:**
```ts
// WRONG: no association filter -- relies entirely on RLS
const { data: players } = await supabase
  .from("tryout_players")
  .select("*")
```

**RLS policy pattern:**
```sql
CREATE POLICY "Users see only their association's players"
  ON tryout_players FOR SELECT
  USING (
    association_id IN (
      SELECT association_id FROM user_associations
      WHERE user_id = auth.uid()
    )
  )
```

---

### 4. Scraper Config Per Association

Each association can have one or more scraper configurations stored in the `scraper_configs` table. Scraper configs are association-scoped and admin-managed.

**Scraper config structure:**
```ts
interface ScraperConfig {
  id: string
  association_id: string
  label: string                    // Human-readable name (e.g., "Main tryout results")
  url: string                      // Target URL to scrape
  selectors: {                     // CSS selectors for data extraction
    name: string                   // Selector for player name
    number: string                 // Selector for jersey number
    status: string                 // Selector for tryout status
    team?: string                  // Selector for team (optional)
  }
  last_scraped_at: string | null   // ISO timestamp of last scrape
}
```

**Rules:**
- Selectors are stored as JSONB in PostgreSQL
- Each association manages its own selectors (hockey association websites vary in structure)
- Scraping is manual and on-demand only (no scheduled/automatic scraping in MVP)
- Scrape results are previewed before being committed to the database
- The preview shows three categories: new players, changed players, unchanged players
- Only new and changed players are written to the database on confirmation
- `last_scraped_at` is updated after a successful import confirmation

**Correct:**
```ts
// Scrape flow: preview first, then confirm
const preview = await fetch("/api/scrape", {
  method: "POST",
  body: JSON.stringify({ configId: scraperConfig.id }),
})
// Show preview to admin...
// On confirmation:
await fetch("/api/scrape/confirm", {
  method: "POST",
  body: JSON.stringify({ changes: preview.changes }),
})
```

**Incorrect:**
```ts
// WRONG: auto-importing without preview
const scrapeAndImport = async () => {
  const data = await scrapeSite(url)
  await supabase.from("tryout_players").upsert(data) // No preview step
}
```

---

### 5. Join Code for Association Membership

Users join associations by entering a join code. This is the primary membership mechanism.

**Rules:**
- Every association has a unique `join_code` generated at creation
- Join codes are short, human-readable strings (e.g., 6-8 alphanumeric characters)
- Admins can regenerate the join code (invalidating the old one)
- Admins can disable joining entirely by setting `join_enabled = false`
- When a user joins with a valid code, a `user_associations` record is created with `role = 'member'`
- A user cannot join an association they already belong to
- The join code is shared out-of-band (text message, email, rink bulletin board)

**Correct:**
```ts
// Server Action: join association
export async function joinAssociation(joinCode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Find association by join code
  const { data: association } = await supabase
    .from("associations")
    .select("id, join_enabled")
    .eq("join_code", joinCode)
    .single()

  if (!association || !association.join_enabled) {
    return { error: "Invalid or disabled join code" }
  }

  // Check for existing membership
  const { data: existing } = await supabase
    .from("user_associations")
    .select("id")
    .eq("user_id", user.id)
    .eq("association_id", association.id)
    .single()

  if (existing) {
    return { error: "You already belong to this association" }
  }

  // Create membership
  await supabase.from("user_associations").insert({
    user_id: user.id,
    association_id: association.id,
    role: "member",
  })
}
```

---

### 6. Season-End Data Purge (90 Days)

Player data is retained for exactly 90 days after the association admin marks the season as complete. This is a compliance requirement for data minimization.

**Lifecycle:**

1. Admin sets `season_end_date` on the association record
2. System computes `data_purge_date = season_end_date + 90 days`
3. At `data_purge_date - 30 days`, admins receive a warning notification
4. At `data_purge_date`, the following data is deleted:
   - `tryout_players` records for the association
   - `corrections` records (cascade from player FK)
   - `audit_log` entries for the association
5. The following data is **retained**:
   - `associations` record
   - `user_associations` memberships
   - `teams` definitions
   - `scraper_configs`

**Implementation:**
```sql
-- Supabase cron job (runs daily)
SELECT cron.schedule(
  'purge-expired-data',
  '0 3 * * *',  -- 3:00 AM daily
  $$
    DELETE FROM tryout_players
    WHERE association_id IN (
      SELECT id FROM associations
      WHERE data_purge_date <= NOW()
    )
  $$
)
```

**Rules:**
- Never delete data before the 90-day window
- Always warn admins 30 days before purge
- The privacy notice must inform users of the retention policy
- Purge operations use cascading deletes where FKs support it
- After purge, association and team structures remain intact for the next season
