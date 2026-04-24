# Spec 024: Player Detail Form Redesign

**PRD Reference:** FR-021
**Priority:** Must Have
**Depends on:** None (builds on existing detail sheet from Spec 006)

## What This Feature Does

Redesigns the player detail bottom-sheet into a cleaner single-page form with two modes: a **read-only view** (default) and an **edit mode** (unlocked by tapping an Edit button). Heart and Notes are always editable. All other fields (Jersey, Name, Position, Previous Team, Team) are read-only until Edit is tapped. When a parent saves edits, changes are stored locally as custom annotations AND the user is prompted to submit them as corrections for admin review. Admins save directly to the official player record.

## Current State

### Component
- **`frontend/components/teams/long-press-menu.tsx`** (394 lines) — the current detail sheet. Bottom-sheet modal with overlay. Has parent mode (editable name/jersey, read-only position/previous team) and admin mode (all editable). Auto-saves notes on blur, triggers correction popup on close for parent name/jersey changes.

### Database
- **`player_annotations`** table — per-user private data: `is_favorite` (boolean), `notes` (text), `custom_name` (text). Missing: `custom_jersey`, `custom_position`, `custom_previous_team`, `custom_team`.
- **`corrections`** table — generic `field_name` text column, `old_value`, `new_value`. Currently only handles `name`, `jersey_number`, and `add_player`. The `reviewCorrection` function in `frontend/app/(app)/corrections/actions.ts` only applies `name` and `jersey_number` corrections.

### Server Actions
- **`frontend/app/(app)/annotations/actions.ts`** — `toggleFavorite`, `saveCustomName`, `savePlayerNote`, `getPlayerAnnotations`, `getMyPlayers`, `getMyPlayersCount`, `bulkToggleFavorite`
- **`frontend/app/(app)/corrections/actions.ts`** — `submitCorrection`, `getPendingCorrections`, `reviewCorrection`, `suggestPlayer`, `reviewSuggestedPlayer`
- **`frontend/app/(app)/players/actions.ts`** — `adminUpdatePlayer`, `adminDeletePlayer`

### Consuming Components
These files use the `Annotations` type and display custom names:
- `frontend/components/teams/teams-page-client.tsx` — owns annotation state, passes to detail sheet
- `frontend/components/teams/player-row.tsx` — displays custom name, note icon, heart
- `frontend/components/continuations/continuations-page-client.tsx` — same pattern for continuations
- `frontend/components/continuations/continuation-player-row.tsx` — similar to player-row
- `frontend/components/continuations/round-section.tsx` — passes annotations
- `frontend/components/teams/prediction-board.tsx` — passes annotations
- `frontend/components/teams/previous-teams-view.tsx` — passes annotations
- `frontend/components/teams/team-section.tsx` — passes annotations
- `frontend/components/dashboard/my-favourites-client.tsx` — My Favourites page

### Type Definition
The `Annotations` type is defined inline in `teams-page-client.tsx`:
```
type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>
```

## Changes Required

### Database

New migration to add custom annotation columns:

```
ALTER TABLE player_annotations ADD COLUMN custom_jersey text;
ALTER TABLE player_annotations ADD COLUMN custom_position text;
ALTER TABLE player_annotations ADD COLUMN custom_previous_team text;
ALTER TABLE player_annotations ADD COLUMN custom_team text;
```

No new RLS policies needed — existing user-scoped policies on `player_annotations` already cover all columns.

### Server Actions / API Routes

#### `frontend/app/(app)/annotations/actions.ts`

1. **`getPlayerAnnotations`** — extend returned object to include `customJersey`, `customPosition`, `customPreviousTeam`, `customTeam` from the new columns.

2. **`savePlayerAnnotations`** — NEW action. Replaces the individual `saveCustomName` function with a single function that upserts all custom annotation fields at once:
   ```
   savePlayerAnnotations(playerId: string, annotations: {
     customName?: string | null,
     customJersey?: string | null,
     customPosition?: string | null,
     customPreviousTeam?: string | null,
     customTeam?: string | null,
   })
   ```
   Keep `saveCustomName` for backward compatibility but have it call `savePlayerAnnotations` internally.

3. **`getMyPlayers`** — extend the returned annotations to include the new custom fields. Also update the filter: currently checks `is_favorite.eq.true,custom_name.neq.` — extend to also match rows with any of the new custom fields set.

#### `frontend/app/(app)/corrections/actions.ts`

1. **`reviewCorrection`** — extend the `if/else if` chain to handle `position`, `previous_team`, and `team` field names. For `position` and `previous_team`, update the corresponding column on `tryout_players`. For `team`, look up the team by name in the `teams` table for the player's association+division, then set `team_id` on the player.

2. **`getPendingCorrections`** — update the `CorrectionRow` type and the label display logic to handle the new field names. Add a `fieldLabel` helper: `name` → "Name", `jersey_number` → "Jersey #", `position` → "Position", `previous_team` → "Previous Team", `team` → "Team".

### Pages

No new pages. The detail sheet is rendered inline by parent components.

#### `frontend/app/(app)/settings/corrections/page.tsx` (or wherever corrections are reviewed)
Update the corrections review UI to display the new field types with appropriate labels.

### Components

#### `frontend/components/teams/long-press-menu.tsx` — Major Rewrite

Rename the component to `PlayerDetailSheet` (keep `long-press-menu.tsx` filename for now; rename is optional).

**Props changes:**
- Add `customJersey`, `customPosition`, `customPreviousTeam`, `customTeam` to props (or pass a single `annotations` object).
- Add `onSaveAnnotations` callback that accepts all custom fields at once.
- Remove individual `onSaveName` prop (consolidated into `onSaveAnnotations`).
- Add `teams` prop (list of teams for the player's division, used to display team name from `team_id` and for team correction options).

**UI structure — Two Modes:**

**Read-Only Mode (default):**
All fields displayed as text. Heart and Notes remain interactive (always editable).

Layout (single page, no scroll):
```
┌──────────────────────────────┐
│  [Edit ✏️]    Player Details  [X]  │
│──────────────────────────────│
│  #42  F  │  Player Name         │
│──────────────────────────────│
│  Previous Team: U13 AA           │
│  Team: U15 A  (or status if none)│
│──────────────────────────────│
│  ♥ Favorited                     │
│  Notes: [always-editable area]   │
└──────────────────────────────┘
```

- Top row: Jersey + Position on the left, Name on the right — compact, single line.
- Middle section: Previous Team and Team (or tryout status if no team assigned).
- Bottom section: Heart toggle and Notes textarea — always interactive.
- Edit button (pencil icon) in the header, left side.
- X close button in the header, right side.
- Admin: Trash icon in header (between Edit and X).

**Edit Mode (after tapping Edit button):**
Jersey, Name, Position, Previous Team, and Team become editable inputs. A **Save** button and **Cancel** button appear at the bottom.

- Jersey: text input
- Name: text input
- Position: 3-button selector (F / D / G) — same as current admin mode
- Previous Team: text input
- Team: read-only text (this is the official team assignment — parents can submit a correction but can't change it locally in a meaningful way). Actually, show as text input for parents to type what they believe the team should be; stored as `custom_team` annotation.
- Save button: saves all custom annotations, then shows correction popup for any changed fields
- Cancel button: discards all changes silently, returns to read-only mode

**Correction Popup (parent mode only):**
After Save, if any fields differ from the official DB values, show the existing correction popup pattern listing ALL changed fields:
```
Submit correction to admin?
  Jersey #: 42 → 44
  Position: F → D
  Previous Team: U13 AA → U13 A
[Submit]  [Skip]
```
"Submit" creates a correction row for each changed field. "Skip" keeps the local annotations but doesn't submit corrections.

**Admin Mode:**
Same edit flow, but Save writes directly to `tryout_players` via `onAdminUpdate`. No correction popup. Admin can edit all fields including Position and Previous Team (same as today, but now behind the Edit button).

**Always-Editable Fields (both modes):**
- Heart toggle — tapping immediately toggles, no edit mode needed
- Notes textarea — always shown as editable, saves on blur (same as today)

#### `frontend/components/teams/teams-page-client.tsx`

1. Extend the `Annotations` type to include the new custom fields:
   ```
   type Annotations = Record<string, {
     isFavorite: boolean,
     notes: string | null,
     customName: string | null,
     customJersey: string | null,
     customPosition: string | null,
     customPreviousTeam: string | null,
     customTeam: string | null,
   }>
   ```

2. Add `handleSaveAnnotations` callback that calls `savePlayerAnnotations` and updates local state.

3. Pass extended annotation data to the detail sheet.

#### `frontend/components/teams/player-row.tsx`

Update to display custom annotation values when they exist:
- Show `customName` instead of `player.name` (already works)
- Show `customJersey` instead of `player.jersey_number` when set
- Show `customPosition` instead of `player.position` when set
- Visual indicator (e.g., slightly different text color or italic) when a custom value differs from the official value — so the parent can tell which values are their own overrides.

#### `frontend/components/continuations/continuation-player-row.tsx`
Same changes as player-row — display custom annotation values when present.

#### `frontend/components/continuations/continuations-page-client.tsx`
Extend the Annotations type and pass new fields through.

#### `frontend/components/dashboard/my-favourites-client.tsx`
Extend to handle new annotation fields.

### Styles

Add to `frontend/app/globals.css`:

- `.detail-sheet-view-row` — compact horizontal row for read-only field display
- `.detail-sheet-edit-btn` — pencil edit button in header
- `.detail-sheet-actions` — container for Save/Cancel buttons at bottom
- `.detail-sheet-save-btn` — primary gold Save button
- `.detail-sheet-cancel-btn` — secondary muted Cancel button
- `.detail-sheet-custom-value` — subtle visual indicator for custom annotation values (e.g., italic or different color) so parents can tell which values they've overridden
- Update `.detail-sheet-editable` / `.detail-sheet-readonly` to support the mode toggle

Extend the `.correction-popup-change` pattern to handle field labels beyond just "Name" and "Jersey #".

## Key Implementation Details

1. **Annotations type is used in many files.** Extract it to a shared location (e.g., `frontend/types/index.ts` or a new `frontend/types/annotations.ts`) to avoid duplicating the extended type definition across 10+ files. Currently it's defined inline in `teams-page-client.tsx`.

2. **`getPlayerAnnotations` is called from multiple page-level server components** (teams, continuations, my-players, dashboard). All must be updated to pass the new fields down.

3. **The correction field_name values must match column names on `tryout_players`** for the auto-apply trigger to work. The existing `apply_correction` trigger uses dynamic SQL: `EXECUTE format('UPDATE tryout_players SET %I = $1 ...', NEW.field_name)`. This means `position`, `previous_team` will work automatically. For `team`, the field_name should be `team` and the `reviewCorrection` server action must handle the team_id lookup manually (since the correction stores a team name string, not a UUID).

4. **Cancel discards silently.** No confirmation dialog — just reset all field values to what they were when the sheet opened and return to read-only mode.

5. **Edit mode is per-session.** Opening the detail sheet always starts in read-only mode. There's no persistence of edit mode state.

6. **Custom annotation display in player rows.** When a parent has custom values set, the player row should show those values. The implementing agent should check every place a player's jersey, name, position, or previous_team is displayed and ensure it checks for custom annotations first. The pattern: `customJersey ?? player.jersey_number`.

7. **The `onSubmitCorrection` callback in teams-page-client.tsx** already accepts a generic `fieldName` string. No signature change needed there.

8. **Jersey number duplicate check on correction approval** already exists in `reviewCorrection` for `jersey_number`. Similar validation should be added for `position` (validate it's one of F/D/G) and `team` (validate team exists).

## Acceptance Criteria

- [ ] All fields except Heart and Notes are read-only by default when opening the detail sheet
- [ ] Tapping the Edit button (pencil icon) makes Jersey, Name, Position, Previous Team, and Team editable
- [ ] Heart toggle works immediately in both modes (read-only and edit)
- [ ] Notes textarea is always editable and saves on blur
- [ ] Parent Save: stores custom values in `player_annotations`, then shows correction popup listing all changed fields
- [ ] Parent correction popup: Submit creates a correction row per changed field, Skip saves annotations only
- [ ] Admin Save: writes directly to `tryout_players`, no correction popup
- [ ] Cancel: discards all unsaved changes silently, returns to read-only mode
- [ ] New annotation columns (`custom_jersey`, `custom_position`, `custom_previous_team`, `custom_team`) exist in database
- [ ] Player rows display custom annotation values when set (jersey, name, position)
- [ ] Admin corrections review page can handle all new field types (position, previous_team, team)
- [ ] The `apply_correction` trigger works for `position` and `previous_team` fields
- [ ] Form fits on a single page without scrolling on standard phone screens (iPhone SE and larger)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow all safety rules from the spec template. Use the TEST sandbox association (`a2000000-0000-0000-0000-000000000002`) for any write operations.

**Setup:**
1. Log in as `testparent@test.com` / `testpass123`
2. Navigate to the Teams page for the active division
3. Ensure at least one player is visible

### Test 1: Default read-only view
1. Tap any player row to open the detail sheet
2. **Verify:** All fields (Jersey, Name, Position, Previous Team, Team/Status) are displayed as plain text (not inputs)
3. **Verify:** Heart toggle is visible and tappable
4. **Verify:** Notes textarea is visible and editable
5. **Verify:** An Edit button (pencil icon) is visible in the header
6. Close the sheet

### Test 2: Edit mode activation
1. Tap a player row to open the detail sheet
2. Tap the Edit button (pencil icon)
3. **Verify:** Jersey, Name, Position, Previous Team fields become editable inputs
4. **Verify:** Position shows F/D/G selector buttons
5. **Verify:** Save and Cancel buttons appear at the bottom
6. **Verify:** Heart and Notes remain interactive (unchanged)

### Test 3: Cancel discards changes
1. Open a player detail sheet, tap Edit
2. Change the Jersey number to "99"
3. Change the Name to "Test Cancel Name"
4. Tap Cancel
5. **Verify:** The sheet returns to read-only mode
6. **Verify:** Jersey and Name show their original values (not "99" or "Test Cancel Name")

### Test 4: Parent save with correction popup (TEST sandbox)
1. Switch to the TEST sandbox association
2. Open a player detail sheet, tap Edit
3. Change the Jersey number from its current value to a different number
4. Change the Position (e.g., F → D)
5. Tap Save
6. **Verify:** Correction popup appears listing both changes with field labels
7. **Verify:** Popup shows "Jersey #: [old] → [new]" and "Position: [old] → [new]"
8. Tap Skip (to avoid creating real corrections)
9. **Verify:** Sheet closes, custom values are visible on the player row

### Test 5: Parent save — Submit corrections (TEST sandbox)
1. Switch to TEST sandbox association
2. Open a player detail sheet, tap Edit
3. Change the Name to "Test Correction Name"
4. Tap Save
5. Tap Submit on the correction popup
6. **Verify:** Sheet closes
7. **Verify:** Custom name is displayed on the player row

### Test 6: Heart toggle in read-only mode
1. Open a player detail sheet (read-only mode, don't tap Edit)
2. Tap the Heart toggle
3. **Verify:** Heart state changes immediately
4. Close and reopen the same player
5. **Verify:** Heart state persisted

### Test 7: Notes save on blur
1. Open a player detail sheet
2. Type "Test note 024" in the Notes textarea
3. Tap somewhere else (blur the textarea)
4. Close and reopen the player detail
5. **Verify:** Note text "Test note 024" is preserved

### Test 8: Admin direct save (TEST sandbox)
1. Log in as `testadmin@test.com` / `TestAdmin1234`
2. Switch to TEST sandbox association
3. Open a player detail sheet, tap Edit
4. Change the Position (e.g., D → F)
5. Tap Save
6. **Verify:** No correction popup appears
7. **Verify:** Position is updated immediately on the player row
8. Revert: Open the player again, tap Edit, change Position back to original, Save

### Test 9: Admin delete button visible
1. As admin, open a player detail sheet
2. **Verify:** Trash/delete icon is visible in the header
3. Close without deleting

### Test 10: Form fits on screen
1. Open a player detail sheet on a 375px-wide viewport (iPhone SE)
2. **Verify:** All content is visible without scrolling
3. Tap Edit
4. **Verify:** All fields, Save, and Cancel buttons are visible without scrolling

### Test 11: Custom values display on player row
1. As parent, open a player detail (TEST sandbox), tap Edit
2. Change Jersey to "77"
3. Save (Skip corrections)
4. **Verify:** The player row shows "77" as the jersey number
5. Revert: Edit the player again, clear custom jersey (set back to original), Save

### Test 12: Corrections review handles new fields (admin)
1. As parent, submit a Position correction via the detail form (TEST sandbox)
2. Log in as admin
3. Navigate to Settings → Corrections
4. **Verify:** The pending correction shows "Position: [old] → [new]" with correct label
5. Approve or reject the correction

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 4 | Custom jersey + position annotation on TEST sandbox player | Clear via Edit → reset to original → Save |
| Test 5 | Custom name annotation + correction row on TEST sandbox | Clear custom name; correction can be reviewed/rejected by admin |
| Test 6 | Heart toggle on a player | Un-heart via detail sheet |
| Test 7 | Note "Test note 024" on a player | Clear note via detail sheet |
| Test 8 | Position changed on TEST sandbox player (admin) | Reverted in same test step |
| Test 11 | Custom jersey "77" on TEST sandbox player | Reverted in same test step |
| Test 12 | Position correction submitted | Approve/reject via admin |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

1. `backend/supabase/migrations/YYYYMMDDNNNNNN_add_custom_annotations.sql` — NEW: add custom_jersey, custom_position, custom_previous_team, custom_team columns
2. `frontend/types/index.ts` — extract shared `Annotations` type
3. `frontend/app/(app)/annotations/actions.ts` — extend `getPlayerAnnotations`, add `savePlayerAnnotations`, update `getMyPlayers`
4. `frontend/app/(app)/corrections/actions.ts` — extend `reviewCorrection` to handle position, previous_team, team
5. `frontend/components/teams/long-press-menu.tsx` — major rewrite: read-only/edit modes, Save/Cancel, extended correction flow
6. `frontend/components/teams/teams-page-client.tsx` — extend Annotations type, add `handleSaveAnnotations`, pass new props
7. `frontend/components/teams/player-row.tsx` — display custom annotation values
8. `frontend/components/continuations/continuations-page-client.tsx` — extend Annotations type
9. `frontend/components/continuations/continuation-player-row.tsx` — display custom annotation values
10. `frontend/components/continuations/round-section.tsx` — pass extended annotations
11. `frontend/components/teams/prediction-board.tsx` — pass extended annotations
12. `frontend/components/teams/previous-teams-view.tsx` — pass extended annotations
13. `frontend/components/teams/team-section.tsx` — pass extended annotations
14. `frontend/components/dashboard/my-favourites-client.tsx` — extend annotations handling
15. `frontend/app/globals.css` — new styles for read-only/edit modes, Save/Cancel buttons, custom value indicator
16. `frontend/app/(app)/settings/corrections/page.tsx` — update field label display for new correction types

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (un-heart players, restore names, delete test records, etc.). Confirm with the user that all test data has been cleaned up.
