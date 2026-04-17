# Project Compliance

**Description:** Enforces privacy and compliance rules for Track Master, with a focus on PIPEDA best practices for handling minors' data, data minimization, consent mechanisms, and data residency.

**Trigger:** Use this skill when:
- Collecting, displaying, or storing personal data
- Building forms that accept user or player information
- Designing database schemas for player-related data
- Implementing consent flows or privacy notices
- Configuring data retention or purge logic
- Deploying infrastructure or choosing hosting regions

---

## Enforcement Rules

### 1. PIPEDA Best Practices for Minors' Data

Track Master handles data about minor athletes (children playing hockey). Canadian privacy law (PIPEDA) requires heightened care when handling minors' personal information.

**Key principles to enforce:**

- **Accountability:** The application must have a clearly identified individual or process responsible for compliance. The privacy notice must name the data controller.
- **Identifying purposes:** The purpose of collecting each data field must be stated clearly. For Track Master, the purpose is: "to track and display tryout status for parents within a hockey association."
- **Consent:** Meaningful consent must be obtained before collecting or displaying minors' data. For Track Master, parental consent serves this purpose (parents are the users).
- **Limiting collection:** Collect only what is strictly necessary (see rule 2 below).
- **Limiting use, disclosure, and retention:** Data must not be used for purposes beyond what was consented to. Data must be purged after its purpose is fulfilled (see rule 5 below).
- **Accuracy:** Provide mechanisms for data correction (the correction workflow).
- **Safeguards:** Protect data with appropriate security measures (RLS, HTTPS, secure cookies).

**Rules:**
- Never store data about minors beyond what is listed in rule 2
- Never expose minor data to users outside the player's association
- Never use player data for analytics, marketing, or any purpose beyond tryout tracking
- Never share player data with third parties
- Always require consent before granting access to player data

---

### 2. Data Minimization

The system collects and stores only the minimum data necessary for its purpose. This list is exhaustive. Do not add additional fields without a documented privacy justification.

**Allowed player data fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `name` | text | Identify the player in the tryout list |
| `jersey_number` | integer | Secondary identifier, used in search |
| `division` | text | Age-group classification (e.g., U11, U13) |
| `team_id` | FK | Current or projected team assignment |
| `status` | enum | Current tryout status |
| `status_updated_at` | timestamp | When the status last changed |

**Explicitly prohibited data:**
- Date of birth or exact age
- Home address or mailing address
- Phone number (player or parent)
- Email address of the player
- Photos or images of players
- Medical information or injury history
- School name or grade
- Parent/guardian names linked to specific players
- Social media profiles
- Performance metrics, stats, or evaluations

**User account data (allowed):**
- Email address (for authentication only, via Supabase Auth)
- Display name (user-chosen, not necessarily real name)
- Authentication metadata (managed by Supabase)

**Correct:**
```sql
CREATE TABLE tryout_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id uuid REFERENCES associations(id) NOT NULL,
  name text NOT NULL,
  jersey_number integer,
  division text NOT NULL,
  team_id uuid REFERENCES teams(id),
  status player_status DEFAULT 'registered',
  status_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
)
```

**Incorrect:**
```sql
CREATE TABLE tryout_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id uuid REFERENCES associations(id) NOT NULL,
  name text NOT NULL,
  jersey_number integer,
  date_of_birth date,              -- PROHIBITED: unnecessary PII
  parent_email text,               -- PROHIBITED: links parent to child
  photo_url text,                  -- PROHIBITED: image of minor
  notes text,                      -- RISKY: could contain PII
  performance_rating integer,      -- PROHIBITED: evaluation data
  status player_status DEFAULT 'registered'
)
```

---

### 3. Parental Consent Mechanism

Before any user can view player data for an association, they must provide explicit consent acknowledging that:
1. The data displayed includes names and jersey numbers of minor athletes
2. They consent to viewing and interacting with this data
3. They understand the data retention policy

**Implementation requirements:**

- Consent must be recorded per user per association with a timestamp (`user_associations.consent_given_at`)
- The consent dialog must appear the first time a user accesses player data for an association
- Consent cannot be pre-checked or auto-accepted
- The consent text must be in plain language, not legal jargon
- Users who do not consent are redirected away from player data views

**Correct:**
```tsx
// components/auth/consent-dialog.tsx
"use client"

export function ConsentDialog({ associationName, onConsent }) {
  return (
    <Dialog>
      <DialogContent>
        <DialogTitle>Data Access Consent</DialogTitle>
        <p>
          You are about to view tryout data for {associationName}.
          This includes the names and jersey numbers of minor athletes
          (children). By proceeding, you consent to viewing this
          information for the sole purpose of tracking tryout results.
        </p>
        <p>
          Player data is retained for 90 days after the tryout season
          ends, then permanently deleted.
        </p>
        <Button onClick={onConsent}>
          I understand and consent
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

**Incorrect:**
```tsx
// WRONG: auto-consenting without user action
useEffect(() => {
  // Automatically recording consent on page load
  recordConsent(userId, associationId)
}, [])
```

---

### 4. Privacy Notice on Every Page

A privacy notice must be accessible from every page in the application. This is implemented as a footer link and a dedicated privacy page.

**Requirements:**
- The footer component must include a "Privacy" link on every page
- The privacy page (`/privacy` or `/settings` with a privacy section) must explain:
  - What data is collected (player names, jersey numbers, division, team, status)
  - Why it is collected (to track tryout status for parents)
  - Who can see it (authenticated members of the same association)
  - How long it is retained (90 days after season end)
  - How to request data deletion
  - Contact information for privacy inquiries
- The signup page must link to the privacy notice before the user completes registration

**Correct:**
```tsx
// components/layout/footer.tsx
export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/privacy">Privacy Policy</Link>
      <span>Track Master</span>
    </footer>
  )
}
```

**Incorrect:**
```tsx
// WRONG: footer without privacy link
export function Footer() {
  return (
    <footer className="site-footer">
      <span>Track Master &copy; 2026</span>
    </footer>
  )
}
```

---

### 5. 90-Day Post-Season Data Purge

Player data must be automatically purged 90 days after the end of the tryout season. This is a hard compliance requirement.

**Rules:**
- `associations.season_end_date` is set by the admin when the tryout season concludes
- `associations.data_purge_date` is computed as `season_end_date + 90 days`
- A Supabase cron job or Edge Function runs daily to check for associations past their purge date
- 30 days before purge, admins are notified (in-app notification or dashboard warning)
- On purge, the following are deleted:
  - All `tryout_players` records for the association
  - All `corrections` records for the association (cascade)
  - All `audit_log` entries for the association
- The following are retained:
  - `associations` record (persistent)
  - `user_associations` memberships (persistent)
  - `teams` definitions (persistent, reused across seasons)
  - `scraper_configs` (persistent)
- Purge operations must be logged (but the logs themselves are purged)
- The privacy notice must inform users of the 90-day retention window

**Correct:**
```sql
-- Edge Function: purge expired data
DELETE FROM tryout_players
WHERE association_id IN (
  SELECT id FROM associations
  WHERE data_purge_date IS NOT NULL
    AND data_purge_date <= NOW()
)

-- Also clean up audit log
DELETE FROM audit_log
WHERE association_id IN (
  SELECT id FROM associations
  WHERE data_purge_date IS NOT NULL
    AND data_purge_date <= NOW()
)

-- Reset the purge date after cleanup
UPDATE associations
SET season_end_date = NULL, data_purge_date = NULL
WHERE data_purge_date IS NOT NULL
  AND data_purge_date <= NOW()
```

---

### 6. No PII Beyond the Allowed List

No personal identifiable information beyond the fields listed in rule 2 may be collected, stored, processed, or displayed anywhere in the system.

**This applies to:**
- Database schema (no additional PII columns)
- API request/response bodies (no additional PII fields)
- Frontend forms (no additional PII input fields)
- Scraper extraction (extract only allowed fields from source pages)
- Audit logs (do not log PII beyond what is already in the player record)
- Error logs and monitoring (never log player names or PII in error messages)
- CSV import templates (reject CSVs with columns beyond the allowed set)

**Correct CSV columns:**
```
name,jersey_number,division,team,status
```

**Incorrect CSV columns:**
```
name,jersey_number,division,team,status,dob,parent_phone,address
```

---

### 7. Canadian Data Residency Preferred

When configuring hosting and database regions, prefer Canadian data centers to keep minors' data within Canada.

**Supabase:** Choose a Canadian region if available (e.g., `ca-central-1`). If not available, use the closest US region (e.g., `us-east-1`).

**Vercel:** Serverless functions default to the closest edge. Configure the primary region to be in eastern North America (closest to Ontario, the launch market).

**Rules:**
- Document the chosen data residency region
- If data must leave Canada, note this in the privacy notice
- Never use regions geographically distant from Canada (e.g., `ap-southeast-1`, `eu-west-1`) without explicit justification

---

## Compliance Checklist

When reviewing changes, verify:

- [ ] No new PII fields added to player data beyond the allowed list
- [ ] Parental consent check exists before player data access
- [ ] Privacy notice link is present in the footer of every layout
- [ ] Data purge logic accounts for the 90-day retention window
- [ ] No player data is logged in error messages or monitoring
- [ ] CSV import rejects columns with prohibited PII
- [ ] Scraper extracts only allowed fields
- [ ] Consent is recorded with a timestamp, not auto-accepted
- [ ] Database region is Canadian or closest to Canada
