# Spec 033: Complete Level + Dashboard/Favourites Multi-Level Fix

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** 031 (Admin Continuations Redesign — already implemented)

## What This Feature Does

Adds a "Current Rounds / Completed Teams" toggle to the admin continuations page. When a level has a Final Team round published, the admin can mark that level as "complete" from inside the Final Team round card. Completing a level moves it from the Current Rounds view into a read-only Completed Teams view, removes its hero card from the dashboard, and shifts favourite status derivation to the next active level. "Made Team" favourites from completed levels persist across all subsequent levels. The action is reversible — admins can uncomplete a level to move it back.

## Current State

### Admin continuations page
- **Route:** `frontend/app/admin/continuations/page.tsx` — server component fetching drafts, URL, all rounds
- **Client:** `frontend/components/admin/admin-continuations-client.tsx` (998 LOC) — scrape workflow, published round cards grouped by team level, edit/delete/create
- **Actions:** `frontend/app/admin/continuations/actions.ts` — `getAllRounds`, `updateRound`, `deleteRound`, `createEmptyRound`, `getRevertablePlayerCount`

### Dashboard data + favourite derivation
- **File:** `frontend/app/(app)/dashboard/actions.ts`
- **`getDashboardData()`** (lines 46–300): fetches all published rounds, builds hero cards for every level that has at least one round, calls `deriveFavouriteStatuses()`
- **`deriveFavouriteStatuses()`** (lines 315–501): picks ONE "primary level" (most recent `created_at`), derives continuing/cut/missing/registered from that level only. B/C combo exception exists. No concept of "completed" levels — if AA is done and A starts, AA favourites vanish.
- **`getMyFavouritesPageData()`** (line 517+): also calls `deriveFavouriteStatuses()` — same bug affects the My Favourites page

### Database
- **`continuation_rounds`** table has: `id`, `association_id`, `division`, `team_level`, `round_number`, `is_final_team`, `jersey_numbers`, `ip_players`, `sessions`, `created_at`, `session_info`, `status`, `source_url`, `scraped_at`, `estimated_players`
- **No `continuation_level_status` table exists** — needs to be created

### Types
- **`frontend/types/index.ts`** — `ContinuationRound` type definition

## Changes Required

### Database

**New migration: `create_continuation_level_status.sql`**

```sql
CREATE TABLE continuation_level_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  division text NOT NULL,
  team_level text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  UNIQUE (association_id, division, team_level)
);

ALTER TABLE continuation_level_status ENABLE ROW LEVEL SECURITY;

-- Members can read (needed to know which levels are active for parent-facing pages)
CREATE POLICY "Members can read level status"
  ON continuation_level_status FOR SELECT
  USING (user_belongs_to_association(association_id));

-- Admins can insert/update/delete
CREATE POLICY "Admins can manage level status"
  ON continuation_level_status FOR ALL
  USING (user_is_admin(association_id))
  WITH CHECK (user_is_admin(association_id));
```

No new columns on existing tables. The finalized date for Completed Teams summary cards comes from the Final Team round's `created_at` — no new column needed.

### Server Actions / API Routes

**Modify: `frontend/app/admin/continuations/actions.ts`**

Add three new actions:

1. **`getCompletedLevels(associationId: string, division: string): Promise<{ team_level: string, completed_at: string | null, completed_by: string | null }[]>`**
   - Returns all rows from `continuation_level_status` where `is_completed = true` for the given association + division

2. **`completeLevel(associationId: string, division: string, teamLevel: string): Promise<{ error?: string }>`**
   - Upserts into `continuation_level_status`: sets `is_completed = true`, `completed_at = now()`, `completed_by = auth.uid()`
   - Inserts an audit log entry: action = `"complete_level"`, details include division and team_level
   - Returns error if no Final Team round exists for this level (safety check — the UI should already prevent this, but double-check server-side)

3. **`uncompleteLevel(associationId: string, division: string, teamLevel: string): Promise<{ error?: string }>`**
   - Updates `continuation_level_status`: sets `is_completed = false`, `completed_at = null`, `completed_by = null`
   - Inserts an audit log entry: action = `"uncomplete_level"`

### Pages

**Modify: `frontend/app/admin/continuations/page.tsx`**

- Import and call `getCompletedLevels(associationId, activeDivision)` in the `Promise.all`
- Pass `completedLevels` as a prop to `AdminContinuationsClient`

### Components

**Modify: `frontend/components/admin/admin-continuations-client.tsx`**

Major changes — restructure the page with a toggle and two views:

#### New prop
- `completedLevels: { team_level: string, completed_at: string | null }[]`

#### Top toggle (below page title, above scrape section)
- Two-option toggle: **Current Rounds** | **Completed Teams**
- Same visual style as the sessions toggle on the parent-facing continuations page (pill toggle)
- Default to "Current Rounds" on page load
- Show count badges: Current Rounds shows the number of active team levels, Completed Teams shows the number of completed team levels

#### Current Rounds view (active when toggle = "Current Rounds")
- Same as the existing page, but **filter out completed levels** from the published rounds list
- The scrape section, create empty round, and drafts remain here — unchanged

**Complete switch inside Final Team round card:**
- When a round card is expanded and `is_final_team === true`, show a "Mark Level Complete" button below the existing Save/Delete buttons
- Style: distinct from Save/Delete — use a muted secondary style (not danger, not primary). Perhaps a bordered button with a CheckCircle icon.
- Clicking opens a confirmation dialog:
  - Text: "Complete {division} {teamLevel}? The hero card will be removed from the dashboard and this level will move to Completed Teams."
  - Two buttons: "Complete" (confirm) and "Cancel"
- On confirm: call `completeLevel()`, refresh the page, toggle switches to show the level is now in Completed Teams
- **Disabled state:** If the round card is expanded but `is_final_team` is false, the Complete button is not shown. The button only appears on Final Team round cards.

#### Completed Teams view (active when toggle = "Completed Teams")
- List of completed levels as cards, ordered by `LEVEL_ORDER` index (AA, A, BB, B, C)
- Each card is collapsible (collapsed by default)

**Collapsed card shows:**
- Level name: e.g., "U15 AA"
- Round count: e.g., "4 rounds"
- Made Team count: jersey count from the Final Team round (e.g., "17 players")
- Finalized date: from the Final Team round's `created_at`, formatted as a short date (e.g., "Apr 20, 2026")

**Expanded card shows:**
- Read-only list of all rounds for that level, ordered by round number descending
- Each round row: round number (or "Final Team"), player count, session info
- No edit controls — read-only
- "Uncomplete" button at the bottom
  - Style: bordered/secondary, with an Undo icon
  - Clicking opens a confirmation dialog:
    - Text: "Reopen {division} {teamLevel}? The hero card will reappear on the dashboard and the level will move back to Current Rounds."
    - Two buttons: "Reopen" (confirm) and "Cancel"
  - On confirm: call `uncompleteLevel()`, refresh the page

**Empty state for Completed Teams:**
- "No completed teams yet. Mark a level as complete from its Final Team round card in Current Rounds."

### Dashboard Changes

**Modify: `frontend/app/(app)/dashboard/actions.ts`**

#### `getDashboardData()` changes:

1. Fetch completed levels: query `continuation_level_status` where `is_completed = true` for the association + division. Build a `Set<string>` of completed team levels.
2. **Hero card filtering:** When iterating `LEVEL_ORDER` to build hero cards, skip any level that is in the completed set.
3. **Favourite derivation:** Pass the completed levels set to `deriveFavouriteStatuses()`.

#### `deriveFavouriteStatuses()` changes:

New parameter: `completedLevels: Set<string>`

New logic:

1. **DB `made_team` override** — unchanged (step 1 in current code)
2. **Group rounds by level** — unchanged (step 2)
3. **Find active level(s)** — changed:
   - When determining the primary level, **exclude completed levels** from candidacy
   - The primary level is the non-completed level with the most recent `created_at`
   - B/C combo exception stays — but only if both B and C are non-completed
4. **Derive statuses from active level(s)** — unchanged logic for continuing/cut/missing/registered
5. **NEW STEP — Made Team persistence from completed levels:**
   - After deriving from the active level, iterate all completed levels
   - For each completed level: find its rounds, check if the latest round has `is_final_team === true`
   - If yes: any favourite whose jersey is on that final team round AND hasn't been handled yet → emit as `"made_team"` with `statusText: "Made Team ({teamLevel})"` (e.g., "Made Team (AA)")
   - This ensures AA Made Team favourites persist even when A is the active level

#### `getMyFavouritesPageData()` changes:

Same pattern — fetch completed levels, pass to `deriveFavouriteStatuses()`.

### Styles

Add to `frontend/app/globals.css`:

- `.admin-view-toggle` — container for the Current Rounds / Completed Teams toggle, styled like the sessions toggle
- `.admin-view-toggle-btn` — individual toggle button, with active/inactive states
- `.admin-complete-btn` — the "Mark Level Complete" button inside Final Team cards
- `.admin-complete-btn:disabled` — disabled state
- `.admin-completed-card` — card for completed teams in the Completed Teams view
- `.admin-completed-card-header` — clickable header with level name, stats, chevron
- `.admin-completed-card-body` — expanded read-only round list
- `.admin-completed-round-row` — individual round row in the expanded card
- `.admin-uncomplete-btn` — the "Uncomplete" button
- `.admin-completed-empty` — empty state text

### Types

**Modify: `frontend/types/index.ts`**

Add:
```typescript
export type ContinuationLevelStatus = {
  id: string
  association_id: string
  division: string
  team_level: string
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
}
```

## Key Implementation Details

1. **Completed levels filter in Current Rounds:** The existing `roundsByTeam` grouping logic already groups rounds by team level. To filter out completed levels, simply skip any `level` key that appears in the completed levels set when rendering the Current Rounds view. Don't filter them from state — they're needed for the Completed Teams view.

2. **Completed Teams card data:** To build the summary for each completed level, look up the rounds for that level from `publishedRounds`. The Final Team round is the one where `is_final_team === true`. Its `jersey_numbers.length` is the Made Team count. Its `created_at` is the finalized date. The total round count is `roundsByTeam[level].length`.

3. **Audit logging:** Use the existing `audit_log` table. Insert directly in the `completeLevel` and `uncompleteLevel` server actions using the Supabase client. The action types should be descriptive: `"complete_level"` and `"uncomplete_level"`. Include `division`, `team_level`, and `association_id` in the details JSON.

4. **RLS safety:** The `completeLevel` action runs as the authenticated user. The `user_is_admin(association_id)` check in RLS ensures only group admins can insert/update. The server action should also call `requireAdmin()` or verify the user's role before proceeding — belt and suspenders.

5. **Server-side Final Team guard:** The `completeLevel` action must verify that a Final Team round exists for the requested level before allowing completion. Query `continuation_rounds` for `is_final_team = true` at that level. If none exists, return `{ error: "No Final Team round exists for this level" }`.

6. **Parent-facing `/continuations` page:** No changes needed. Completed level rounds remain visible in the round selector dropdown. The completion status only affects the dashboard and favourites — not the parent's ability to browse historical rounds.

7. **Made Team label with level:** When deriving Made Team status from a completed level, the `statusText` should include the level (e.g., "Made Team (AA)") so parents can distinguish which team the player made. Made Team from the active level's final round stays as just "Made Team" (or "Made {TeamName}" if a team match exists in the DB).

8. **Toggle state:** The Current Rounds / Completed Teams toggle is client-side state only — no persistence needed. Default to "Current Rounds" on each page visit.

9. **Page refresh after complete/uncomplete:** After calling `completeLevel()` or `uncompleteLevel()`, call `router.refresh()` to re-fetch server data. The toggle should stay on the relevant view (after completing, show Completed Teams; after uncompleting, show Current Rounds).

## Acceptance Criteria

- [ ] `continuation_level_status` table exists with correct schema and RLS policies
- [ ] Admin continuations page has a "Current Rounds / Completed Teams" toggle below the title
- [ ] Current Rounds view filters out completed levels
- [ ] Final Team round cards show a "Mark Level Complete" button when expanded
- [ ] Complete button is not shown on non-Final-Team round cards
- [ ] Completing a level shows a confirmation dialog, then moves the level to Completed Teams
- [ ] Completed Teams view shows summary cards with level name, round count, Made Team count, and finalized date
- [ ] Expanding a completed team card shows a read-only list of rounds
- [ ] Uncomplete button opens a confirmation dialog, then moves the level back to Current Rounds
- [ ] Dashboard hero cards do not show for completed levels
- [ ] Favourite derivation skips completed levels when picking the active level
- [ ] Made Team favourites from completed+finalized levels persist across subsequent active levels
- [ ] My Favourites page also reflects the completed level logic
- [ ] Audit log records complete/uncomplete actions
- [ ] Parent-facing `/continuations` page still shows completed level rounds
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow safety rules strictly. Use the TEST/SANDBOX association (`a2000000-0000-0000-0000-000000000002`) for any write operations that modify level status.

**Setup:** Log in as `testadmin@test.com` / `TestAdmin1234`. Navigate to the app. Use the NGHA association for read-only verification of the UI. For write tests (complete/uncomplete), switch to the TEST sandbox association if it has continuation rounds with a Final Team, or use NGHA if no sandbox data exists — but revert immediately after.

### Test 1: Toggle appears on admin continuations page
1. Navigate to `/admin/continuations`
2. Take a snapshot
3. **Verify:** Below the "Continuations" title, a toggle with "Current Rounds" and "Completed Teams" is visible. "Current Rounds" is active by default.

### Test 2: Toggle switches between views
1. On `/admin/continuations`, click "Completed Teams"
2. Take a snapshot
3. **Verify:** The scrape section and published round cards are hidden. Either completed team cards or an empty state message is shown.
4. Click "Current Rounds"
5. **Verify:** Published round cards reappear.

### Test 3: Complete button visible on Final Team round card
1. In Current Rounds view, find a level that has a Final Team round (look for a round card labelled "Final Team")
2. Expand that round card
3. Take a snapshot
4. **Verify:** A "Mark Level Complete" button appears below Save Changes / Delete Round

### Test 4: Complete button NOT visible on non-Final-Team rounds
1. Expand a round card that is NOT a Final Team (e.g., "Round 3")
2. Take a snapshot
3. **Verify:** No "Mark Level Complete" button is present

### Test 5: Complete level confirmation dialog
1. On a Final Team round card, click "Mark Level Complete"
2. Take a snapshot
3. **Verify:** A confirmation dialog appears with text mentioning the hero card removal and Completed Teams move
4. Click "Cancel"
5. **Verify:** Dialog closes, nothing changed

### Test 6: Complete a level (write test)
1. On a Final Team round card, click "Mark Level Complete"
2. Click "Complete" in the confirmation dialog
3. **Verify:** The level disappears from Current Rounds view
4. Switch to "Completed Teams" tab
5. Take a snapshot
6. **Verify:** The completed level appears as a card with level name, round count, Made Team count, and finalized date

### Test 7: Completed team card expand/collapse
1. In Completed Teams view, click a completed team card header
2. Take a snapshot
3. **Verify:** Card expands showing a read-only list of rounds (round number, player count, session info). No edit controls visible. An "Uncomplete" button at the bottom.
4. Click the header again
5. **Verify:** Card collapses

### Test 8: Uncomplete a level (write test)
1. In Completed Teams view, expand the completed team card
2. Click "Uncomplete"
3. **Verify:** Confirmation dialog appears mentioning hero card reappearance
4. Click "Reopen"
5. **Verify:** The level disappears from Completed Teams
6. Switch to "Current Rounds"
7. **Verify:** The level's rounds reappear in Current Rounds view

### Test 9: Dashboard hero card hidden for completed level
1. Complete a level (per Test 6)
2. Navigate to `/dashboard`
3. Take a snapshot
4. **Verify:** No hero card for the completed level. Hero cards for other non-completed levels (if any) still show.
5. Navigate back to `/admin/continuations`, uncomplete the level (per Test 8)
6. Navigate to `/dashboard`
7. **Verify:** The hero card reappears

### Test 10: Favourite statuses — Made Team persists from completed level
1. Ensure a favourite player exists who is on the Final Team roster of a level that will be completed
2. Note the player's favourite status before completing
3. Complete the level
4. Navigate to `/dashboard`
5. **Verify:** The favourite player shows "Made Team ({level})" status (e.g., "Made Team (AA)"), not missing
6. Uncomplete the level to revert

### Test 11: Completed Teams empty state
1. Navigate to `/admin/continuations`
2. Switch to "Completed Teams"
3. **Verify:** If no levels are completed, an empty state message is shown: "No completed teams yet..."

### Test 12: Audit log entries
1. Complete and then uncomplete a level
2. Check the `audit_log` table (via Supabase dashboard or SQL)
3. **Verify:** Two entries exist — one for `complete_level` and one for `uncomplete_level`, with correct division and team_level in details

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 6 | Completed a level in `continuation_level_status` | Uncomplete via Test 8 |
| Test 8 | Uncompleted the level | N/A (reverts Test 6) |
| Test 9 | Completed a level | Uncomplete after verification |
| Test 10 | Completed a level | Uncomplete after verification |
| Test 12 | Audit log entries added | Leave in place (read-only data) |

**After all tests pass, verify that no levels remain in "completed" state unless intentionally left that way. Confirm with the user.**

## Files to Touch

### Create
1. `backend/supabase/migrations/[timestamp]_create_continuation_level_status.sql`

### Modify
2. `frontend/app/admin/continuations/page.tsx` — fetch completed levels, pass as prop
3. `frontend/app/admin/continuations/actions.ts` — add `getCompletedLevels`, `completeLevel`, `uncompleteLevel`
4. `frontend/components/admin/admin-continuations-client.tsx` — add toggle, complete button in Final Team cards, Completed Teams view with summary cards and uncomplete
5. `frontend/app/(app)/dashboard/actions.ts` — modify `getDashboardData()` to skip completed levels for hero cards, modify `deriveFavouriteStatuses()` to accept completed levels, exclude from active level selection, and persist Made Team from completed+finalized levels; modify `getMyFavouritesPageData()` similarly
6. `frontend/app/globals.css` — new styles for toggle, complete button, completed team cards
7. `frontend/types/index.ts` — add `ContinuationLevelStatus` type

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (uncomplete any levels left in completed state). Confirm with the user that all test data has been cleaned up.
