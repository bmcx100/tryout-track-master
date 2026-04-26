# Spec 035: Withdrawn Status

**PRD Reference:** FR-021 (Player Management)
**Priority:** Must Have
**Depends on:** 024 (Player detail form redesign)

## What This Feature Does

Parents and admins can set a player's status to "Withdrew" from the player detail sheet. The status dropdown always appears beside "Previous Team" with three options: Trying Out, Made Team, Withdrew. Withdrawn players are faded in the Previous Teams view, excluded from team header player counts, and completely hidden from the Predictions view.

For parents, this saves as a personal annotation (only they see the effects). For admins, it updates the actual player record in the database (affects everyone).

## Current State

### Player Detail Sheet
`frontend/components/teams/long-press-menu.tsx` — The bottom sheet that opens when a player is tapped.

**Read-only mode** (lines 534-558): Shows "Previous Team" on the left and a conditional right column:
- If `customTeam` annotation exists: shows "Team" label + the value
- If `player.status === "made_team"`: shows "Team" label + "Made Team"
- Otherwise: shows "Status" label + the player's status text

**Edit mode** (lines 480-493): For non-admin users, shows a "Status" dropdown that saves to the `customTeam` annotation field. The dropdown has 8 options (all `player_status` enum values). This dropdown is hidden for admin users.

### Annotations System
- `frontend/types/index.ts` — `Annotations` type includes `customTeam: string | null`
- `frontend/app/(app)/annotations/actions.ts` — `savePlayerAnnotations()` saves `customTeam` to `player_annotations.custom_team` column
- `backend/supabase/migrations/20260424000001_add_custom_annotation_columns.sql` — `custom_team text` column exists

### Admin Player Updates
- `frontend/app/(app)/players/actions.ts` — `adminUpdatePlayer()` accepts `{ name, jersey_number, position, previous_team }`. Does NOT currently accept `status`.

### Teams Page
- `frontend/app/(app)/teams/page.tsx` — Fetches all players for the active division (no status filtering). All players, including those with `status = 'withdrew'`, are passed to `TeamsPageClient`.
- `frontend/components/teams/teams-page-client.tsx` — Passes all players to both `PredictionBoard` and `PreviousTeamsView` without filtering by status.

### Previous Teams View
- `frontend/components/teams/previous-teams-view.tsx` — Groups players by `previous_team`. Team header shows player count via `allPlayers.length`. No awareness of withdrawn status.

### Prediction Board
- `frontend/components/teams/prediction-board.tsx` — Distributes all non-`made_team` players across teams using position caps (9F/6D/2G). No awareness of withdrawn status.

### Player Row
- `frontend/components/teams/player-row.tsx` — Renders each player. No fading/dimming capability based on status.

### Database Enum
- `backend/supabase/migrations/20260417000001_create_enums.sql` — `player_status` enum already includes `'withdrew'`.

## Changes Required

### Database
No database changes needed. The `player_status` enum already has `'withdrew'`, and the `player_annotations.custom_team` column can store the annotation value.

### Server Actions / API Routes

**Modify `frontend/app/(app)/players/actions.ts`:**
- Add `status` to the accepted fields in `adminUpdatePlayer()`:
  ```
  updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string, status?: string }
  ```
- The Supabase update already uses a generic spread, so accepting the new field is sufficient.

### Pages
No new pages needed.

### Components

**Modify `frontend/components/teams/long-press-menu.tsx`:**

1. Replace the `STATUS_OPTIONS` constant with a simplified 3-option list:
   - `{ value: "trying_out", label: "Trying Out" }`
   - `{ value: "made_team", label: "Made Team" }`
   - `{ value: "withdrew", label: "Withdrew" }`

2. **Read-only mode**: Replace the conditional Team/Status second column (lines 534-558) with a permanent "Status" field:
   - Label: "Status"
   - Value: Display the effective status text (annotation `customTeam` if set, else `player.status`)
   - Use `STATUS_LABELS` for display text

3. **Edit mode**: Show the Status dropdown for both parents AND admins (remove the `{!isAdmin && ...}` guard on lines 480-493). Position it beside Previous Team in the existing `detail-sheet-edit-row` layout.

4. **Admin save logic**: When admin saves and the status value differs from the official status, include `status` in the `onAdminUpdate` call.

5. **Parent save logic**: Continue saving the status choice to `customTeam` annotation via `onSaveAnnotations`.

6. Add a new state variable `statusValue` initialized from the effective status (annotation or DB). Currently the status value is stored in `teamValue` — rename for clarity.

**Modify `frontend/components/teams/long-press-menu.tsx` props:**
- Add `onAdminUpdate` signature to accept `status`:
  ```
  onAdminUpdate?: (updates: { name?: string, jersey_number?: string, position?: string, previous_team?: string, status?: string }) => Promise<{ error?: string }>
  ```

**Modify `frontend/components/teams/teams-page-client.tsx`:**

1. Compute a set of withdrawn player IDs by combining:
   - Players where `player.status === "withdrew"` (DB-level, affects everyone)
   - Players where `annotations[player.id]?.customTeam === "withdrew"` (personal annotation)

2. **Predictions view**: Filter out withdrawn players before passing to `PredictionBoard`:
   ```
   const activePlayers = players.filter(p => !withdrawnIds.has(p.id))
   ```
   Pass `activePlayers` instead of `players` to `PredictionBoard`.

3. **Previous Teams view**: Pass a new `withdrawnIds` prop to `PreviousTeamsView`.

4. Update `handleAdminUpdate` callback to accept and forward the `status` field.

**Modify `frontend/components/teams/previous-teams-view.tsx`:**

1. Accept new prop `withdrawnIds?: Set<string>`.

2. In `SortableTeamSection`:
   - Pass `withdrawnIds` down.
   - Compute display count excluding withdrawn players: `allPlayers.filter(p => !withdrawnIds?.has(p.id)).length`
   - Use this count in the team header instead of `allPlayers.length`.

3. Pass `isWithdrawn` flag to `PlayerRow` for each player.

**Modify `frontend/components/teams/player-row.tsx`:**

1. Accept new prop `isWithdrawn?: boolean`.
2. When `isWithdrawn` is true, add a CSS class `player-row-withdrawn` to the row element.

**Modify `frontend/components/teams/prediction-board.tsx`:**
No changes needed — withdrawn players are filtered out before they reach this component.

**Modify `frontend/components/teams/team-section.tsx`:**
If this component also shows player counts, update to accept and respect `withdrawnIds`.

### Styles

Add to `frontend/app/globals.css`:

```css
/* Withdrawn player row — faded appearance */
.player-row-withdrawn {
  @apply opacity-40;
}

.player-row-withdrawn .player-drag-handle {
  @apply pointer-events-none;
}
```

The faded row should have reduced opacity (around 0.4) and the drag handle should be disabled (no reordering withdrawn players).

## Key Implementation Details

1. **Effective status resolution**: The "effective status" for display and behavior is determined by:
   - If the user has a `customTeam` annotation set for this player, use that value
   - Otherwise, use the player's DB `status` field
   - This applies to both the detail sheet display and the withdrawn filtering logic

2. **Admin status change flow**: When an admin changes status via the detail sheet:
   - The `adminUpdatePlayer` server action updates `player.status` in the DB
   - The optimistic local update in `TeamsPageClient.handleAdminUpdate` updates the player's status in state
   - This immediately triggers re-computation of `withdrawnIds`

3. **Parent status change flow**: When a parent changes status:
   - Saves to `customTeam` annotation (existing flow via `savePlayerAnnotations`)
   - The `annotations` state in `TeamsPageClient` is updated optimistically
   - `withdrawnIds` is recomputed, causing the withdrawn player to fade/disappear

4. **Correction flow**: When a parent sets a status, do NOT trigger the correction popup for status changes. Status is a personal annotation, not a correction to official data. Only name, jersey, position, and previous team changes trigger corrections.

5. **Position filter interaction**: When a position filter is active AND a player is withdrawn, the player should still be faded (not hidden) in Previous Teams. The position filter and withdrawn status are independent visual treatments.

6. **Edge case — admin sets withdrew then parent views**: If an admin sets `player.status = "withdrew"` in the DB, all users see the player as withdrawn (faded in Previous Teams, hidden from Predictions). A parent's `customTeam` annotation can override this back to "trying_out" if they disagree — their personal view takes precedence for their own experience.

## Acceptance Criteria

- [ ] Player detail sheet read-only mode shows "Status" beside "Previous Team" for all players
- [ ] Player detail sheet edit mode shows a 3-option Status dropdown (Trying Out, Made Team, Withdrew) for both parents and admins
- [ ] Parent status change saves to `customTeam` annotation
- [ ] Admin status change saves to `player.status` in the DB via `adminUpdatePlayer`
- [ ] Withdrawn players appear faded (reduced opacity) in Previous Teams view
- [ ] Withdrawn players are NOT included in team header player counts in Previous Teams
- [ ] Withdrawn players do NOT appear in Predictions view
- [ ] Drag handle is disabled on faded/withdrawn player rows
- [ ] Status changes do NOT trigger the correction popup
- [ ] Position filter and withdrawn status are independent (faded + filtered works correctly)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`.

**CRITICAL — Testing Association:**
All write tests MUST use the **Test / Sandbox association** (`a2000000-0000-0000-0000-000000000002`). NEVER run write operations against NGHA or any other live association.

**Setup:**
1. Log in as `testparent@test.com` / `testpass123`
2. Switch to the Test Sandbox association if not already selected
3. Navigate to `/teams`

### Test 1: Status field visible in read-only detail sheet
1. Tap any player to open the detail sheet
2. **Verify:** Two fields visible below the jersey/heart row: "Previous Team" on the left, "Status" on the right
3. **Verify:** Status shows the player's current status text (e.g., "Trying Out")
4. Close the sheet

### Test 2: Status dropdown in edit mode (parent)
1. Tap a player to open the detail sheet
2. Tap "Edit"
3. **Verify:** A "Status" dropdown appears beside "Previous Team" with exactly 3 options: Trying Out, Made Team, Withdrew
4. Cancel without saving

### Test 3: Set player to Withdrew (parent) — Previous Teams view
1. Ensure "Previous Teams" view is active
2. Note the player count in the team header for the first team group
3. Tap a player in that group to open the detail sheet
4. Tap "Edit"
5. Select "Withdrew" from the Status dropdown
6. Tap "Save"
7. **Verify:** No correction popup appears (status changes skip corrections)
8. **Verify:** The player row is visually faded (reduced opacity)
9. **Verify:** The team header player count has decreased by 1
10. Take screenshot

### Test 4: Withdrawn player hidden from Predictions view
1. After Test 3 (player is withdrawn), switch to "Predictions" view
2. **Verify:** The withdrawn player does NOT appear in any team section
3. Take screenshot

### Test 5: Revert withdrawn status (parent)
1. Switch back to "Previous Teams" view
2. Tap the faded player
3. Tap "Edit"
4. **Verify:** Status dropdown shows "Withdrew" selected
5. Change to "Trying Out"
6. Tap "Save"
7. **Verify:** Player row returns to normal opacity
8. **Verify:** Team header player count increases by 1
9. Switch to "Predictions" view
10. **Verify:** Player reappears in the predictions

### Test 6: Admin status change (if admin account available)
1. Log in as `testadmin@test.com` / `TestAdmin1234`
2. Switch to Test Sandbox association
3. Navigate to `/teams`
4. Tap a player, tap Edit
5. **Verify:** Status dropdown is available for admin (not hidden)
6. Change status to "Withdrew", save
7. **Verify:** Player fades in Previous Teams, disappears from Predictions
8. Revert the status back to "Trying Out"

### Test 7: Position filter + withdrawn interaction
1. Set a player to Withdrew
2. Apply a position filter (e.g., "F" for forwards)
3. **Verify:** If the withdrawn player matches the filter, they appear faded
4. **Verify:** If they don't match the filter, they're hidden by the filter (normal behavior)
5. Revert the player status

### Test 8: Status display for different statuses
1. Tap a player, tap Edit, set to "Made Team", save
2. **Verify:** Read-only view shows "Made Team" in the Status field
3. Tap Edit, set back to "Trying Out", save
4. **Verify:** Read-only view shows "Trying Out"

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 3 | Set player status annotation to "withdrew" | Test 5 reverts to "trying_out" |
| Test 5 | Set player status annotation to "trying_out" | Already clean state |
| Test 6 | Admin set player DB status to "withdrew" | Revert in Test 6 to "trying_out" |
| Test 7 | Set player status annotation to "withdrew" | Revert in Test 7 step 5 |
| Test 8 | Set player status annotation to "made_team" then "trying_out" | Already clean state |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

1. `frontend/components/teams/long-press-menu.tsx` — Simplify STATUS_OPTIONS, always show Status field, enable for admins
2. `frontend/components/teams/teams-page-client.tsx` — Compute withdrawnIds, filter players for predictions
3. `frontend/components/teams/previous-teams-view.tsx` — Accept withdrawnIds, exclude from counts, pass to rows
4. `frontend/components/teams/player-row.tsx` — Accept isWithdrawn prop, add faded class
5. `frontend/app/(app)/players/actions.ts` — Add `status` to adminUpdatePlayer accepted fields
6. `frontend/app/globals.css` — Add `.player-row-withdrawn` styles

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
