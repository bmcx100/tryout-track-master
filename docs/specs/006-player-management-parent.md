# Spec 006: Player Management (Parent) — v2

**PRD Reference:** FR-021 (partial), FR-025 (corrections), custom features
**Priority:** Must Have
**Depends on:** None (specs 001–005 already implemented)

## What This Feature Does

Parents can privately track and annotate players across the Teams page:

1. **Hearting players** — Inline heart icon on every player row to bookmark them. Already implemented.
2. **Custom names** — Privately label a jersey number with a name (e.g., "#7 is Johnny Smith"). Already implemented via the long-press menu.
3. **Private notes** — Add free-text notes to any player via a redesigned player detail sheet. Note icon appears on the player row when a note exists.
4. **Player detail sheet** — Long-press opens a full detail bottom sheet (replaces the old action menu). Shows all player info with editable fields (jersey #, heart, name, note) and read-only fields (position, previous team, made team status).
5. **Correction submission** — When a parent edits a name or jersey number, closing the detail sheet prompts "Submit correction to admin?" The parent opts in explicitly. Creates a record in the `corrections` table.
6. **My Players page** — Dashboard card links to a page listing all tracked players, grouped by division then visually spaced by previous team.
7. **Admin corrections badge** — Admins see a badge indicator on their profile avatar when pending corrections exist. The Settings page has a "Corrections" card linking to a review list where admins approve or reject name/number corrections.

All annotations (hearts, names, notes) are private per-user. Corrections are visible to admins only after the parent explicitly submits them.

## Current State

### Already implemented (from previous session)

**Database:**
- `player_annotations` table with columns: `id`, `user_id`, `player_id`, `is_favorite`, `notes`, `custom_name`, `created_at`, `updated_at`. RLS enforces per-user isolation.
- `corrections` table with columns: `id`, `player_id`, `user_id`, `association_id`, `field_name`, `old_value`, `new_value`, `note`, `status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`, `created_at`. RLS exists. **No UI built yet.**
- Migration `20260420000003` added `custom_name` to `player_annotations`.

**Server actions (`frontend/app/(app)/annotations/actions.ts`):**
- `toggleFavorite(playerId)` — toggles `is_favorite`
- `saveCustomName(playerId, customName)` — upserts `custom_name`
- `getPlayerAnnotations(associationId)` — fetches all annotations for current user
- `getMyPlayers(associationId)` — fetches players with hearts or custom names
- `getMyPlayersCount(associationId)` — count for dashboard badge

**Components already working:**
- `frontend/components/teams/player-row.tsx` — has heart icon, custom name display, drag handle
- `frontend/components/teams/long-press-menu.tsx` — has "Add to Friends" (heart toggle), "Set Name" (inline input), "View Player Details" link
- `frontend/components/teams/teams-page-client.tsx` — manages annotation state, passes to child components
- `frontend/components/teams/prediction-board.tsx` — threads annotations to PlayerRow
- `frontend/components/teams/previous-teams-view.tsx` — threads annotations to PlayerRow
- `frontend/components/dashboard/my-players-card.tsx` — dashboard card with count
- `frontend/app/(app)/my-players/page.tsx` — lists tracked players grouped by division

**Pages:**
- `frontend/app/(app)/teams/page.tsx` — fetches and passes annotations
- `frontend/app/(app)/dashboard/page.tsx` — renders My Players card
- `frontend/app/(app)/corrections/page.tsx` — placeholder only ("coming soon")

**Styles in `frontend/app/globals.css`:**
- `.favorite-btn` / `.favorite-btn-active` — heart icon styles
- `.long-press-*` classes — current long-press menu styles
- `.my-players-*` classes — My Players page styles
- `.notes-indicator` — small file icon for notes (used on Continuations)

### What needs to change

1. **Long-press menu → Player detail sheet** — Complete redesign
2. **Notes on Teams page** — Note icon on player row + editable in detail sheet
3. **My Players page grouping** — Change from division-only to division → team spacing
4. **Correction submission flow** — New popup + server action + `corrections` table insert
5. **Admin corrections badge** — Badge on avatar + corrections card on settings page
6. **Admin corrections list page** — New page to review and approve/reject corrections

## Changes Required

### Database

No new migrations needed. The `corrections` table and `player_annotations` table already have all required columns. The `notes` column on `player_annotations` already exists.

### Server Actions

**Update `frontend/app/(app)/annotations/actions.ts`:**
- `savePlayerNote(playerId: string, note: string): Promise<{ error?: string }>` — Upserts `player_annotations.notes` for the current user. Empty string clears the note (sets to null). This action already exists in `continuations/actions.ts` — move or re-export it.

**Create `frontend/app/(app)/corrections/actions.ts`:**
- `submitCorrection(playerId: string, fieldName: string, oldValue: string, newValue: string): Promise<{ error?: string }>` — Inserts a row into `corrections` with `status = 'pending'`, the current user's ID, and the player's `association_id`. `fieldName` is either `"name"` or `"jersey_number"`.
- `getPendingCorrectionsCount(associationId: string): Promise<number>` — Returns count of corrections with `status = 'pending'` for the given association. Used for the admin badge.
- `getPendingCorrections(associationId: string): Promise<Correction[]>` — Returns all pending corrections with player details (jersey number, name, division). Used for the admin corrections list.
- `reviewCorrection(correctionId: string, action: "approved" | "rejected"): Promise<{ error?: string }>` — Updates the correction's `status`, sets `reviewed_by` and `reviewed_at`. If approved and `field_name` is `"name"`, update `tryout_players.name`. If approved and `field_name` is `"jersey_number"`, update `tryout_players.jersey_number`. **Important:** Jersey number changes must check for duplicates within the same association/division before applying.

### Pages

**`frontend/app/(app)/teams/page.tsx`** — No changes needed (already passes annotations).

**`frontend/app/(app)/my-players/page.tsx`** — Update grouping:
- Primary group: division header (e.g., "U15")
- Within each division: players sorted by `previous_team`, with visual spacing between different previous teams
- No team name headers — just a gap between groups
- Skip teams where the parent has no tracked players

**`frontend/app/(app)/settings/page.tsx`** — Fetch `getPendingCorrectionsCount` and pass to `SettingsPageClient`.

**`frontend/app/(app)/settings/corrections/page.tsx`** — NEW. Admin-only page showing pending corrections. Each row shows: player jersey + name, field being corrected, old value → new value, submitted by (email), date. Approve and Reject buttons on each row.

### Components

**`frontend/components/teams/long-press-menu.tsx`** — REDESIGN into player detail sheet:

Replace the current action-button menu with a full player detail bottom sheet:

**Editable section (top):**
- **Jersey number** — Text input showing current `player.jersey_number`. Parent can edit. Change is tracked for correction submission.
- **Heart** — Toggle button (same as current). Saves immediately via `onToggleFavorite`.
- **Name** — Text input showing `customName` or `player.name`. Parent can edit. Saves to `player_annotations.custom_name` via `onSaveName`. Change tracked for correction submission.
- **Note** — Multi-line text area showing current note from annotations. Saves to `player_annotations.notes` via new `onSaveNote` callback. Auto-saves on blur or explicit save button.

**Read-only section (bottom, visually distinct — muted background or grouped together so they clearly look non-editable):**
- **Position** — F / D / G
- **Previous team** — e.g., "U13 AA"
- **Made team** — Show team name if `player.status === 'made_team'`, otherwise omit

**On close behavior:**
- If the parent changed the **name** or **jersey number** (compared to the original `player.name` / `player.jersey_number`), show a confirmation popup/toast: "Submit correction to admin?"
- Two buttons: "Submit" and "Skip"
- If "Submit" → call `submitCorrection()` for each changed field
- If "Skip" → close without submitting (the private custom name is already saved)
- The custom name is saved to `player_annotations` regardless of whether the correction is submitted

**Props update:**
```
player: TryoutPlayer
isFavorite: boolean
customName: string | null
note: string | null
onClose: () => void
onToggleFavorite: () => void
onSaveName: (name: string) => void
onSaveNote: (note: string) => void
onSubmitCorrection: (fieldName: string, oldValue: string, newValue: string) => void
```

**`frontend/components/teams/player-row.tsx`** — Add notes indicator:
- New prop: `hasNotes?: boolean`
- Show a small `FileText` icon (from Lucide) next to the player name when `hasNotes === true`. Copy the pattern from `frontend/components/continuations/continuation-player-row.tsx`.

**`frontend/components/teams/teams-page-client.tsx`** — Wire up notes and corrections:
- Add `handleSaveNote(playerId, note)` callback — calls `savePlayerNote` server action, updates local annotations state
- Add `handleSubmitCorrection(playerId, fieldName, oldValue, newValue)` callback — calls `submitCorrection` server action
- Pass `note` and `hasNotes` data to `PlayerRow` and the detail sheet
- Pass `onSaveNote` and `onSubmitCorrection` to the detail sheet

**`frontend/components/teams/prediction-board.tsx`** and **`frontend/components/teams/previous-teams-view.tsx`** — Thread `hasNotes` prop to each `PlayerRow`.

**`frontend/components/settings/settings-page-client.tsx`** — Add corrections card:
- New prop: `pendingCorrectionsCount: number`
- In the "Admin" section (visible to group_admin and admin), add a new row linking to `/settings/corrections`
- Show the count as a badge (e.g., "3") if > 0
- Use an icon like `MessageSquareWarning` or `FileCheck` from Lucide

**`frontend/components/layout/teams-header.tsx`** (and other headers using the avatar) — Add badge indicator:
- New prop: `hasPendingCorrections?: boolean`
- When true, render a small red dot on the avatar link (CSS `::after` pseudo-element or a positioned `<span>`)
- The avatar still links to `/settings` as before

**`frontend/components/settings/corrections-list.tsx`** — NEW. Client component for the admin corrections page:
- Renders a list of pending corrections
- Each row: player info (jersey, name, division), field name, old → new value, submitter email, date
- Approve button (green) and Reject button (red) on each row
- On approve/reject, calls `reviewCorrection` server action and removes the row from the list (optimistic update)

### Styles

Add to `frontend/app/globals.css`:

- `.detail-sheet` — full player detail bottom sheet (larger than old long-press menu, slides up from bottom)
- `.detail-sheet-overlay` — backdrop overlay
- `.detail-sheet-editable` — container for the editable fields section
- `.detail-sheet-readonly` — container for the read-only fields (muted background, e.g., `var(--dm-sandstone)`)
- `.detail-sheet-field` — individual field row (label + input or value)
- `.detail-sheet-field-label` — field label text
- `.detail-sheet-input` — text input styling within the detail sheet
- `.detail-sheet-textarea` — multi-line note input
- `.detail-sheet-heart` — heart toggle button within the detail sheet
- `.correction-popup` — the "Submit correction?" confirmation that appears on close
- `.correction-popup-actions` — button row in the correction popup
- `.avatar-badge` — red dot indicator on the profile avatar
- `.corrections-card-badge` — count badge on the corrections settings card
- `.corrections-list` — admin corrections list container
- `.corrections-row` — individual correction row
- `.corrections-field-change` — old → new value display
- `.corrections-actions` — approve/reject button container
- `.my-players-team-gap` — spacing between previous-team groups on My Players page

Update existing:
- `.my-players-page` — adjust grouping to support division → team spacing

## Key Implementation Details

1. **Detail sheet replaces the long-press menu entirely.** The old three-button menu (`long-press-menu.tsx`) becomes a richer detail sheet. The file keeps the same name but the component is redesigned. All existing props are preserved; new ones are added.

2. **Notes use the existing `player_annotations.notes` column.** No migration needed. The `savePlayerNote` action already exists in continuations — either move to `annotations/actions.ts` or re-export.

3. **Notes icon on player row copies the Continuations pattern.** `continuation-player-row.tsx` shows `<FileText size={10} />` inside a `.notes-indicator` span when `hasNotes === true`. Copy this exact pattern into `player-row.tsx`.

4. **Correction submission is opt-in, not automatic.** The custom name always saves to `player_annotations.custom_name` (private). The correction to `corrections` table only happens if the parent clicks "Submit" in the popup. This keeps the corrections queue clean.

5. **Jersey number corrections don't create a private annotation.** Unlike custom names, there is no "custom jersey number" stored in annotations. The number field in the detail sheet edits a temporary value. If the parent submits a correction, it goes to the `corrections` table. If they skip, the change is discarded. The display always shows the official `player.jersey_number`.

6. **Admin corrections badge data flow:** The `getPendingCorrectionsCount` call happens in the server component for any page that renders the header avatar. The simplest approach: fetch it in `frontend/app/(app)/layout.tsx` and pass it down via the layout context or as a prop to the header. Alternatively, fetch it in each page's server component that uses `TeamsHeader` or `DivisionSwitcher`.

7. **Correction approval side effects:** When an admin approves a name correction, `tryout_players.name` is updated. When they approve a jersey number correction, `tryout_players.jersey_number` is updated. The server action must check that the new jersey number doesn't already exist for another player in the same association+division. If it does, reject with an error message.

8. **My Players page grouping:** Within each division, sort players by `previous_team` (alphabetically), then by `jersey_number`. Insert a spacer element (margin/gap) between groups of players from different previous teams. Don't render team name headers — the spacing alone is sufficient.

9. **Detail sheet close detection:** Track the original `player.name` and `player.jersey_number` when the sheet opens. On close, compare the current name input and jersey input against the originals. Only show the correction popup if either value changed AND the new value differs from the official value.

## Acceptance Criteria

### Already passing (from previous implementation)
- [x] Heart icon appears on every player row in Teams page
- [x] Tapping a heart toggles it with optimistic update
- [x] Hearts persist across page reloads
- [x] Custom names saved per-user in `player_annotations.custom_name`
- [x] Custom names display on player row
- [x] Custom names are private per-user
- [x] Dashboard has a "My Players" card showing tracked player count
- [x] Position filter works with hearts and custom names
- [x] Drag-and-drop works with hearts on player rows

### New criteria
- [ ] Long-press opens a player detail sheet (not the old action menu)
- [ ] Detail sheet shows editable fields: jersey number, heart, name, note
- [ ] Detail sheet shows read-only fields: position, previous team, made team (visually distinct)
- [ ] Notes save to `player_annotations.notes` from the detail sheet
- [ ] Note icon (FileText) appears on player row when a note exists
- [ ] Note icon only appears when there IS a note (not on every row)
- [ ] Editing name or jersey number in detail sheet triggers "Submit correction?" popup on close
- [ ] "Submit" creates a `corrections` record with status "pending"
- [ ] "Skip" closes without creating a correction (custom name still saved)
- [ ] My Players page groups by division header, then spaces by previous team
- [ ] My Players page doesn't show team name headers, just spacing
- [ ] Admin avatar shows badge dot when pending corrections exist
- [ ] Settings page shows "Corrections" card (admin only) with pending count
- [ ] Corrections list page shows pending corrections with approve/reject
- [ ] Approving a name correction updates `tryout_players.name`
- [ ] Approving a jersey number correction updates `tryout_players.jersey_number`
- [ ] Rejecting a correction updates its status without changing player data
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Start dev server (`cd frontend && npm run dev`). Log in as a member/parent user who belongs to the NGHA association.

### Test 1: Heart icon visible on Teams page
1. Navigate to `/teams`
2. Take a snapshot of the page
3. **Verify:** Every player row has a heart icon (unfilled by default) between the position pill and the player name

### Test 2: Toggle heart via player row
1. Navigate to `/teams`
2. Click the heart icon on any player row
3. **Verify:** Heart fills with color
4. Reload the page
5. **Verify:** The same player still has a filled heart (persisted)

### Test 3: Unheart a player
1. Click the filled heart on the previously hearted player
2. **Verify:** Heart unfills
3. Reload the page
4. **Verify:** Heart is unfilled (change persisted)

### Test 4: Player detail sheet opens on long-press
1. Navigate to `/teams`
2. Right-click (long-press) on a player row
3. **Verify:** A bottom sheet opens showing the player's details
4. **Verify:** Editable fields visible: jersey number input, heart toggle, name input, note text area
5. **Verify:** Read-only fields visible: position, previous team (visually distinct / muted)

### Test 5: Toggle heart via detail sheet
1. Open the detail sheet for a player
2. Toggle the heart in the detail sheet
3. Close the sheet
4. **Verify:** The heart state on the player row matches what was set in the sheet

### Test 6: Set custom name via detail sheet
1. Open the detail sheet for a player
2. Edit the name field to "Test Custom Name"
3. Close the sheet (the name auto-saves or saves on blur)
4. **Verify:** The player row shows "Test Custom Name" with the official name in muted text
5. Reload the page
6. **Verify:** "Test Custom Name" persists

### Test 7: Add a note via detail sheet
1. Open the detail sheet for a player
2. Type "Good skater, watch for tryout round 2" in the note text area
3. Close the sheet
4. **Verify:** A small note icon (FileText) appears on that player's row
5. Reload the page
6. **Verify:** The note icon is still present
7. Re-open the detail sheet for that player
8. **Verify:** The note text area shows "Good skater, watch for tryout round 2"

### Test 8: Note icon only appears when note exists
1. Navigate to `/teams`
2. **Verify:** Players without notes do NOT show the FileText icon
3. **Verify:** Only the player from Test 7 (or others with notes) shows the icon

### Test 9: Clear a note
1. Open the detail sheet for the player with a note
2. Clear the note text area
3. Close the sheet
4. **Verify:** The note icon disappears from that player's row

### Test 10: Correction popup — name change
1. Open the detail sheet for a player (note the official name)
2. Change the name field to "Corrected Name"
3. Close the sheet
4. **Verify:** A popup appears asking "Submit correction to admin?"
5. Click "Submit"
6. **Verify:** Popup closes. The custom name "Corrected Name" is shown on the row.

### Test 11: Correction popup — skip
1. Open the detail sheet for another player
2. Change the name field to "Another Name"
3. Close the sheet
4. **Verify:** The correction popup appears
5. Click "Skip"
6. **Verify:** The custom name is still saved (shows "Another Name") but no correction was submitted

### Test 12: Correction popup — jersey number change
1. Open the detail sheet for a player (note the jersey number, e.g., #7)
2. Change the jersey number to "14"
3. Close the sheet
4. **Verify:** The correction popup appears mentioning the number change
5. Click "Submit"
6. **Verify:** Popup closes. The player row still shows the ORIGINAL jersey number (no private annotation for numbers).

### Test 13: No popup when nothing changed
1. Open the detail sheet for a player
2. Don't change the name or jersey number (only toggle heart or edit note)
3. Close the sheet
4. **Verify:** No correction popup appears

### Test 14: Hearts work in Previous Teams view
1. Switch to "Previous Teams" view
2. Heart a player
3. **Verify:** Heart fills
4. Switch to "Predictions" view
5. **Verify:** Same player's heart is filled

### Test 15: Hearts survive drag-and-drop
1. Heart a player
2. Drag that player to a different team position
3. **Verify:** Heart is still filled after the drag

### Test 16: Position filter with hearts and notes
1. Heart a forward (F) and add a note to a defenseman (D)
2. Tap "F" filter
3. **Verify:** Only forwards shown, hearted forward has filled heart
4. Tap "D" filter
5. **Verify:** Only defensemen shown, noted defenseman has note icon
6. Tap "All"
7. **Verify:** Both visible with their respective indicators

### Test 17: My Players page — division + team grouping
1. Heart players from different previous teams within the same division (e.g., one from "U13 AA" and one from "U13 A")
2. Navigate to `/my-players`
3. **Verify:** Division header (e.g., "U15") is shown
4. **Verify:** Players from different previous teams are separated by visible spacing
5. **Verify:** No team name headers are shown — just spacing between groups

### Test 18: My Players empty state
1. Log in as a user with no hearts, names, or notes
2. Navigate to `/my-players`
3. **Verify:** Empty state message shown (e.g., "No tracked players yet")

### Test 19: Dashboard My Players card
1. Navigate to `/dashboard`
2. **Verify:** "My Players" card shows the count of tracked players
3. Click the card
4. **Verify:** Navigates to `/my-players`

### Test 20: Admin badge — pending corrections indicator
1. Log in as a group_admin user
2. Navigate to any page with the header avatar
3. **Verify:** If there are pending corrections (from Tests 10, 12), a red dot badge appears on the avatar
4. **Verify:** Avatar still links to `/settings`

### Test 21: Admin settings — corrections card
1. Navigate to `/settings` as a group_admin
2. **Verify:** An admin section shows a "Corrections" row with a pending count badge
3. Click the "Corrections" row
4. **Verify:** Navigates to `/settings/corrections`

### Test 22: Admin corrections list — view and approve
1. On `/settings/corrections`, view the list of pending corrections
2. **Verify:** Each row shows: player jersey + name, field changed, old → new value, submitter, date
3. Click "Approve" on a name correction
4. **Verify:** The row disappears from the list
5. Navigate to `/teams`
6. **Verify:** The player's official name has been updated to the corrected value

### Test 23: Admin corrections list — reject
1. Navigate to `/settings/corrections`
2. Click "Reject" on a correction
3. **Verify:** The row disappears from the list
4. Navigate to `/teams`
5. **Verify:** The player's data is unchanged (old value preserved)

### Test 24: Hearts on Continuations still work
1. Navigate to `/continuations`
2. Heart a player
3. Navigate to `/teams`
4. **Verify:** The same player shows a filled heart on the Teams page

### Test 25: Custom name is private
1. Log out and log in as a different user (same association)
2. Navigate to `/teams`
3. **Verify:** Custom names set by the other user are NOT visible

## Files to Touch

### New files
1. `frontend/app/(app)/corrections/actions.ts` — correction server actions (submit, get pending, review)
2. `frontend/app/(app)/settings/corrections/page.tsx` — admin corrections list page
3. `frontend/components/settings/corrections-list.tsx` — corrections list client component

### Modified files
4. `frontend/components/teams/long-press-menu.tsx` — redesign into player detail sheet
5. `frontend/components/teams/player-row.tsx` — add notes indicator (`hasNotes` prop + FileText icon)
6. `frontend/components/teams/teams-page-client.tsx` — wire notes + correction callbacks
7. `frontend/components/teams/prediction-board.tsx` — thread `hasNotes` to PlayerRow
8. `frontend/components/teams/previous-teams-view.tsx` — thread `hasNotes` to PlayerRow
9. `frontend/app/(app)/annotations/actions.ts` — add or re-export `savePlayerNote`
10. `frontend/app/(app)/my-players/page.tsx` — update grouping (division → team spacing)
11. `frontend/app/(app)/settings/page.tsx` — fetch pending corrections count, pass to client
12. `frontend/components/settings/settings-page-client.tsx` — add corrections card with badge (admin only)
13. `frontend/components/layout/teams-header.tsx` — add badge dot on avatar
14. `frontend/app/(app)/layout.tsx` — fetch pending corrections count for header badge (if admin)
15. `frontend/app/globals.css` — new styles for detail sheet, correction popup, avatar badge, corrections list, team gap spacing

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
