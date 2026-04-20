# Spec 007: Admin Player CRUD & Continuations Linking

**PRD Reference:** FR-021, FR-022 (partial)
**Priority:** Must Have
**Depends on:** 006 (player detail sheet, corrections system)
**Implementation:** Two parts — implement Part A first, then Part B

## What This Feature Does

**Part A — Admin Player CRUD:** Admins can directly add, edit, and delete player records. When an admin opens the player detail sheet on the Teams page, changes to name, jersey number, and position save immediately to `tryout_players` (no correction queue). Admins can also add new players from the Settings page. Delete is a soft delete using the existing `deleted_at` pattern.

**Part B — Continuations Linking:** When a jersey number in Continuations shows as "Unknown" (no matching player record), users can long-press it to open a player picker. The picker shows all division players in a searchable list formatted like the Previous Teams view. Selecting a player changes their jersey number to the unknown number (parents submit a correction; admins change it directly). An "Add Player" button in the picker header lets users create a new player record. For parents, the new player is private (only they can see it) until submitted to and approved by an admin. Admins can edit the suggested player's details before approving.

## Current State

### Database

**`tryout_players`** — main player table with columns: `id`, `association_id`, `division`, `jersey_number`, `name`, `position` (F/D/G/?), `previous_team`, `status` (player_status enum), `team_id`, `deleted_at`, `created_at`, `updated_at`. RLS enforced via `user_belongs_to_association()`. Soft deletes via `deleted_at IS NULL` filter.

**`corrections`** — correction queue with columns: `id`, `association_id`, `player_id`, `user_id`, `field_name` (text: "name" or "jersey_number"), `old_value`, `new_value`, `status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`, `note`, `created_at`. RLS enforced.

**`player_annotations`** — per-user private data with columns: `id`, `user_id`, `player_id`, `is_favorite`, `custom_name`, `notes`, `created_at`, `updated_at`. Unique on `(user_id, player_id)`.

**`continuation_rounds`** — stores scraped continuation data with `jersey_numbers` text array. No FK to `tryout_players` — matching is by jersey number string lookup at runtime.

### Server Actions

**`frontend/app/(app)/corrections/actions.ts`:**
- `submitCorrection(playerId, fieldName, oldValue, newValue)` — inserts pending correction
- `getPendingCorrectionsCount(associationId)` — count for badge
- `getPendingCorrections(associationId)` — list with player details (joins tryout_players)
- `reviewCorrection(correctionId, action)` — approves/rejects; on approve updates `tryout_players.name` or `jersey_number` (with duplicate check for jersey)

**`frontend/app/(app)/annotations/actions.ts`:**
- `toggleFavorite(playerId)` — toggles `is_favorite`
- `saveCustomName(playerId, customName)` — upserts `custom_name`
- `savePlayerNote(playerId, note)` — upserts `notes`
- `getPlayerAnnotations(associationId)` — returns `Record<playerId, { isFavorite, notes, customName }>`

**`frontend/app/(app)/continuations/actions.ts`:**
- `getAllPublishedRounds(associationId, division)` — fetches published rounds
- `lockFinalTeam(roundId)` — matches jersey numbers to players via `WHERE jersey_number IN (...)`, updates `team_id` and `status = 'made_team'`
- Re-exports `toggleFavorite`, `savePlayerNote`, `getPlayerAnnotations` from annotations

### Components

**`frontend/components/teams/long-press-menu.tsx`** — Player detail sheet (redesigned in spec 006). Props: `player`, `isFavorite`, `customName`, `note`, `onClose`, `onToggleFavorite`, `onSaveName`, `onSaveNote`, `onSubmitCorrection`. Local state tracks `nameValue`, `jerseyValue`, `noteValue`, `showCorrectionPopup`, `pendingCorrections`. On close, compares edited name/jersey to `player.name`/`player.jersey_number` — if different, shows correction popup. Editable section: jersey input, heart toggle, name input, note textarea. Read-only section: position, previous team, made team status.

**`frontend/components/teams/player-row.tsx`** — Player row in Teams. Props: `player`, `isLocked`, `isFavorite`, `customName`, `hasNotes`, `onLongPress`, `onToggleFavorite`. Right-click triggers `onLongPress`. Shows jersey #, position badge, heart, name (with custom name indicator), notes icon (FileText), previous team badge.

**`frontend/components/teams/teams-page-client.tsx`** — Teams page client. Manages `annotations` state, `selectedPlayer` for detail sheet, view toggle (predictions/previous), position filter, order state. Callbacks: `handleToggleFavorite`, `handleSaveName`, `handleSaveNote`, `handleSubmitCorrection`. Renders `PredictionBoard` or `PreviousTeamsView` plus `LongPressMenu` overlay.

**`frontend/components/continuations/continuation-player-row.tsx`** — Continuations player row. Props: `jerseyNumber`, `player` (TryoutPlayer | null), `isFavorite`, `hasNotes`, `isInjured`, `isCut`, `onToggleFavorite`. Shows "Unknown" when `player === null`. No long-press handler currently.

**`frontend/components/continuations/continuations-page-client.tsx`** — Builds `playerMap: Record<string, TryoutPlayer>` keyed by jersey number. Passes playerMap to `RoundSection`. Manages annotations state and round selection.

**`frontend/components/continuations/round-section.tsx`** — Renders continuing players per session and cuts. Uses `playerMap[jerseyNumber]` lookup — returns null for unknown players. Sorts by position group then blended team rank.

**`frontend/components/settings/settings-page-client.tsx`** — Settings client. Props: `email`, `initials`, `role`, `associationName`, `associationId`, `pendingCorrectionsCount`. Admin section shows Corrections link (with badge) and Scrape Continuations link.

**`frontend/components/settings/corrections-list.tsx`** — Admin corrections review. Props: `initialCorrections: CorrectionRow[]`. Renders each correction with player info, old/new values, approve/reject buttons. Calls `reviewCorrection` on button click, removes row on success.

### Pages

**`frontend/app/(app)/teams/page.tsx`** — Fetches players, teams, saved orders, annotations. Passes role info. Queries `tryout_players` with `.is("deleted_at", null)`.

**`frontend/app/(app)/continuations/page.tsx`** — Fetches players for active division, published rounds, annotations. Builds and passes data to `ContinuationsPageClient`.

**`frontend/app/(app)/settings/page.tsx`** — Fetches pending corrections count for admins, passes to `SettingsPageClient`.

**`frontend/app/(app)/settings/corrections/page.tsx`** — Admin corrections list page. Fetches pending corrections, renders `CorrectionsList`.

### Styles (in `frontend/app/globals.css`)

Existing classes: `.detail-sheet`, `.detail-sheet-overlay`, `.detail-sheet-handle`, `.detail-sheet-header`, `.detail-sheet-editable`, `.detail-sheet-readonly`, `.detail-sheet-field`, `.detail-sheet-field-label`, `.detail-sheet-input`, `.detail-sheet-textarea`, `.detail-sheet-heart`, `.detail-sheet-value`, `.correction-popup`, `.correction-popup-actions`, `.avatar-badge`, `.corrections-list`, `.corrections-row`, `.corrections-actions`, `.continuation-player-row`, `.continuations-session-players`.

## Changes Required

### Database (shared — implement in Part A)

**New migration: add `suggested_by` column to `tryout_players`**

Add column `suggested_by uuid REFERENCES auth.users(id) DEFAULT NULL` to `tryout_players`. When NULL, the player is a normal record visible to all association members. When set, the player was suggested by that user and is only visible to them and admins until approved.

**Update RLS policy on `tryout_players` SELECT:**

Current policy allows all association members to see all players. New policy:
- Normal players (`suggested_by IS NULL`): visible to all association members (unchanged)
- Suggested players (`suggested_by IS NOT NULL`): visible only to the user who suggested them (`suggested_by = auth.uid()`) OR to admins (`user_is_admin(association_id)`)

Combined: `(suggested_by IS NULL AND user_belongs_to_association(association_id)) OR (suggested_by = auth.uid()) OR (user_is_admin(association_id))`

**No schema changes to `corrections` table.** The `field_name` column is text, so `'add_player'` works as a new value alongside `'name'` and `'jersey_number'`.

---

### Part A: Admin Player CRUD

#### Server Actions

**Create `frontend/app/(app)/players/actions.ts`:**

- `adminUpdatePlayer(playerId: string, updates: { name?: string, jersey_number?: string, position?: string }): Promise<{ error?: string }>` — Updates `tryout_players` fields directly. Checks that the current user is group_admin or admin for the player's association. If `jersey_number` is being changed, checks for duplicates in the same association + division. Returns error if duplicate found or unauthorized.

- `adminDeletePlayer(playerId: string): Promise<{ error?: string }>` — Soft-deletes by setting `deleted_at = now()`. Checks admin role. Returns error if unauthorized.

- `adminCreatePlayer(data: { association_id: string, division: string, jersey_number: string, name: string, position: string, previous_team?: string }): Promise<{ error?: string, playerId?: string }>` — Inserts a new `tryout_players` record with `status = 'registered'` and `suggested_by = NULL` (admin-created players are immediately real). Checks admin role and jersey number uniqueness.

#### Pages

**Create `frontend/app/(app)/settings/add-player/page.tsx`:**

Admin-only page for adding a new player. Server component that checks admin role, fetches the user's active division and available divisions for the association. Renders an `AddPlayerForm` client component.

#### Components

**Modify `frontend/components/teams/long-press-menu.tsx`** — Add admin mode:

New props:
- `isAdmin?: boolean` — enables admin editing mode
- `onAdminUpdate?: (updates: { name?: string, jersey_number?: string, position?: string }) => void` — direct save callback
- `onDelete?: () => void` — soft delete callback

When `isAdmin === true`:
- Position field becomes an editable selector (F / D / G buttons or dropdown) instead of read-only text
- On close: collect all changed fields (name, jersey_number, position) compared to original `player.*` values. If any changed, call `onAdminUpdate` with the diff. No correction popup.
- Name changes save to `tryout_players.name` via `onAdminUpdate`, NOT to `player_annotations.custom_name`. The admin is editing the official record.
- Note and heart still save to annotations (personal to the admin, same as parents)
- Show a delete button (Trash2 icon) in the header or footer. On click, show a confirmation: "Delete #[jersey] [name]?" with Delete and Cancel buttons. On confirm, call `onDelete`.

When `isAdmin === false` (default): existing behavior unchanged.

**Modify `frontend/components/teams/teams-page-client.tsx`** — Wire admin callbacks:

New prop or derived state:
- `role: string` — user's role, passed from the page server component

New callbacks:
- `handleAdminUpdate(playerId, updates)` — calls `adminUpdatePlayer` server action. On success, updates local player data (or triggers `router.refresh()`).
- `handleDelete(playerId)` — calls `adminDeletePlayer` server action. On success, removes player from local state (or triggers `router.refresh()`). Closes the detail sheet.

Pass `isAdmin={role === "group_admin" || role === "admin"}` to the detail sheet along with `onAdminUpdate` and `onDelete`.

**Modify `frontend/app/(app)/teams/page.tsx`** — Pass `role` to the client component. Filter out suggested players: add `.is("suggested_by", null)` to the tryout_players query so the Teams page never shows suggested players.

**Create `frontend/components/settings/add-player-form.tsx`:**

Client component for the Settings add player page. Form fields:
- Division — dropdown populated from available divisions, defaults to active division
- Jersey Number — text input (required)
- Name — text input (required)
- Position — selector: F / D / G (required)
- Previous Team — text input (optional)
- Submit button

On submit: calls `adminCreatePlayer` server action. On success, shows a success message or navigates back to settings. On error (e.g., duplicate jersey number), shows inline error.

**Modify `frontend/components/settings/settings-page-client.tsx`:**

Add "Add Player" link in the admin section, alongside the existing Corrections and Scrape Continuations links. Use a `UserPlus` icon from Lucide. Links to `/settings/add-player`.

#### Styles

Add to `frontend/app/globals.css`:

- `.detail-sheet-position-selector` — button group for F/D/G position selection in admin mode
- `.detail-sheet-position-btn` — individual position button
- `.detail-sheet-position-btn-active` — selected position state
- `.detail-sheet-delete-btn` — delete button in detail sheet (cinnabar/red styling)
- `.detail-sheet-delete-confirm` — delete confirmation overlay
- `.add-player-page` — settings add player page container
- `.add-player-form` — form styling
- `.add-player-field` — form field rows
- `.add-player-submit` — submit button (gold styling, matching existing action buttons)
- `.add-player-error` — inline error message

---

### Part B: Continuations Linking

#### Server Actions

**Add to `frontend/app/(app)/continuations/actions.ts`:**

- `linkUnknownPlayer(selectedPlayerId: string, newJerseyNumber: string): Promise<{ error?: string }>` — Admin-only action. Updates the selected player's `jersey_number` to `newJerseyNumber`. Checks for duplicates. Checks admin role.

- `suggestPlayerLink(selectedPlayerId: string, newJerseyNumber: string): Promise<{ error?: string }>` — Parent action. Creates a correction with `field_name = 'jersey_number'`, `old_value = player's current jersey_number`, `new_value = newJerseyNumber`. Uses existing `submitCorrection` under the hood.

- `createSuggestedPlayer(data: { association_id: string, division: string, jersey_number: string, name: string, position: string }): Promise<{ error?: string, playerId?: string }>` — Parent action. Creates a `tryout_players` record with `suggested_by = auth.uid()` and `status = 'registered'`. The player is only visible to this user via RLS.

- `submitSuggestedPlayer(playerId: string): Promise<{ error?: string }>` — Parent action. Creates a correction with `field_name = 'add_player'`, `player_id = playerId`, `old_value = null`, `new_value = 'suggested'`. This puts the suggested player into the admin review queue.

**Add to `frontend/app/(app)/corrections/actions.ts`:**

- `reviewSuggestedPlayer(correctionId: string, action: "approved" | "rejected", updates?: { name?: string, jersey_number?: string, position?: string }): Promise<{ error?: string }>` — Admin action. If approved: applies any `updates` to the player record, then sets `suggested_by = NULL` (making the player visible to everyone). If rejected: soft-deletes the player (`deleted_at = now()`) and marks the correction as rejected. The `updates` parameter allows the admin to edit the player's details before approving.

Modify `getPendingCorrections` to handle the `'add_player'` field_name — include the full player record (name, jersey, position, division) in the returned data so the corrections list can display it.

#### Pages

No new pages needed. The continuations page (`/continuations`) gains the picker interaction. The corrections page (`/settings/corrections`) gains the ability to review `add_player` corrections.

#### Components

**Create `frontend/components/continuations/player-picker.tsx`:**

Bottom sheet component for linking an unknown jersey number to a player.

Props:
```
jerseyNumber: string
players: TryoutPlayer[]
isAdmin: boolean
onLinkPlayer: (playerId: string) => void
onAddPlayer: () => void
onClose: () => void
```

Layout:
- Overlay backdrop (reuse `.detail-sheet-overlay` pattern)
- Bottom sheet container
- **Header:** "Link #[jerseyNumber]" title + "Add Player" button (UserPlus icon)
- **Search input:** filters the player list by name or jersey number as the user types
- **Player list:** scrollable, formatted like Previous Teams view:
  - Grouped by `previous_team` (alphabetical), with spacing between groups
  - Each row: position badge, jersey #, player name, previous team badge
  - Tapping a row calls `onLinkPlayer(player.id)`
  - Empty search results: "No players found"

When `onLinkPlayer` is called, show a confirmation: "Change [Player Name]'s number from #[current] to #[jerseyNumber]?" with Confirm and Cancel buttons.

When "Add Player" is clicked, call `onAddPlayer` which closes the picker and opens the add player sheet.

**Create `frontend/components/continuations/add-player-sheet.tsx`:**

Bottom sheet for creating a new player from the continuations context.

Props:
```
jerseyNumber: string
division: string
associationId: string
isAdmin: boolean
onSave: (playerId: string) => void
onClose: () => void
```

Layout (reuses `.detail-sheet` styling):
- Handle + header: "Add Player"
- Jersey Number input (pre-filled with `jerseyNumber`, editable)
- Name input (empty, required)
- Position selector (F / D / G buttons)
- Save button

On save:
- **Admin:** calls `adminCreatePlayer` → player created with `suggested_by = NULL`, immediately visible to all. Calls `onSave`, which triggers page refresh.
- **Parent:** calls `createSuggestedPlayer` → player created with `suggested_by = user_id`. Then shows popup: "Submit new player to admin for review?" Submit calls `submitSuggestedPlayer`, Skip skips. Either way, calls `onSave` which triggers page refresh. The parent now sees the resolved player name instead of "Unknown" in continuations.

**Modify `frontend/components/continuations/continuation-player-row.tsx`:**

New prop:
- `onLinkUnknown?: () => void` — long-press/right-click handler for Unknown players

When `player === null` (Unknown) and `onLinkUnknown` is provided:
- Add right-click / long-press handler that calls `onLinkUnknown()`
- Add a visual hint that the Unknown row is interactive (e.g., subtle dashed underline on "Unknown" text, or a small link icon)

When `player !== null`: no change to existing behavior.

**Modify `frontend/components/continuations/round-section.tsx`:**

Thread the `onLinkUnknown` handler through to `ContinuationPlayerRow` for Unknown players. Pass the `jerseyNumber` so the parent component knows which number was long-pressed.

New prop:
- `onLinkUnknown?: (jerseyNumber: string) => void`

**Modify `frontend/components/continuations/continuations-page-client.tsx`:**

New state:
- `linkingJerseyNumber: string | null` — the jersey number being linked (opens picker when set)
- `addingPlayer: { jerseyNumber: string } | null` — opens add player sheet when set

New callbacks:
- `handleLinkUnknown(jerseyNumber)` — sets `linkingJerseyNumber`, opens picker
- `handleLinkPlayer(playerId)` — calls `linkUnknownPlayer` (admin) or `suggestPlayerLink` (parent), then `router.refresh()`
- `handleAddPlayer()` — transitions from picker to add player sheet (sets `addingPlayer`, clears `linkingJerseyNumber`)
- `handlePlayerSaved()` — closes add player sheet, calls `router.refresh()`

New prop needed:
- `isAdmin: boolean` — passed from page server component
- `associationId: string` — already exists

Pass `onLinkUnknown` through to `RoundSection` and on to `ContinuationPlayerRow`.

Render `PlayerPicker` when `linkingJerseyNumber` is set. Render `AddPlayerSheet` when `addingPlayer` is set.

**Modify `frontend/app/(app)/continuations/page.tsx`:**

Pass `isAdmin` boolean to `ContinuationsPageClient` (derived from role check, same pattern as Teams page).

**Modify `frontend/components/settings/corrections-list.tsx`:**

Handle `field_name === 'add_player'` corrections differently from name/jersey corrections:

For `add_player` corrections, each row shows:
- "New Player" label (instead of "Name" or "Jersey #")
- Full player info: jersey number, name, position, division
- Submitted by + date
- "Review" button (instead of direct Approve) — opens an inline editable form or expands the row to show editable fields (name, jersey number, position)
- After editing (or leaving as-is), "Approve" and "Reject" buttons
- Approve calls `reviewSuggestedPlayer` with any edits
- Reject calls `reviewSuggestedPlayer` with action = "rejected"

For existing `name` and `jersey_number` corrections: no change to current behavior.

#### Styles

Add to `frontend/app/globals.css`:

- `.player-picker` — bottom sheet container for the picker
- `.player-picker-header` — header with title and Add Player button
- `.player-picker-search` — search input styling
- `.player-picker-list` — scrollable player list container
- `.player-picker-group` — previous team group with spacing
- `.player-picker-row` — individual player row (tappable)
- `.player-picker-row-active` — tap/hover state
- `.player-picker-empty` — "No players found" empty state
- `.player-picker-confirm` — confirmation overlay for link action
- `.add-player-sheet` — add player bottom sheet (extends `.detail-sheet` pattern)
- `.unknown-interactive` — visual hint on Unknown rows (subtle dashed underline or link icon)
- `.corrections-add-player` — styling for add_player correction rows in admin list
- `.corrections-edit-fields` — inline editable fields for admin review of suggested players

## Key Implementation Details

1. **Admin detail sheet is the same component, not a fork.** `long-press-menu.tsx` gains an `isAdmin` prop that toggles behavior. When admin: position is editable, changes save directly via `onAdminUpdate`, no correction popup, delete button visible. When not admin: existing behavior unchanged.

2. **Admin name edits go to `tryout_players.name`, not `player_annotations.custom_name`.** This is the key difference. Parents save names privately to annotations; admins save to the official record. The detail sheet must use different save paths based on `isAdmin`.

3. **Notes and hearts are always personal.** Even for admins, notes save to `player_annotations.notes` and hearts save to `player_annotations.is_favorite`. These are per-user, not official data.

4. **Teams page filters out suggested players.** The query in `teams/page.tsx` must add `.is("suggested_by", null)` so suggested players never appear on the Teams page (not even for the parent who suggested them). Suggested players only resolve "Unknown" entries on the Continuations page.

5. **Continuations page includes suggested players via RLS.** The existing query fetches all players for the division. With the updated RLS policy, a parent's suggested players are automatically included in the results. The `playerMap` built from jersey numbers will then resolve previously-Unknown entries for that parent. No query changes needed on the continuations page.

6. **Picker list format matches Previous Teams.** Group players by `previous_team` (alphabetical). Within each group, sort by position (F, D, G) then jersey number. Show position badge, jersey number, name, and previous team badge on each row. Use the same spacing pattern (gap between groups, no group headers).

7. **Duplicate jersey number checks.** Both `adminUpdatePlayer` and `linkUnknownPlayer` must check that the new jersey number doesn't already exist for a different player in the same association + division (excluding soft-deleted players). The existing pattern in `reviewCorrection` does this — follow that same approach.

8. **`add_player` correction lifecycle:**
   - Parent creates suggested player → `tryout_players` record with `suggested_by = user_id`
   - Parent submits for review → `corrections` record with `field_name = 'add_player'`
   - Admin reviews → can edit name/jersey/position before approving
   - Approve → updates player fields + sets `suggested_by = NULL`
   - Reject → soft-deletes the player + marks correction rejected

9. **Parent can skip submission.** If a parent creates a suggested player and clicks "Skip" on the submission popup, the player record exists with `suggested_by` set but no correction is created. The parent sees the resolved name in continuations. The admin never sees it. The player remains private indefinitely. This is fine — the parent can re-open the player later if they want to submit.

10. **Optimistic updates vs router.refresh().** For link and add operations, use `router.refresh()` after the server action completes. These are infrequent actions (unlike drag-and-drop which needs optimistic updates). The page re-fetches data from the server, rebuilds the playerMap, and the UI updates to show the resolved player.

11. **Admin add player from settings vs continuations.** Both create real players (no `suggested_by`). The settings page form is a standalone page. The continuations add player sheet is a bottom sheet with jersey number pre-filled from the Unknown row. Both call `adminCreatePlayer` under the hood.

12. **Position selector in admin mode.** Use three buttons (F / D / G) styled like the existing position filter chips. The active position is highlighted. Tapping a different position changes the selection. This is simpler than a dropdown and matches the app's existing UI language.

## Acceptance Criteria

### Part A: Admin Player CRUD

- [ ] Admin long-press on Teams page opens detail sheet with direct edit (no correction popup)
- [ ] Admin can edit player name — saves to `tryout_players.name` immediately
- [ ] Admin can edit jersey number — saves to `tryout_players.jersey_number` immediately
- [ ] Admin can edit position (F/D/G selector) — saves to `tryout_players.position` immediately
- [ ] Jersey number edit checks for duplicates in same division — shows error if conflict
- [ ] Admin notes and hearts still save to personal annotations (not official data)
- [ ] Delete button appears in admin detail sheet
- [ ] Delete shows confirmation before soft-deleting
- [ ] Deleted player disappears from Teams page
- [ ] Settings page has "Add Player" link in admin section
- [ ] Add Player page has form with division, jersey number, name, position fields
- [ ] Adding a player creates a real `tryout_players` record (no `suggested_by`)
- [ ] Duplicate jersey number on add shows inline error
- [ ] Parent detail sheet behavior is unchanged (corrections popup, annotation saves)
- [ ] Suggested players (`suggested_by IS NOT NULL`) do not appear on Teams page
- [ ] Database migration adds `suggested_by` column
- [ ] RLS policy updated to handle `suggested_by` visibility
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

### Part B: Continuations Linking

- [ ] Unknown player rows in Continuations are visually interactive (hint styling)
- [ ] Long-press on Unknown opens player picker bottom sheet
- [ ] Picker header shows "Link #[number]" and "Add Player" button
- [ ] Picker has a search input that filters by name or jersey number
- [ ] Picker list is grouped by previous team with spacing (like Previous Teams)
- [ ] Tapping a player in the picker shows a confirmation dialog
- [ ] Admin: confirming the link immediately changes the player's jersey number
- [ ] Parent: confirming the link creates a pending correction
- [ ] After linking, the continuations page refreshes and shows the resolved player name
- [ ] "Add Player" in picker opens the add player bottom sheet with jersey number pre-filled
- [ ] Admin: add player creates a real record visible to everyone
- [ ] Parent: add player creates a `suggested_by` record visible only to them
- [ ] Parent: after creating, popup asks "Submit to admin for review?"
- [ ] Parent: submitting creates an `add_player` correction
- [ ] Parent: skipping keeps the player private (no correction)
- [ ] After adding, the continuations page refreshes and shows the resolved player
- [ ] Admin corrections list handles `add_player` corrections
- [ ] Admin can edit suggested player details before approving
- [ ] Approving clears `suggested_by` — player becomes visible to everyone
- [ ] Rejecting soft-deletes the suggested player
- [ ] Known players in Continuations are unaffected (no new long-press behavior)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

### Part A Setup

Start dev server (`cd frontend && npm run dev`). Have two browser contexts available: one logged in as admin (`testadmin@test.com` / `TestAdmin1234`), one as parent (`testparent@test.com` / `testpass123`).

### Test A1: Admin detail sheet — direct name edit
1. Log in as admin
2. Navigate to `/teams`
3. Long-press (right-click) any player row
4. **Verify:** Detail sheet opens with editable fields
5. Change the name field to "Admin Edited Name"
6. Close the sheet
7. **Verify:** No correction popup appears
8. **Verify:** The player row shows "Admin Edited Name" as the official name (not as a custom name annotation)
9. Reload the page
10. **Verify:** "Admin Edited Name" persists

### Test A2: Admin detail sheet — direct jersey number edit
1. Open the detail sheet for a player (note their current number, e.g., #10)
2. Change the jersey number to a number not used by another player
3. Close the sheet
4. **Verify:** No correction popup appears
5. **Verify:** The player row shows the new jersey number
6. Reload the page
7. **Verify:** New jersey number persists

### Test A3: Admin jersey number — duplicate check
1. Open the detail sheet for a player
2. Change the jersey number to a number that already belongs to a different player in the same division
3. Close the sheet
4. **Verify:** Error message appears indicating the jersey number is already in use
5. **Verify:** The player's jersey number is unchanged

### Test A4: Admin detail sheet — position edit
1. Open the detail sheet for a player (note their current position)
2. **Verify:** Position field shows F/D/G buttons (not read-only text)
3. Tap a different position button
4. Close the sheet
5. **Verify:** The player row shows the new position badge
6. Reload the page
7. **Verify:** New position persists

### Test A5: Admin delete player
1. Open the detail sheet for a player (note their jersey number and name)
2. Click the delete button
3. **Verify:** Confirmation dialog appears: "Delete #[jersey] [name]?"
4. Click "Delete" to confirm
5. **Verify:** Detail sheet closes
6. **Verify:** The player no longer appears on the Teams page
7. Reload the page
8. **Verify:** Player is still gone

### Test A6: Admin notes and hearts are personal
1. As admin, open a player's detail sheet
2. Add a note "Admin's private note"
3. Toggle the heart
4. Close the sheet
5. Log out and log in as parent
6. Navigate to `/teams`, find the same player
7. **Verify:** No heart is filled (admin's heart is not visible to parent)
8. Long-press the player
9. **Verify:** No note appears in the note field (admin's note is not visible)

### Test A7: Parent detail sheet unchanged
1. Log in as parent
2. Navigate to `/teams`
3. Long-press a player
4. Change the name
5. Close the sheet
6. **Verify:** Correction popup appears (existing behavior preserved)
7. Click "Skip"
8. **Verify:** Custom name saved as annotation

### Test A8: Settings — Add Player link (admin)
1. Log in as admin
2. Navigate to `/settings`
3. **Verify:** Admin section shows "Add Player" link with icon
4. Click "Add Player"
5. **Verify:** Navigates to `/settings/add-player`

### Test A9: Settings — Add Player form
1. On `/settings/add-player`:
2. **Verify:** Form shows division dropdown, jersey number, name, position, and previous team fields
3. Fill in: jersey number "999", name "Test New Player", position "F"
4. Submit the form
5. **Verify:** Success feedback (message or redirect)
6. Navigate to `/teams`
7. **Verify:** "Test New Player" (#999) appears in the player list

### Test A10: Add Player — duplicate jersey number
1. Navigate to `/settings/add-player`
2. Enter a jersey number that already exists in the active division
3. Submit the form
4. **Verify:** Inline error message about duplicate jersey number
5. **Verify:** No player was created

### Test A11: Settings — Add Player not visible to parents
1. Log in as parent
2. Navigate to `/settings`
3. **Verify:** No "Add Player" link in the settings page (admin section not visible or link absent)

### Test A12: Suggested players not on Teams page
1. (After Part B is implemented, or manually insert a tryout_players record with `suggested_by` set)
2. Log in as admin
3. Navigate to `/teams`
4. **Verify:** No suggested players appear in the prediction board or previous teams view

### Part B Setup

Start dev server. Ensure there are published continuation rounds for the active division that include jersey numbers NOT matching any player in `tryout_players` (i.e., "Unknown" players exist on the Continuations page). Have admin and parent browser contexts ready.

### Test B1: Unknown player visual hint
1. Log in as parent
2. Navigate to `/continuations`
3. **Verify:** Unknown player rows have a visual indicator that they are interactive (dashed underline, link icon, or similar)
4. **Verify:** Known player rows do NOT have this indicator

### Test B2: Long-press Unknown opens picker
1. Long-press (right-click) an Unknown player row
2. **Verify:** Player picker bottom sheet opens
3. **Verify:** Header shows "Link #[jersey number]" and an "Add Player" button
4. **Verify:** Search input is visible
5. **Verify:** Player list is displayed, grouped by previous team with spacing between groups

### Test B3: Picker search filter
1. With the picker open, type a player's name in the search input
2. **Verify:** List filters to show only matching players
3. Clear the search and type a jersey number
4. **Verify:** List filters to show the matching player
5. Type something with no matches
6. **Verify:** "No players found" message shown

### Test B4: Parent links Unknown to existing player
1. As parent, long-press an Unknown player
2. Select an existing player from the picker list
3. **Verify:** Confirmation dialog: "Change [Name]'s number from #[old] to #[new]?"
4. Click "Confirm"
5. **Verify:** Picker closes
6. **Verify:** The continuations page refreshes — the previously-Unknown row now shows the player's name
7. Navigate to `/settings` (as admin in another context)
8. Navigate to `/settings/corrections`
9. **Verify:** A pending correction exists: "Jersey # [old] → [new]" for that player

### Test B5: Admin links Unknown to existing player (immediate)
1. Log in as admin
2. Navigate to `/continuations`
3. Long-press an Unknown player
4. Select an existing player from the picker
5. Confirm the action
6. **Verify:** The continuations page refreshes — the Unknown row now shows the player's name
7. **Verify:** No correction was created (admin change is immediate)
8. Navigate to `/teams`
9. **Verify:** The player's jersey number has been updated

### Test B6: Parent adds new player from picker
1. As parent, long-press an Unknown player
2. Click "Add Player" in the picker header
3. **Verify:** Add player bottom sheet opens with jersey number pre-filled
4. Enter name "New Suggested Player" and select position "D"
5. Save
6. **Verify:** Popup appears: "Submit new player to admin for review?"
7. Click "Submit"
8. **Verify:** Continuations page refreshes — the Unknown row now shows "New Suggested Player"

### Test B7: Suggested player is private to parent
1. (Continuing from Test B6)
2. Log out and log in as a different parent (`testparent2@test.com`)
3. Navigate to `/continuations`
4. **Verify:** The same jersey number still shows as "Unknown" (the suggested player is not visible to other parents)

### Test B8: Parent skips submission
1. As parent, long-press a different Unknown player
2. Click "Add Player", fill in details, save
3. **Verify:** Popup appears: "Submit new player to admin for review?"
4. Click "Skip"
5. **Verify:** The continuations page refreshes — the Unknown row shows the entered name (private to this parent)
6. Log in as admin, navigate to `/settings/corrections`
7. **Verify:** No `add_player` correction exists for this player

### Test B9: Admin adds new player from continuations
1. As admin, long-press an Unknown player in continuations
2. Click "Add Player"
3. Fill in name "Admin Added Player" and position "G"
4. Save
5. **Verify:** No submission popup (admin-created players are immediately real)
6. **Verify:** Continuations page refreshes — the Unknown row shows "Admin Added Player"
7. Log in as parent
8. Navigate to `/continuations`
9. **Verify:** The same player now shows "Admin Added Player" (visible to everyone)

### Test B10: Admin reviews add_player correction
1. (From Test B6, a parent submitted a suggested player)
2. Log in as admin
3. Navigate to `/settings/corrections`
4. **Verify:** An `add_player` correction row exists showing the suggested player's details
5. Click "Review"
6. **Verify:** Editable fields appear (name, jersey number, position)
7. Change the name to "Admin Corrected Name"
8. Click "Approve"
9. **Verify:** The correction row disappears
10. Navigate to `/continuations`
11. **Verify:** The player now shows "Admin Corrected Name" (visible to everyone)

### Test B11: Admin rejects add_player correction
1. Have a parent submit another suggested player
2. As admin, navigate to `/settings/corrections`
3. Click "Reject" on the add_player correction
4. **Verify:** The correction row disappears
5. Log in as the parent who suggested it
6. Navigate to `/continuations`
7. **Verify:** The jersey number reverts to "Unknown" (the suggested player was deleted)

### Test B12: Known players unaffected in continuations
1. Navigate to `/continuations`
2. Long-press (right-click) a known player row (one that has a name, not Unknown)
3. **Verify:** No picker opens. The long-press either does nothing or triggers the existing favorite behavior (no new interaction).

### Test B13: Picker close without action
1. Long-press an Unknown player to open the picker
2. Click the overlay / backdrop area
3. **Verify:** Picker closes without any changes
4. **Verify:** The Unknown row is unchanged

### Test B14: Link then verify on Teams page
1. As admin, link an Unknown continuations player to an existing player (changing their jersey number)
2. Navigate to `/teams`
3. **Verify:** The player appears with their new jersey number on the Teams page

## Files to Touch

### Part A

**New files:**
1. `backend/supabase/migrations/[timestamp]_add_suggested_by_to_players.sql` — migration for `suggested_by` column + RLS update
2. `frontend/app/(app)/players/actions.ts` — admin player server actions (update, delete, create)
3. `frontend/app/(app)/settings/add-player/page.tsx` — admin add player page
4. `frontend/components/settings/add-player-form.tsx` — add player form component

**Modified files:**
5. `frontend/components/teams/long-press-menu.tsx` — add admin mode (isAdmin, position editor, delete, direct save)
6. `frontend/components/teams/teams-page-client.tsx` — wire admin callbacks, accept role prop
7. `frontend/app/(app)/teams/page.tsx` — pass role, filter out suggested players
8. `frontend/components/settings/settings-page-client.tsx` — add "Add Player" link in admin section
9. `frontend/app/globals.css` — position selector, delete button, add player form styles
10. `frontend/types/database.ts` — regenerate after migration (adds `suggested_by` to tryout_players type)

### Part B

**New files:**
11. `frontend/components/continuations/player-picker.tsx` — player picker bottom sheet
12. `frontend/components/continuations/add-player-sheet.tsx` — add player bottom sheet for continuations

**Modified files:**
13. `frontend/components/continuations/continuation-player-row.tsx` — add `onLinkUnknown` prop and visual hint for Unknown rows
14. `frontend/components/continuations/round-section.tsx` — thread `onLinkUnknown` to player rows
15. `frontend/components/continuations/continuations-page-client.tsx` — add picker/add state, link/add callbacks, accept isAdmin prop
16. `frontend/app/(app)/continuations/page.tsx` — pass isAdmin to client component
17. `frontend/app/(app)/continuations/actions.ts` — add link/suggest/create server actions
18. `frontend/app/(app)/corrections/actions.ts` — add `reviewSuggestedPlayer`, update `getPendingCorrections` for add_player type
19. `frontend/components/settings/corrections-list.tsx` — handle add_player corrections with editable review
20. `frontend/app/globals.css` — picker styles, unknown interactive hint, corrections add_player styles

## Implementation Checklist

### Part A

After implementing Part A, complete these steps in order:

1. **Migration:** Run `cd backend && supabase db push` to apply the `suggested_by` migration.
2. **Regenerate types:** Run `cd backend && supabase gen types typescript --local > ../frontend/types/database.ts`.
3. **Build:** Run `cd frontend && npm run build` — fix any errors.
4. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
5. **Start dev server:** Run `cd frontend && npm run dev`.
6. **Run Playwright tests A1–A12.** Follow each test's steps exactly and verify each expected result using browser snapshots. Fix any failures and re-run.

### Part B

After implementing Part B (with Part A already complete):

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev`.
4. **Run Playwright tests B1–B14.** Follow each test's steps exactly and verify each expected result using browser snapshots. Fix any failures and re-run.
5. **Re-run Part A tests A1–A12** to verify no regressions.
