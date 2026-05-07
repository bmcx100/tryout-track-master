# Spec 038: Player Birth Year

**PRD Reference:** FR-021
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

Adds a `birth_year` column to players so parents and admins can see which birth year cohort a player belongs to (e.g., 2012, 2013). Admins can manually set or correct a player's birth year via the detail form. A one-time SQL script backfills birth years for existing players by inferring them from each player's current division and previous team — the logic exploits the minor/major age cohort system used in Ontario hockey.

## Current State

- **`tryout_players` table** has no `birth_year` column. Player age is only implied by division (e.g., U15).
- **Player detail sheet** (`frontend/components/teams/long-press-menu.tsx`) shows jersey, name, position, previous team, status, and notes. Read-only mode is at lines 520–558. Edit mode is at lines 390–518.
- **Admin update action** (`frontend/app/(app)/players/actions.ts`, `adminUpdatePlayer` at line 6) accepts `name`, `jersey_number`, `position`, `previous_team`, and `status`.
- **Admin create action** (`frontend/app/(app)/players/actions.ts`, `adminCreatePlayer` at line 103) accepts the same fields plus `association_id` and `division`.
- **Add player form** (admin settings): `frontend/components/settings/add-player-form.tsx`
- **Add player sheet** (parent): `frontend/components/teams/add-player-sheet.tsx`
- **Types:** `frontend/types/database.ts` — `tryout_players` Row type at line 478.
- **Previous team normalization:** Spaces removed (e.g., "U15 AA" → "U15AA") via `frontend/lib/normalize-previous-team.ts`.

## Birth Year Inference Logic

Ontario minor hockey uses two-year age groups (U13, U15) and a three-year group (U18). Within a two-year group, the older cohort is "major" and the younger is "minor." Players who stay in the same division are aging from minor to major. Players who move up from a lower division are entering as the new minor cohort.

**For the 2026-2027 season:**

| Current Division | Previous Team Division | Inferred Birth Year | Reasoning |
|---|---|---|---|
| U15 | U15 (any level) | 2012 | Was minor U15, now major U15 |
| U15 | U13 (any level) | 2013 | Was major U13, moved up to minor U15 |
| U13 | U13 (any level) | 2014 | Was minor U13, now major U13 |
| U13 | U11 (any level) | 2015 | Was major U11, moved up to minor U13 |
| U18 | U15 (any level) | 2011 | Was major U15, moved up to U18 |
| U18 | U18 or none | Cannot infer | Three-year group, first year of data |
| Any | No previous team | Cannot infer | No movement data available |

**Important:** This logic applies to ALL players with a `previous_team` value, regardless of their current status (trying_out, made_team, cut, etc.). The division + previous team combination is sufficient to determine birth year.

## Changes Required

### Database

Create migration `20260507000001_add_birth_year_to_tryout_players.sql`:

- Add `birth_year integer` column to `tryout_players` (nullable, no default).
- No constraint needed — values are 4-digit years but we don't need to enforce a range at the DB level.

After applying the migration, regenerate types:
```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### One-Time SQL Backfill (User Runs Manually)

The implementing agent must produce **two SQL scripts** and present them to the user:

**Script 1 — Preview (SELECT):** Shows what would be updated without changing anything. The user reviews this to verify correctness.

```sql
SELECT
  id,
  name,
  jersey_number,
  division,
  previous_team,
  CASE
    WHEN division = 'U15' AND previous_team LIKE 'U15%' THEN 2012
    WHEN division = 'U15' AND previous_team LIKE 'U13%' THEN 2013
    WHEN division = 'U13' AND previous_team LIKE 'U13%' THEN 2014
    WHEN division = 'U13' AND previous_team LIKE 'U11%' THEN 2015
    WHEN division = 'U18' AND previous_team LIKE 'U15%' THEN 2011
    ELSE NULL
  END AS inferred_birth_year
FROM tryout_players
WHERE deleted_at IS NULL
  AND previous_team IS NOT NULL
  AND CASE
    WHEN division = 'U15' AND previous_team LIKE 'U15%' THEN TRUE
    WHEN division = 'U15' AND previous_team LIKE 'U13%' THEN TRUE
    WHEN division = 'U13' AND previous_team LIKE 'U13%' THEN TRUE
    WHEN division = 'U13' AND previous_team LIKE 'U11%' THEN TRUE
    WHEN division = 'U18' AND previous_team LIKE 'U15%' THEN TRUE
    ELSE FALSE
  END
ORDER BY division, inferred_birth_year, name;
```

**Script 2 — Update:** Applies the birth years.

```sql
UPDATE tryout_players
SET birth_year = CASE
  WHEN division = 'U15' AND previous_team LIKE 'U15%' THEN 2012
  WHEN division = 'U15' AND previous_team LIKE 'U13%' THEN 2013
  WHEN division = 'U13' AND previous_team LIKE 'U13%' THEN 2014
  WHEN division = 'U13' AND previous_team LIKE 'U11%' THEN 2015
  WHEN division = 'U18' AND previous_team LIKE 'U15%' THEN 2011
  ELSE birth_year
END
WHERE deleted_at IS NULL
  AND previous_team IS NOT NULL
  AND birth_year IS NULL
  AND (
    (division = 'U15' AND (previous_team LIKE 'U15%' OR previous_team LIKE 'U13%'))
    OR (division = 'U13' AND (previous_team LIKE 'U13%' OR previous_team LIKE 'U11%'))
    OR (division = 'U18' AND previous_team LIKE 'U15%')
  );
```

**Deliver these scripts to the user as plain SQL** — either printed in the terminal or saved to a file in `docs/specs/` — so they can run them via the Supabase SQL editor. Do NOT run the update script automatically.

### Server Actions / API Routes

**Modify `adminUpdatePlayer`** in `frontend/app/(app)/players/actions.ts`:
- Add `birth_year?: number | null` to the `updates` parameter type.
- Pass it through to the Supabase `.update()` call. No special validation needed beyond what TypeScript provides (integer type).

**Modify `adminCreatePlayer`** in `frontend/app/(app)/players/actions.ts`:
- Add `birth_year?: number` to the `data` parameter type.
- Include it in the `.insert()` call.

### Pages

No new pages. The player detail sheet is a component, not a page.

### Components

**`frontend/components/teams/long-press-menu.tsx`:**

*Read-only mode changes (everyone sees this):*
- Add a "Birth Year" display to the info row section (lines 534–544).
- Show the birth year value (e.g., "2012") or "—" if null.
- Place it as a third column alongside Previous Team and Status in the `detail-sheet-info-row`, or as its own row below. The key constraint is it must not feel cramped on mobile — use your judgment on layout.

*Edit mode changes (admin only):*
- Add a "Birth Year" input field — a narrow number input, 4-digit, placeholder "e.g. 2012".
- Place it on the row with Number and Position (lines 413–442). It fits naturally as a third narrow field since it's also a short numeric value.
- Allow clearing the field (setting to null) by leaving it empty.

*State management:*
- Add `birthYearValue` state, initialized from `player.birth_year`.
- Include `birth_year` in the `onAdminUpdate` call when the value changes.
- For parent mode (non-admin): birth year is display-only, never editable. Parents cannot submit corrections for birth year.

**`frontend/components/teams/long-press-menu.tsx` — Props:**
- The `TryoutPlayer` type will already include `birth_year` after type regeneration. No prop changes needed since the component receives `player: TryoutPlayer`.
- Add `birth_year?: number | null` to the `onAdminUpdate` callback type.

**`frontend/components/settings/add-player-form.tsx`:**
- Add an optional "Birth Year" number input field after the existing fields.
- Pass it through to `adminCreatePlayer`.

**`frontend/components/teams/add-player-sheet.tsx`:**
- Do NOT add birth year to the parent add-player form. Parents shouldn't need to provide this — it's admin-managed data.

### Styles

Add these classes to `frontend/app/globals.css` following the existing detail sheet naming pattern:

- `detail-sheet-birth-year` — styling for the birth year display in read-only mode (consistent with `detail-sheet-info-value` sizing).
- `detail-sheet-input-birth-year` — narrow number input for edit mode (same width as the jersey number input, `detail-sheet-input-narrow`).

Use the existing `detail-sheet-input-narrow` class if it already provides the right width. Only create a new class if the birth year input needs different sizing.

## Key Implementation Details

- **Previous team matching uses `LIKE 'U15%'`** which correctly matches normalized values like "U15AA", "U15A", "U15BB", etc. The normalization step (removing spaces between division prefix and level) ensures this pattern works reliably.
- **Birth year is nullable.** Many players won't have a previous team, so their birth year will remain null. The UI must handle this gracefully (show "—" or similar, not "null" or blank).
- **The SQL scripts are for the 2026-2027 season specifically.** The CASE mappings are hardcoded for this season. If the app is used for future seasons, the year values in the SQL would need updating. This is acceptable — it's a one-time manual operation.
- **Admin override takes precedence.** If an admin manually sets a birth year, the SQL backfill script includes `AND birth_year IS NULL` to avoid overwriting manual entries.
- **No birth year filter or column on player rows.** This spec deliberately keeps the scope small — display in detail form only.
- **RLS:** The existing RLS policies on `tryout_players` already cover read/write access. Adding a column doesn't require new policies.

## Acceptance Criteria

- [ ] `birth_year` column exists on `tryout_players` (nullable integer)
- [ ] Types regenerated — `TryoutPlayer` includes `birth_year: number | null`
- [ ] Player detail sheet shows birth year in read-only mode for all users
- [ ] Null birth year displays as "—" (not blank or "null")
- [ ] Admin edit mode includes a birth year input field
- [ ] Admins can set, change, and clear (set to null) birth year
- [ ] Parents cannot edit birth year
- [ ] `adminUpdatePlayer` accepts and persists `birth_year`
- [ ] `adminCreatePlayer` accepts and persists `birth_year`
- [ ] Admin add-player form (settings) includes optional birth year field
- [ ] Parent add-player sheet does NOT include birth year
- [ ] Preview SQL script is provided to user for verification
- [ ] Update SQL script is provided to user for manual execution
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to
`docs/specs/temp-testing-screenshots/`. Never save screenshots to the
repo root or any other location.

**CRITICAL — Testing Association:**
All write tests MUST use the **Test / Sandbox association**
(`a2000000-0000-0000-0000-000000000002`). NEVER run write
operations against NGHA or any other live association during testing.

**Live Data Safety:**
Tests run against the real database. Prefer read-only tests. All write
tests use the TEST / Sandbox association. Revert all mutations after testing.

**Setup:**
1. Log in as the test admin user.
2. Ensure the dev server is running on `http://localhost:3000`.
3. Switch to the Test / Sandbox association if not already selected.

### Test 1: Birth year displays in read-only detail sheet
1. Navigate to `/teams` (or the main players view).
2. Tap on a player who has a birth year set (after running the backfill SQL on sandbox data, or manually setting one via SQL).
3. **Verify:** The detail sheet shows the birth year value (e.g., "2012") alongside Previous Team and Status.

### Test 2: Null birth year shows dash
1. Navigate to `/teams`.
2. Tap on a player who does NOT have a birth year (e.g., a U18 player without U15 history, or any player without a previous team).
3. **Verify:** The birth year field shows "—" (em dash), not blank or "null".

### Test 3: Admin can edit birth year
1. Navigate to `/teams` as admin in the Test / Sandbox association.
2. Tap a player to open the detail sheet.
3. Tap "Edit" to enter edit mode.
4. **Verify:** A birth year input field is visible.
5. Enter "2012" in the birth year field.
6. Tap "Save".
7. **Verify:** The detail sheet closes. Re-open the same player.
8. **Verify:** Birth year shows "2012" in read-only mode.

### Test 4: Admin can clear birth year
1. Open the same player from Test 3 in edit mode.
2. Clear the birth year field (delete the value).
3. Tap "Save".
4. Re-open the player.
5. **Verify:** Birth year shows "—".

### Test 5: Parent cannot edit birth year
1. Log in as a parent/member user (non-admin).
2. Navigate to `/teams` and tap a player with a birth year set.
3. **Verify:** Birth year is displayed in read-only mode.
4. Tap "Edit" to enter edit mode.
5. **Verify:** Birth year field is NOT editable (either not shown as an input, or shown as read-only text). The parent can edit name, jersey, position, and previous team but NOT birth year.

### Test 6: Admin add-player form includes birth year
1. Navigate to the admin settings/player management page in the Test / Sandbox association.
2. Open the add-player form.
3. **Verify:** There is an optional "Birth Year" field.
4. Fill in the form with a test player (name: "Test BirthYear", jersey: "99", position: F, birth year: 2013).
5. Submit the form.
6. **Verify:** The player appears in the list.
7. Open the player detail.
8. **Verify:** Birth year shows "2013".

### Test 7: Parent add-player sheet does NOT include birth year
1. Log in as a parent/member.
2. Open the add-player sheet (suggest a player).
3. **Verify:** There is no birth year field. Only name, jersey, position, and previous team are shown.

### Test 8: SQL preview script correctness (manual verification)
1. The implementing agent prints the preview SQL and update SQL to the terminal.
2. **Verify:** The preview SQL uses the correct division/previous_team → birth_year mapping as defined in the inference logic table above.
3. **Verify:** The update SQL includes `AND birth_year IS NULL` to avoid overwriting existing values.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 3 | Set birth_year=2012 on a sandbox player | Clear via Test 4 (sets to null) |
| Test 4 | Cleared birth_year on same player | Already reverted (null) |
| Test 6 | Created test player "Test BirthYear" #99 | Delete via admin player management |

**After all tests pass, delete the "Test BirthYear" player created in Test 6 and confirm with the user that all test data has been cleaned up.**

## Files to Touch

1. `backend/supabase/migrations/20260507000001_add_birth_year_to_tryout_players.sql` — new migration
2. `frontend/types/database.ts` — regenerated types (run `supabase gen types`)
3. `frontend/app/(app)/players/actions.ts` — add `birth_year` to update and create actions
4. `frontend/components/teams/long-press-menu.tsx` — display + edit birth year
5. `frontend/components/settings/add-player-form.tsx` — add optional birth year input
6. `frontend/app/globals.css` — new/updated styles for birth year display (if needed)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps
in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start
   the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow
   each test's steps exactly, and verify each expected result using
   browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan
   must pass before this spec is considered complete.
6. **Present the SQL scripts.** Print both the preview and update SQL
   scripts to the terminal so the user can copy them. Do NOT execute
   the update script — the user will run it manually.
7. **Revert all test mutations.** Check the Test Mutations Log and
   undo every data change made during testing. Confirm with the
   user that all test data has been cleaned up.
