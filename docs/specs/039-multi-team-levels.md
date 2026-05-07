# Spec 039: Multi-Team Levels

**PRD Reference:** FR-016, FR-039
**Priority:** Should Have
**Depends on:** 033 (Complete Level), 037 (Favourite Made Team split)

## What This Feature Does

Some divisions produce two teams at the same level (e.g., U18BB may have two BB teams). After a final team round is published, the admin can split the roster into two named sub-teams. Parents see one group initially ("U18BB — 34 players"), and once the admin assigns players, they see two separate collapsible groups ("U18BB Blue — 17 players" and "U18BB White — 17 players"). The split and assignment happens in the admin continuations section; the dashboard, favourites, and Next Year Teams views all reflect the assignments automatically.

## Current State

### Database
- `continuation_level_status` table tracks per-level completion state. Columns: `id`, `association_id`, `division`, `team_level`, `is_completed`, `completed_at`, `completed_by`. Migration: `backend/supabase/migrations/20260425200001_create_continuation_level_status.sql`.
- `tryout_players` table has `team_id` (FK to `teams`) and `status` (enum including `made_team`). No concept of sub-teams.
- `teams` table has `name` (e.g., "AA", "BB"), `division`, `association_id`. The `lockFinalTeam` function in `frontend/app/(app)/continuations/actions.ts:271` matches rounds to teams by `name === team_level`.

### Admin Continuations
- `frontend/components/admin/admin-continuations-client.tsx` — 1675-line client component managing scraping, rounds, and level completion.
- Two views: "Current Rounds" (active levels with round cards) and "Completed Teams" (completed levels with expandable round lists).
- "Mark Level Complete" button appears on final team round cards (line 1479).
- Completed levels show an expandable card with round history and an "Uncomplete" button (line 1555).

### Continuations Page (Parent View)
- `frontend/components/continuations/continuations-page-client.tsx` — shows all published rounds in a dropdown, one at a time.
- Dropdown labels: `"{division} {team_level} - Round {N}"` or `"Final Team"`.
- No grouping by sub-team exists.

### Dashboard
- `frontend/app/(app)/dashboard/actions.ts` — `getDashboardData()` builds hero cards (one per active level) and favourite statuses.
- `deriveFavouriteStatuses()` (line 357) handles made_team grouping by `teamLevel` field on `FavoriteStatus`.
- `frontend/components/dashboard/dashboard-client.tsx` — renders hero cards and favourite cards. Made Team favourites are split per level via `buildStatusGroups()`.

### Favourites Page
- `frontend/components/dashboard/my-favourites-client.tsx` — identical `buildStatusGroups()` logic, splits Made Team by `teamLevel`.
- Both dashboard and favourites use `FavoriteStatus.teamLevel` for grouping, with display text from `statusText` (e.g., "Made NWHA U18 BB").

### Key Functions
- `lockFinalTeam()` in `frontend/app/(app)/continuations/actions.ts:271` — sets `tryout_players.status = 'made_team'` and `tryout_players.team_id` for all jersey numbers in a final team round.
- `deleteRound()` in `frontend/app/(app)/admin/continuations/actions.ts:57` — reverts `made_team` players back to `trying_out` when a final team round is deleted.
- `completeLevel()` / `uncompleteLevel()` in `frontend/app/(app)/admin/continuations/actions.ts` — toggle `continuation_level_status.is_completed`.

## Changes Required

### Database

**New migration:** `backend/supabase/migrations/20260508000001_add_multi_team_levels.sql`

1. **Add `sub_team` column to `tryout_players`:**
   - `sub_team text DEFAULT NULL` — stores the sub-team name (e.g., "Blue", "White", "Team 1"). Null means unassigned or not applicable (single-team level).

2. **Add split columns to `continuation_level_status`:**
   - `is_split boolean NOT NULL DEFAULT false` — whether this level has been split into 2 teams.
   - `sub_team_1_name text DEFAULT 'Team 1'` — display name for first sub-team.
   - `sub_team_2_name text DEFAULT 'Team 2'` — display name for second sub-team.

3. **No new RLS policies needed** — `tryout_players` and `continuation_level_status` already have RLS policies covering admin writes and member reads.

4. **Regenerate types** after migration: `cd backend && supabase gen types typescript --local > ../frontend/types/database.ts`

### Server Actions / API Routes

**New actions in `frontend/app/(app)/admin/continuations/actions.ts`:**

1. `enableSplit(associationId: string, division: string, teamLevel: string, team1Name: string, team2Name: string): Promise<{ error?: string }>`
   - Upserts `continuation_level_status` row with `is_split = true`, `sub_team_1_name`, `sub_team_2_name`.
   - If no `continuation_level_status` row exists for this level yet (level not completed), creates one with `is_completed = false, is_split = true`.

2. `updateSplitNames(associationId: string, division: string, teamLevel: string, team1Name: string, team2Name: string): Promise<{ error?: string }>`
   - Updates `sub_team_1_name` and `sub_team_2_name` on the existing `continuation_level_status` row.

3. `assignSubTeam(playerIds: string[], subTeamName: string): Promise<{ error?: string }>`
   - Bulk-updates `tryout_players.sub_team = subTeamName` for the given player IDs.

4. `removeSplit(associationId: string, division: string, teamLevel: string): Promise<{ error?: string }>`
   - Sets `is_split = false`, `sub_team_1_name = 'Team 1'`, `sub_team_2_name = 'Team 2'` on `continuation_level_status`.
   - Clears `sub_team = NULL` on all `tryout_players` matching that association/division that were assigned to either sub-team and have `status = 'made_team'` and belong to the matching team.

5. `getSplitStatus(associationId: string, division: string): Promise<SplitStatus[]>`
   - Returns all `continuation_level_status` rows for the division, including the new `is_split`, `sub_team_1_name`, `sub_team_2_name` columns.
   - Type: `SplitStatus = { team_level: string, is_completed: boolean, is_split: boolean, sub_team_1_name: string, sub_team_2_name: string }`

**Modified actions:**

6. Modify `deleteRound()` — when deleting a final team round for a split level, also clear `sub_team = NULL` on affected players and set `is_split = false` on the `continuation_level_status`.

### Pages

No new pages. Modifications to existing pages:

- `/admin/continuations` (page.tsx) — pass split status data to client component.
- `/continuations` (page.tsx) — pass split status data to client component.
- `/dashboard` (page.tsx) — no changes needed (data flows through `getDashboardData`).

### Components

**`frontend/components/admin/admin-continuations-client.tsx` — Major additions:**

1. **New prop:** `splitStatuses: SplitStatus[]` — passed from the server page.

2. **Split button on final team levels:**
   - In the "Current Rounds" view: below the "Mark Level Complete" button on final team round cards, add a "Split into 2 Teams" button (only if the level is not already split).
   - In the "Completed Teams" view: inside the expanded completed level card, add a "Split into 2 Teams" button (only if not already split).

3. **Split setup flow (modal or inline panel):**
   - When "Split into 2 Teams" is clicked, show a panel with:
     - Two text inputs for team names (default "Team 1" / "Team 2").
     - "Enable Split" button to call `enableSplit()`.
     - "Cancel" button.

4. **Sub-team assignment UI (shown when a level is split):**
   - In both "Current Rounds" (on final team cards) and "Completed Teams" (in expanded cards):
   - Show three sections: "Unassigned", "[Team 1 Name]", "[Team 2 Name]", each with a player count.
   - Player list with checkboxes. Each row shows: checkbox, jersey number, player name, position.
   - Two "Assign to [Name]" buttons at the top. Admin selects players via checkboxes, then clicks an assign button.
   - Players move between sections optimistically (local state update), with server call in background.
   - "Remove Split" button to undo the entire split (confirmation modal).
   - Editable team name fields (inline text inputs) that call `updateSplitNames()` on blur.

5. **Fetch player data for assignment UI:**
   - The admin continuations page already receives `publishedRounds` which contain `jersey_numbers` for the final team round.
   - Fetch `tryout_players` for the division (with `sub_team` field) to populate assignment status.
   - Need to pass players as a new prop or fetch within the component.

**`frontend/app/(app)/admin/continuations/page.tsx` — Modified:**
- Fetch split statuses via `getSplitStatus()` and pass to client.
- Fetch players for the division (for sub-team assignment display) and pass to client.

**`frontend/components/continuations/continuations-page-client.tsx` — Modified:**
- Accept new prop: `splitStatuses: SplitStatus[]`.
- When displaying a final team round for a split level with assigned players:
  - Instead of one player list, render two collapsible sections — one per sub-team name.
  - Unassigned players (sub_team is null) go in a third "Unassigned" section if any remain.
  - Each section has its own player count, position filter, and drag ordering.
- The round dropdown label changes from "U18 BB - Final Team" to show both sub-teams after split.

**`frontend/app/(app)/continuations/page.tsx` — Modified:**
- Fetch split statuses and pass to client.
- Include `sub_team` field in the players query.

**`frontend/app/(app)/dashboard/actions.ts` — Modified:**
- `FavoriteStatus` type: add `subTeam: string | null` field.
- `HeroCard` type: add `isSplit: boolean`, `subTeam1Name: string | null`, `subTeam2Name: string | null` fields. Also add `rosterPlayers` sub-team annotation: each `HeroPlayerRow` gets a `subTeam: string | null` field.
- `getDashboardData()`: fetch `continuation_level_status` with split columns. When building hero cards for split levels, annotate roster players with their `sub_team` value.
- `deriveFavouriteStatuses()`: when a player has `sub_team` set, include it in the `FavoriteStatus` as `subTeam` and append the sub-team name to `statusText` (e.g., "Made NWHA U18 BB (Blue)").

**`frontend/components/dashboard/dashboard-client.tsx` — Modified:**
- `buildStatusGroups()`: when grouping made_team players, further split by `subTeam` within a level. Group key changes from `made_team:BB` to `made_team:BB:Blue` and `made_team:BB:White`. Players with no sub-team assignment stay in `made_team:BB`.
- `renderFinalTeamHeroCard()`: if the hero card is for a split level, show sub-team section headers within the roster list, grouping players under "[Team 1 Name]" and "[Team 2 Name]" headers. Unassigned players go under "Unassigned" header.
- `getStatusLabel()`: use `statusText` from the `FavoriteStatus` which already includes the sub-team name.

**`frontend/components/dashboard/my-favourites-client.tsx` — Modified:**
- Same `buildStatusGroups()` changes as dashboard: split by `subTeam` within made_team levels.
- `getStatusLabel()`: same adjustment.

### Styles

**New CSS classes in `frontend/app/globals.css`:**

- `.admin-split-btn` — button style for "Split into 2 Teams" action (green/teal accent, similar to existing admin action buttons).
- `.admin-split-setup` — panel containing the two team name inputs and enable/cancel buttons.
- `.admin-split-name-input` — text input for sub-team names.
- `.admin-split-section` — container for each sub-team group (Unassigned / Team 1 / Team 2) in the assignment UI.
- `.admin-split-section-header` — header row showing sub-team name and player count.
- `.admin-split-player-row` — player row with checkbox in the assignment UI.
- `.admin-split-player-checkbox` — checkbox styling.
- `.admin-split-assign-bar` — sticky bar at top of assignment UI with the two "Assign to X" buttons.
- `.admin-split-assign-btn` — individual assign button.
- `.admin-remove-split-btn` — destructive button for removing the split.
- `.continuations-subteam-header` — section header in the parent-facing continuations page separating sub-teams within a final team round.
- `.dashboard-hero-subteam-header` — sub-team divider within hero card roster lists.

## Key Implementation Details

1. **The `sub_team` column is a plain text field, not a foreign key.** Its value matches either `sub_team_1_name` or `sub_team_2_name` from `continuation_level_status`. When the admin renames a sub-team, all matching `tryout_players.sub_team` values must also be updated.

2. **Split can happen before or after level completion.** The `continuation_level_status` row is created when the split is enabled (if it doesn't already exist from level completion). `is_completed` and `is_split` are independent flags.

3. **The existing `lockFinalTeam()` flow is unchanged.** When a final team round is confirmed, players get `status = 'made_team'` and `team_id` set. The split is a separate step that only adds `sub_team` assignment. This means a player has `team_id` (pointing to the BB team record) AND `sub_team` (e.g., "Blue").

4. **Continuations page grouping:** The parent-facing continuations page currently shows one round at a time via a dropdown. For a split level's final team round, the player list should be rendered as two (or three, if there are unassigned) collapsible sections. Each section keeps its own position filter state and drag ordering. The `continuation_orders` table already uses `round_id` as the key — for sub-team ordering, extend the key to `round_id + sub_team_name` or store sub-team orders within the same order array.

5. **Dashboard hero card:** For a split level that isn't yet completed, the hero card still shows as one card ("U18 BB - Final Team" with 34 players). The roster list within the card groups players by sub-team with section headers. This doesn't create two separate hero cards — that would be confusing since both sub-teams share the same round.

6. **Favourites sub-team display:** The `FavoriteStatus.statusText` already shows "Made NWHA U18 BB". After split, players assigned to sub-teams show "Made NWHA U18 BB (Blue)" and unassigned ones keep "Made NWHA U18 BB". The `buildStatusGroups()` function creates separate group entries for each sub-team within the same level.

7. **Deleting the final team round clears the split.** The modified `deleteRound()` must clear `sub_team` on all affected players and reset `is_split = false` on `continuation_level_status`.

8. **Renaming sub-teams cascades.** When the admin renames a sub-team (e.g., "Team 1" → "Blue"), the `updateSplitNames()` action must also update all `tryout_players.sub_team` values that matched the old name.

9. **Pattern to follow:** The split assignment UI follows the same patterns as the existing admin continuations component — modal overlays for confirmations, inline panels for forms, optimistic local state updates with `setPublishedRounds`/`setCompletedLevels` patterns, and `router.refresh()` after server mutations. Use the existing CSS class naming convention (`.admin-*` prefix).

10. **Max 2 sub-teams.** The UI and data model hardcode a maximum of 2 sub-teams. No UI for adding a third.

## Acceptance Criteria

- [ ] Admin can click "Split into 2 Teams" on any level with a final team round (both Current Rounds and Completed Teams views)
- [ ] Admin can name both sub-teams (defaults to "Team 1" / "Team 2")
- [ ] Admin can select multiple players via checkboxes and assign them to either sub-team
- [ ] Admin can rename sub-teams after initial setup
- [ ] Admin can remove the split entirely (clears all sub-team assignments)
- [ ] Continuations page (parent view) shows two separate collapsible groups after split and assignment
- [ ] Continuations page shows one group when level has no split or no assignments yet
- [ ] Dashboard hero card for a split level shows sub-team section headers in the roster list
- [ ] Dashboard favourites show separate cards for each sub-team within a level (e.g., "Made U18 BB (Blue)" and "Made U18 BB (White)")
- [ ] My Favourites page shows separate groups per sub-team
- [ ] Deleting the final team round for a split level clears all sub-team data
- [ ] Renaming a sub-team updates all affected player records
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to
`docs/specs/temp-testing-screenshots/`. Never save screenshots to the
repo root or any other location. This directory is for ephemeral test
artifacts only — clean it up after testing is complete.

**CRITICAL — Testing Association:**
All write tests MUST use the **Test / Sandbox association**
(`a2000000-0000-0000-0000-000000000002`). NEVER run write
operations against NGHA (Nepean Wildcats) or NWHA or any other live
association during testing. Switch to the TEST association in
the app before running any write test. Read-only tests
(navigate, snapshot, verify UI) may use a live association.
If the sandbox lacks required test data, set it up there
first — do NOT modify live data as a shortcut.

**Live Data Safety:**
Tests run against the real database. You MUST follow these
rules:

1. **Prefer read-only tests.** Verify by navigating and taking
   snapshots — do not modify data unless the test absolutely
   requires it.
2. **All write tests use the TEST / Sandbox association.**
   Switch to it before any mutation. Never write to NGHA/NWHA or
   other live associations.
3. **When a test MUST write data**, log every mutation in the
   "Test Mutations" list at the end of this section.
4. **Revert all test mutations after testing.**
5. **Confirm with the user.**
6. **Never delete real player records or change real player
   statuses during testing.**

**Setup:**
1. Ensure the Test / Sandbox association has at least one division with a published final team round containing 20+ players (to simulate a split scenario).
2. Log in as a group admin for the Test association.
3. Navigate to the admin continuations page.

### Test 1: Split button visibility — Current Rounds
1. Navigate to `/admin/continuations` for the Test association.
2. Expand a final team round card for any level.
3. **Verify:** A "Split into 2 Teams" button appears below "Mark Level Complete".
4. **Verify:** The button does NOT appear on non-final-team round cards.

### Test 2: Enable split — name teams
1. Click "Split into 2 Teams" on the final team round.
2. **Verify:** A panel appears with two text inputs pre-filled with "Team 1" and "Team 2".
3. Change the names to "Blue" and "White".
4. Click "Enable Split".
5. **Verify:** The split setup panel closes and the sub-team assignment UI appears.
6. **Verify:** Three sections are visible: "Unassigned (N)", "Blue (0)", "White (0)" where N is the number of players on the final team.

### Test 3: Bulk assign players to sub-teams
1. In the assignment UI, check the checkboxes for the first 10 players.
2. Click "Assign to Blue".
3. **Verify:** The 10 players move from "Unassigned" to "Blue" section. Counts update.
4. Check the remaining unassigned players.
5. Click "Assign to White".
6. **Verify:** All remaining players are now in "White". "Unassigned" section is empty or hidden.

### Test 4: Persistence — reload and verify
1. Reload the admin continuations page.
2. Expand the final team round card.
3. **Verify:** The sub-team assignment UI shows the same distribution: "Blue (10)" and "White (N-10)".

### Test 5: Rename sub-teams
1. In the assignment UI, change "Blue" to "Beavers" in the team name input.
2. Tab out or blur the input.
3. **Verify:** The section header updates to "Beavers".
4. Reload the page and verify the name persisted.

### Test 6: Parent view — continuations page with split
1. Log in as a parent member of the Test association (or stay as admin viewing the parent page).
2. Navigate to `/continuations`.
3. Select the final team round for the split level from the dropdown.
4. **Verify:** Two separate collapsible sections appear — one for each sub-team name.
5. **Verify:** Each section shows the correct player count and player list.
6. **Verify:** Unassigned players (if any) appear in a separate section.

### Test 7: Dashboard favourites with split
1. Heart at least one player in each sub-team (from the continuations page or teams page).
2. Navigate to `/dashboard`.
3. **Verify:** The favourites section shows separate cards for each sub-team (e.g., "Made [Team Name] (Beavers)" and "Made [Team Name] (White)").

### Test 8: My Favourites page with split
1. Navigate to `/my-favourites`.
2. **Verify:** Made Team players are grouped by sub-team — separate collapsible sections for "Beavers" and "White".
3. **Verify:** Each section header includes the sub-team name.

### Test 9: Dashboard hero card with sub-team headers
1. If the split level is NOT completed, navigate to `/dashboard`.
2. **Verify:** The hero card for the split level shows sub-team section headers in the roster list, grouping players under "Beavers" and "White".

### Test 10: Remove split
1. Navigate to `/admin/continuations`.
2. In the sub-team assignment UI, click "Remove Split".
3. **Verify:** A confirmation modal appears warning that all sub-team assignments will be cleared.
4. Confirm the removal.
5. **Verify:** The assignment UI disappears. The "Split into 2 Teams" button reappears.
6. Navigate to `/continuations` as parent.
7. **Verify:** The final team round shows one unified player list (no sub-team sections).

### Test 11: Split on completed level
1. Complete the level first (if not already completed).
2. Switch to "Completed Teams" view in admin continuations.
3. Expand the completed level card.
4. Click "Split into 2 Teams".
5. **Verify:** The split setup and assignment UI works identically to the Current Rounds view.

### Test 12: Delete final team round clears split
1. Enable a split and assign players.
2. Switch to "Current Rounds" view. Expand the final team round. Delete it.
3. **Verify:** The split data is cleared (re-create the round and verify no split exists).

### Test 13: Empty state — no assignments yet
1. Enable a split but don't assign any players.
2. Navigate to `/continuations` as parent.
3. **Verify:** The final team round shows one unified player list (since no sub-team assignments exist yet).
4. Navigate to `/dashboard`.
5. **Verify:** Favourites still show the level as one group (no sub-team split in display).

### Test 14: Mobile viewport
1. Resize browser to 390x844 (iPhone viewport).
2. Navigate through the admin split UI, parent continuations page, and dashboard.
3. **Verify:** All elements are usable — checkboxes tappable, assign buttons reachable, sub-team sections collapsible.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 2 | Enabled split on level X with names "Blue"/"White" | Remove split via admin UI (Test 10) |
| Test 3 | Assigned players to sub-teams | Remove split clears all assignments |
| Test 5 | Renamed "Blue" to "Beavers" | Remove split or rename back |
| Test 7 | Hearted players in sub-teams | Un-heart via long-press menu |
| Test 10 | Removed split | No revert needed (returns to pre-split state) |
| Test 11 | Enabled split on completed level | Remove split via admin UI |
| Test 12 | Deleted final team round | Re-scrape/create round if needed |

**After all tests pass, revert every mutation above and confirm with
the user that the data is clean.**

## Files to Touch

1. `backend/supabase/migrations/20260508000001_add_multi_team_levels.sql` — **New** migration
2. `frontend/types/database.ts` — **Regenerated** after migration
3. `frontend/types/index.ts` — Add `ContinuationLevelStatus` update if needed for new columns
4. `frontend/app/(app)/admin/continuations/actions.ts` — Add `enableSplit`, `updateSplitNames`, `assignSubTeam`, `removeSplit`, `getSplitStatus`. Modify `deleteRound`.
5. `frontend/app/(app)/admin/continuations/page.tsx` — Fetch split statuses and players, pass to client.
6. `frontend/components/admin/admin-continuations-client.tsx` — Add split button, setup panel, assignment UI, remove split. New props for split statuses and players.
7. `frontend/app/(app)/continuations/page.tsx` — Fetch split statuses, pass to client.
8. `frontend/components/continuations/continuations-page-client.tsx` — Accept split statuses prop, render sub-team sections for split levels.
9. `frontend/app/(app)/dashboard/actions.ts` — Extend `FavoriteStatus` and `HeroCard` types with sub-team fields. Modify `getDashboardData` and `deriveFavouriteStatuses` to include sub-team data.
10. `frontend/components/dashboard/dashboard-client.tsx` — Modify `buildStatusGroups` for sub-team splitting, add sub-team headers in hero card roster.
11. `frontend/components/dashboard/my-favourites-client.tsx` — Modify `buildStatusGroups` for sub-team splitting.
12. `frontend/app/globals.css` — Add new CSS classes for split UI.

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
6. **Revert all test mutations.** Check the Test Mutations Log and
   undo every data change made during testing (remove splits, un-heart
   players, etc.). Confirm with the user that all test data has been
   cleaned up.
