# Spec 034: Estimated Players by Position

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** 031 (Admin Continuations Redesign)

## What This Feature Does

Breaks the single `estimated_players` integer on continuation rounds into per-position fields (F, D, G, Total). Admins enter these on Round 1 (when no jersey numbers exist yet) to indicate how many players are at each position. For Round 2+, position counts are auto-calculated from the actual roster data. The dashboard hero cards display position breakdowns inline.

## Current State

### Database
- `continuation_rounds.estimated_players` — single nullable integer column
- Added by migration `20260425100001_add_estimated_players_to_continuation_rounds.sql`

### Admin UI
- **Scrape confirmation** (`frontend/components/admin/admin-continuations-client.tsx`, line ~656): Single "Est. Players" number input in the scrape confirmation summary
- **Published round editor** (same file, line ~938): Single "Estimated Players" number input in expanded round card
- **Edit state** (line ~114): `roundEdits` record stores `estimated_players` as a string
- **Save logic** (line ~327): Parses to integer, saves via `updateRound()`

### Server Actions
- `frontend/app/admin/continuations/actions.ts` line 23: `updateRound()` accepts `estimated_players?: number | null`

### Dashboard
- `frontend/app/(app)/dashboard/actions.ts` line 127: `getDashboardData()` computes `totalPlayers` from `latest.jersey_numbers.length` — does NOT currently use `estimated_players`
- `frontend/components/dashboard/dashboard-client.tsx` line 97: `renderHeroCard()` shows:
  - Round 1: "Total Players" (neutral) + "Missing" (gold)
  - Round 2+: "Continuing" (green) + "Cuts" (red)

### Continuations Page (Parent)
- `frontend/components/continuations/continuations-page-client.tsx` line 239: Computes estimated cuts when previous round has no jersey list but has `estimated_players`
- `frontend/components/continuations/round-section.tsx` line 423: Displays "~X estimated cuts" message

### Types
- `frontend/types/database.ts` line 130: `estimated_players: number | null` in continuation_rounds Row type

## Changes Required

### Database

New migration: `20260426000001_add_estimated_players_by_position.sql`

Add three nullable integer columns to `continuation_rounds`:
- `estimated_players_f` (integer, nullable) — estimated forwards
- `estimated_players_d` (integer, nullable) — estimated defence
- `estimated_players_g` (integer, nullable) — estimated goalies

Keep the existing `estimated_players` column as-is — it serves as the "Total / All" field. No rename needed. No data migration needed (user confirmed no existing data).

After applying the migration, regenerate types:
```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### Server Actions / API Routes

**`frontend/app/admin/continuations/actions.ts`** — `updateRound()`

Add three new optional fields to the `updates` parameter:
- `estimated_players_f?: number | null`
- `estimated_players_d?: number | null`
- `estimated_players_g?: number | null`

These pass through to the Supabase update payload alongside the existing `estimated_players`.

**`frontend/app/(app)/dashboard/actions.ts`** — `getDashboardData()`

Extend the `HeroCard` type with position count fields:
```
positionCountF: number | null
positionCountD: number | null
positionCountG: number | null
positionCountUnknown: number   // players with position '?' or null
positionSource: 'estimated' | 'calculated' | null  // how counts were derived
```

When building hero card data:
- **Round 1 (no previous round)**: Read `estimated_players_f`, `estimated_players_d`, `estimated_players_g` from the latest round. If the round also has jersey_numbers, calculate position counts from player data instead (see "calculated" logic below). Set `positionSource = 'estimated'` or `'calculated'` accordingly.
- **Round 2+ (has jersey_numbers)**: Look up each jersey number in `tryout_players` for that association+division to get positions. Count F, D, G, and unknown (?/null). Set `positionSource = 'calculated'`. This does NOT require the estimated fields — it's computed from actual data.

To look up positions, `getDashboardData()` already queries the association. Add a query to fetch `tryout_players` for the division filtered by `deleted_at IS NULL`, selecting `jersey_number` and `position`. Build a Map of jersey_number to position for cross-referencing.

Also: when `totalPlayers` is 0 and estimated_players is set, use `estimated_players` as the `totalPlayers` value for the Round 1 hero card (so it doesn't show "0 Total Players" when only estimates exist).

### Pages

No new pages needed. Changes are to existing dashboard and admin continuations pages.

### Components

**`frontend/components/admin/admin-continuations-client.tsx`**

1. **Edit state** (line ~114): Add `estimated_players_f`, `estimated_players_d`, `estimated_players_g` as string fields in `roundEdits`

2. **`getEditState()`** (line ~289): Initialize the three new fields from round data, defaulting to empty string

3. **Auto-calculate Total**: When any of F/D/G changes, auto-sum them into the Total field UNLESS the admin has manually edited the Total field in the current edit session. Track whether Total has been manually touched with a flag. If F+D+G are all empty, leave Total as whatever it was.

4. **Scrape confirmation UI** (line ~656): Replace the single "Est. Players" input with a row of 4 inputs:
   - Label: "Est. Players"
   - Fields in a horizontal row: **All** / **F** / **D** / **G**
   - All fields are number inputs with `min={0}`, placeholder "0"
   - The "All" field has a slightly different style or border to indicate it's the total
   - State: Add `estimatedPlayersF`, `estimatedPlayersD`, `estimatedPlayersG` alongside existing `estimatedPlayers`

5. **Published round editor** (line ~938): Same layout — replace single input with 4 fields in a row

6. **Save logic** (line ~327): Parse all four fields to integers, save all four via `updateRound()`

7. **hasUnsavedChanges** (line ~300): Check the three new fields for changes

**`frontend/components/dashboard/dashboard-client.tsx`**

1. **Round 1 hero card** (line ~104): Below the "Total Players" stat value, add a position breakdown line when position data exists:
   - Format: `25F / 14D / 6G` (compact, inline below the number)
   - If `positionCountUnknown > 0`, append ` + 3?` or similar
   - Use a small, muted font class (e.g., `dashboard-hero-position-breakdown`)
   - Only show if at least one of F/D/G is non-null and > 0

2. **Round 2+ hero card** (line ~119): Below the existing "Continuing" + "Cuts" stats, add a position breakdown row:
   - Format: `F: 20 | D: 12 | G: 5` on a second line below the stats
   - If `positionCountUnknown > 0`, append ` | ?: 3`
   - Same muted font class
   - Only show if position data is available (`positionSource` is not null)

3. **Final team hero card**: Same treatment as Round 2+ — show position breakdown of the final roster

### Styles

**`frontend/app/globals.css`**

Add these classes:

- `.dashboard-hero-position-breakdown` — small muted text below hero stat values. Inherits card text color at reduced opacity. Uses `@apply` for `text-xs`, opacity, and top margin.

- `.admin-estimated-group` — horizontal flex container for the 4 estimated player inputs. Uses `@apply` for `flex`, `gap-2`, `items-end`.

- `.admin-estimated-field` — wrapper for each labeled input in the group. Uses `@apply` for `flex`, `flex-col`, `gap-1`.

- `.admin-estimated-field-label` — tiny label above each input (All/F/D/G). Uses `@apply` for `text-xs`, muted color.

- The existing `.admin-estimated-input` class can be reused for each individual input, but may need reduced width (e.g., `w-16`) to fit 4 across.

## Key Implementation Details

1. **Auto-calculate Total logic**: The admin enters F, D, G values. Total auto-fills with F+D+G. However, the admin CAN manually edit Total (for cases where some players have unknown positions — e.g., 25F + 14D + 6G = 45, but admin knows there are 50 total, so 5 are unknown position). Track a `totalManuallyEdited` flag per round edit. Reset the flag if the admin clears the Total field.

2. **Round 2+ position calculation**: This is the key architectural decision. For rounds that have `jersey_numbers`, position counts are NOT stored in the database — they're computed on the fly in `getDashboardData()` by cross-referencing jersey numbers with `tryout_players.position`. This avoids data duplication and ensures counts always reflect the latest player position data.

3. **Unknown position indicator**: When computing position counts from player data, if any players have `position = '?'` or `position IS NULL`, count them separately as `positionCountUnknown`. Display with a `?` suffix in the UI (e.g., `25F / 14D / 6G + 3?`). This addresses the user's request to "add a ? if there are unknowns."

4. **Continuations page estimated cuts**: The existing estimated cuts logic in `continuations-page-client.tsx` and `round-section.tsx` already works with the single `estimated_players` field. No changes needed there for now — the total field continues to drive the estimated cuts calculation. Per-position estimated cuts could be added later but are out of scope.

5. **Pattern to follow**: The existing `estimated_players` input in the admin round card (line ~938) and scrape confirmation (line ~656) both follow the same pattern. Replicate the state management (`useState` for scrape confirmation, `roundEdits` for published rounds) for the three new fields.

6. **Database query for position lookup**: In `getDashboardData()`, add one Supabase query for the division's `tryout_players` (filtered by `deleted_at IS NULL`, selecting `jersey_number, position`). This is efficient — one query per dashboard load, not per round. Build a `Map<string, string>` of jersey→position, then use it for all rounds.

7. **Empty state handling**: If no estimated position data exists (all three fields null) and no player position data can be computed, don't show the position breakdown line at all. The hero card gracefully falls back to its current display.

## Acceptance Criteria

- [ ] Three new columns exist: `estimated_players_f`, `estimated_players_d`, `estimated_players_g`
- [ ] Admin can enter F/D/G estimates in 4 inline fields (All/F/D/G) on both scrape confirmation and published round editor
- [ ] Total auto-calculates from F+D+G but can be manually overridden
- [ ] Dashboard Round 1 hero card shows position breakdown inline (e.g., "25F / 14D / 6G") when data exists
- [ ] Dashboard Round 2+ hero card shows position counts on a second line (e.g., "F: 20 | D: 12 | G: 5")
- [ ] Round 2+ position counts are auto-calculated from jersey_numbers + tryout_players positions
- [ ] Unknown positions (? or null) display with "?" indicator
- [ ] Position breakdown line hidden when no position data available
- [ ] Existing estimated cuts logic (continuations page) continues to work unchanged
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`.

**CRITICAL — Testing Association:**
All write tests MUST use the **Test / Sandbox association** (`a2000000-0000-0000-0000-000000000002`). NEVER run write operations against NGHA or any other live association. Switch to the TEST association in the app before running any write test.

**Live Data Safety:**
Tests run against the real database. Prefer read-only tests. All write tests use the TEST / Sandbox association. Log every mutation. Revert all mutations after testing.

**Setup:**
1. Log in as admin (`testadmin@test.com` / `TestAdmin1234`)
2. Navigate to admin continuations page
3. Ensure at least one published round exists in the TEST association for the active division

### Test 1: Admin — Estimated Players Fields Visible

1. Navigate to `/admin/continuations`
2. Switch to TEST association if not already selected
3. Expand a published round card
4. **Verify:** The single "Estimated Players" input has been replaced with 4 labeled inputs: All, F, D, G

### Test 2: Admin — Auto-Calculate Total

1. In the expanded round, enter F=25, D=14, G=6
2. **Verify:** The "All" field auto-fills to 45
3. Clear the "All" field, type 50 manually
4. **Verify:** The "All" field shows 50 (manual override accepted)
5. Change F to 30
6. **Verify:** The "All" field updates to 50 (stays manually set, does NOT auto-recalculate since admin touched it)

### Test 3: Admin — Save Estimated Players by Position

1. Enter F=25, D=14, G=6 (All auto-fills to 45)
2. Click Save
3. **Verify:** No error, round card collapses or shows saved state
4. Re-expand the round card
5. **Verify:** All four fields show the saved values: All=45, F=25, D=14, G=6

### Test 4: Admin — Scrape Confirmation Has Position Fields

1. Trigger a scrape (or navigate to a state where scrape confirmation is visible)
2. **Verify:** The "Est. Players" row in scrape confirmation shows 4 inline inputs (All/F/D/G) instead of one

### Test 5: Dashboard — Round 1 Position Breakdown (Estimated)

1. Ensure a Round 1 exists in TEST association with estimated_players_f=25, estimated_players_d=14, estimated_players_g=6, estimated_players=45
2. Navigate to `/dashboard`
3. **Verify:** The Round 1 hero card shows "45" as Total Players AND a position breakdown line like "25F / 14D / 6G" below it

### Test 6: Dashboard — Round 2+ Position Breakdown (Calculated)

1. Ensure Round 2+ exists in TEST association with jersey_numbers populated
2. Navigate to `/dashboard`
3. **Verify:** The Round 2+ hero card shows "Continuing" and "Cuts" stats as before, PLUS a position breakdown line below (e.g., "F: 20 | D: 12 | G: 5")

### Test 7: Dashboard — Unknown Positions Show "?"

1. Ensure at least one player in the round has position '?' or null
2. Navigate to `/dashboard`
3. **Verify:** The position breakdown includes a "?" count (e.g., "F: 20 | D: 12 | G: 5 | ?: 3")

### Test 8: Dashboard — No Position Data Graceful Fallback

1. Ensure a round exists with no estimated position fields set AND no jersey_numbers (or players with no position data)
2. Navigate to `/dashboard`
3. **Verify:** The hero card shows its normal stats without any position breakdown line — no empty or broken display

### Test 9: Admin — Clear All Position Fields

1. Expand a round with saved position data (F=25, D=14, G=6)
2. Clear all three position fields (F, D, G) to empty
3. Clear the All field to empty
4. Click Save
5. **Verify:** Fields save as null, no errors. Dashboard no longer shows position breakdown for this round.

### Test 10: Continuations Page — Estimated Cuts Still Work

1. Ensure a Round 1 exists with estimated_players=45 and no jersey_numbers
2. Ensure a Round 2 exists with jersey_numbers (e.g., 40 players)
3. Navigate to `/continuations`, select Round 2
4. **Verify:** The cuts display shows "~5 estimated cuts" — existing logic unchanged

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 3 | Set estimated F/D/G/All on a round | Clear all 4 fields and save |
| Test 9 | Cleared estimated F/D/G/All on a round | Already cleared (no revert needed) |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

1. `backend/supabase/migrations/20260426000001_add_estimated_players_by_position.sql` — **CREATE** — new migration
2. `frontend/types/database.ts` — **REGENERATE** — auto-generated types
3. `frontend/app/admin/continuations/actions.ts` — **MODIFY** — add 3 new fields to `updateRound()`
4. `frontend/app/(app)/dashboard/actions.ts` — **MODIFY** — extend HeroCard type, add position count logic, query tryout_players for position data
5. `frontend/components/admin/admin-continuations-client.tsx` — **MODIFY** — replace single input with 4-field layout in both scrape confirmation and round editor, add auto-calculate Total logic
6. `frontend/components/dashboard/dashboard-client.tsx` — **MODIFY** — add position breakdown display to hero cards
7. `frontend/app/globals.css` — **MODIFY** — add new CSS classes for position breakdown and estimated fields layout

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
