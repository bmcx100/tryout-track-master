# Spec 006: Player Management (Parent)

**PRD Reference:** FR-021 (partial), custom feature
**Priority:** Must Have
**Depends on:** None (004 already implemented)

## What This Feature Does

Parents can privately track players across the Teams page by:

1. **Hearting players** — Tapping an inline heart icon on any player row to bookmark them. Hearted players show a filled red heart. This is the same pattern already working on the Continuations/Sessions page.
2. **Naming players** — Long-pressing a player and choosing "Set Name" to privately label a jersey number with a name they recognize (e.g., "oh, #7 is actually Johnny Smith"). This label is visible only to that parent.
3. **Viewing tracked players** — A "My Players" card on the Dashboard shows how many players the parent has hearted or named, linking to a dedicated page listing them across all divisions.

All annotations (hearts, names) are private per-user. No other parent sees your data.

## Current State

### Database tables (already exist)
- `player_annotations` — per-user player data with `is_favorite` (boolean), `notes` (text). Migration: `backend/supabase/migrations/20260420000002_create_continuations.sql`. RLS: users can only read/write their own rows.
- `player_hearts` — simple join table (user_id, player_id). Migration: `backend/supabase/migrations/20260418000003_create_player_hearts.sql`. **Currently unused** — the app uses `player_annotations.is_favorite` instead. This table can be ignored.

### Server actions (already exist)
- `toggleFavorite(playerId)` — toggles `player_annotations.is_favorite`. Located in `frontend/app/(app)/continuations/actions.ts`.
- `savePlayerNote(playerId, note)` — upserts `player_annotations.notes`. Located in `frontend/app/(app)/continuations/actions.ts`.
- `getPlayerAnnotations(associationId)` — fetches all annotations for current user filtered by association. Located in `frontend/app/(app)/continuations/actions.ts`.

### Components (already exist)
- `frontend/components/continuations/continuation-player-row.tsx` — has inline heart icon with `isFavorite` prop and `onToggleFavorite` callback. **This is the proven pattern to copy.**
- `frontend/components/teams/player-row.tsx` — Teams page player row. Has drag handle, jersey, position, name, previous team. **No heart icon yet.**
- `frontend/components/teams/long-press-menu.tsx` — Bottom sheet with three action buttons. The "Add to Friends" heart button currently has an empty onClick (just calls `onClose()`). **Not wired to anything.**
- `frontend/components/teams/teams-page-client.tsx` — Manages view state, position filter, drag orders. **Does not fetch or pass annotations.**

### Styles (already exist)
- `.favorite-btn` / `.favorite-btn-active` classes in `frontend/app/globals.css` (lines 1381-1403). Red-orange filled heart when active.
- `.notes-indicator` class for the small file icon shown next to names with notes.

### Pages
- `frontend/app/(app)/teams/page.tsx` — Server component. Fetches players, teams, predictions, previous orders. **Does not fetch annotations.**
- `frontend/app/(app)/dashboard/page.tsx` — Dashboard with card links. **No "My Players" section.**

## Changes Required

### Database

New migration to add `custom_name` column to `player_annotations`:

```
backend/supabase/migrations/20260420000003_add_custom_name_to_player_annotations.sql
```

Contents:
- `ALTER TABLE player_annotations ADD COLUMN custom_name text`

After applying, regenerate types:
```bash
cd backend && supabase gen types typescript --local > ../frontend/types/database.ts
```

### Server Actions

**Move shared annotation actions to a shared file:**

Create `frontend/app/(app)/annotations/actions.ts` with:
- `toggleFavorite(playerId)` — move from continuations/actions.ts (re-export from continuations for backward compatibility)
- `getPlayerAnnotations(associationId)` — move from continuations/actions.ts
- `saveCustomName(playerId: string, customName: string): Promise<{ error?: string }>` — NEW. Upserts `player_annotations.custom_name` for the current user. Empty string clears the name (sets to null).
- `getMyPlayers(associationId: string): Promise<{ player: TryoutPlayer, annotation: { isFavorite: boolean, customName: string | null } }[]>` — NEW. Fetches all players where the current user has a heart or custom name, across all divisions in the association. Returns player + annotation data sorted by division then jersey number.

Update `frontend/app/(app)/continuations/actions.ts` to re-export `toggleFavorite` and `getPlayerAnnotations` from the shared location, so existing imports in continuations code don't break.

### Pages

**`frontend/app/(app)/teams/page.tsx`** — Add fetch for `getPlayerAnnotations(associationId)` and pass the result as `annotations` prop to `TeamsPageClient`.

**`frontend/app/(app)/dashboard/page.tsx`** — Add a "My Players" card. Shows the count of hearted/named players. Links to `/my-players`.

**`frontend/app/(app)/my-players/page.tsx`** — NEW page. Server component that calls `getMyPlayers(associationId)` and renders a list of the parent's tracked players grouped by division. Each row shows jersey, position, heart, custom name (or official name), and division. Tapping a row could open the long-press menu for that player.

### Components

**`frontend/components/teams/player-row.tsx`** — Add optional heart icon:
- New props: `isFavorite?: boolean`, `customName?: string | null`, `onToggleFavorite?: () => void`
- Insert heart button between position pill and player name, matching `ContinuationPlayerRow` pattern
- If `customName` is set, show it instead of `player.name` (or show both: custom name primary, official name secondary in muted text)
- Use existing `.favorite-btn` / `.favorite-btn-active` CSS classes

**`frontend/components/teams/long-press-menu.tsx`** — Wire up existing actions and add name input:
- New props: `isFavorite: boolean`, `customName: string | null`, `onToggleFavorite: () => void`, `onSaveName: (name: string) => void`
- "Add to Friends" button: toggle heart on click (call `onToggleFavorite`), update icon to filled heart if already favorited, change label to "Remove from Friends" when active
- "Set Name" button (NEW): replaces or adds below the heart action. On tap, reveals an inline text input pre-filled with `customName` (or empty). Parent types a name and taps a confirm button (or presses Enter). Calls `onSaveName`. A clear/remove button appears if a name is already set.
- Keep "View Player Details" and "Submit Correction" as-is

**`frontend/components/teams/teams-page-client.tsx`** — Manage annotation state:
- Accept `annotations` prop (same type as continuations: `Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>`)
- Add `handleToggleFavorite(playerId)` callback with optimistic update (copy pattern from `ContinuationsPageClient`)
- Add `handleSaveName(playerId, customName)` callback
- Pass per-player `isFavorite`, `customName`, `onToggleFavorite` down through `PredictionBoard` and `PreviousTeamsView` to individual `PlayerRow` components
- Pass `isFavorite`, `customName`, `onToggleFavorite`, `onSaveName` to `LongPressMenu`

**`frontend/components/teams/prediction-board.tsx`** and **`frontend/components/teams/previous-teams-view.tsx`** — Thread annotation props:
- Accept `annotations` prop
- Pass per-player `isFavorite`, `customName`, `onToggleFavorite` to each `PlayerRow`

**`frontend/components/dashboard/my-players-card.tsx`** — NEW. Dashboard card showing tracked player count with link to `/my-players`.

### Styles

Add to `frontend/app/globals.css`:
- `.long-press-name-input` — text input inside the long-press sheet for entering a custom name
- `.long-press-name-row` — flex container for the input + confirm/clear buttons
- `.my-players-card` — dashboard card for the "My Players" link (follow existing `.dashboard-link-card` pattern)
- `.my-players-page` — layout for the My Players page
- `.my-players-row` — row style for each tracked player
- `.custom-name-indicator` — subtle visual indicator that a name is user-provided (e.g., small pencil icon or italic text)

## Key Implementation Details

1. **Reuse the continuations heart pattern exactly.** `ContinuationPlayerRow` (lines 37-45) has the proven heart toggle with optimistic update. Copy this pattern for `PlayerRow`.

2. **`player_annotations` is the single source of truth for per-user data.** The `player_hearts` table exists but is unused. Do not use it. All hearts go through `player_annotations.is_favorite`.

3. **Custom name display priority:** If `customName` exists in annotations, show it as the primary name. If the official `player.name` is different and non-empty, show it in smaller muted text below or beside the custom name. If no custom name, show `player.name` as usual.

4. **Annotations data flow (Teams page):** Server component fetches annotations → passes to `TeamsPageClient` → client manages in `useState` with optimistic updates → passes down to `PlayerRow` via `PredictionBoard`/`PreviousTeamsView`. This matches the existing pattern in `ContinuationsPageClient`.

5. **Long-press menu name input:** Keep it minimal. When "Set Name" is tapped, the bottom sheet reveals an input field inline (no navigation to a new page). The input is auto-focused. Enter key or a checkmark button saves. An "X" or "Remove" button clears an existing name.

6. **My Players page:** Group players by division (e.g., "U13", "U15"). Within each division, sort by jersey number. Show heart status, custom name (or official name), position, and current status. This page is read-only — the parent navigates back to Teams or Continuations to modify annotations.

7. **Dashboard "My Players" count:** Query count of rows in `player_annotations` where `is_favorite = true` OR `custom_name IS NOT NULL` for the current user + association. Show as badge number on the card.

8. **No cross-page navigation from My Players for now.** Keep it simple. The My Players page is a flat list. Future specs can add tap-to-navigate-to-player-detail.

## Acceptance Criteria

- [ ] Heart icon appears on every player row in the Teams page (Predictions and Previous Teams views)
- [ ] Tapping a heart toggles it with optimistic update (same behavior as Continuations page)
- [ ] Hearts persist across page reloads (stored in `player_annotations`)
- [ ] Long-press menu "Add to Friends" button toggles the heart and updates the label
- [ ] Long-press menu has a "Set Name" action that reveals an inline text input
- [ ] Custom names are saved per-user in `player_annotations.custom_name`
- [ ] Custom names display on the player row instead of (or alongside) the official name
- [ ] Custom names are visible only to the parent who set them
- [ ] Dashboard has a "My Players" card showing count of tracked players
- [ ] "My Players" page lists all hearted/named players grouped by division
- [ ] Position filter still works correctly with hearts and custom names present
- [ ] Drag-and-drop still works correctly with hearts on player rows
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Start dev server (`cd frontend && npm run dev`). Log in as a member/parent user who belongs to the NGHA association. Navigate to the Teams page.

### Test 1: Heart icon visible on Teams page
1. Navigate to `/teams`
2. Take a snapshot of the page
3. **Verify:** Every player row has a heart icon (unfilled by default) between the position pill and the player name

### Test 2: Toggle heart via player row
1. Navigate to `/teams`
2. Click the heart icon on any player row
3. **Verify:** Heart fills with color (`.favorite-btn-active` class applied)
4. Reload the page
5. **Verify:** The same player still has a filled heart (persisted)

### Test 3: Unheart a player
1. Navigate to `/teams` (assuming a player is already hearted from Test 2)
2. Click the filled heart on the previously hearted player
3. **Verify:** Heart unfills (reverts to `.favorite-btn` without `-active`)
4. Reload the page
5. **Verify:** Heart is unfilled (change persisted)

### Test 4: Toggle heart via long-press menu
1. Navigate to `/teams`
2. Right-click on a player row to open the long-press menu
3. **Verify:** Bottom sheet shows "Add to Friends" with a heart icon
4. Click "Add to Friends"
5. **Verify:** The heart on that player's row is now filled
6. Right-click the same player again
7. **Verify:** The action now says "Remove from Friends" (or similar)
8. Click "Remove from Friends"
9. **Verify:** Heart unfills on the player row

### Test 5: Set custom name via long-press menu
1. Navigate to `/teams`
2. Right-click on a player row to open the long-press menu
3. Click "Set Name"
4. **Verify:** An inline text input appears in the bottom sheet
5. Type "Test Custom Name" and press Enter (or click confirm)
6. **Verify:** The bottom sheet closes. The player row now shows "Test Custom Name" as the displayed name
7. Reload the page
8. **Verify:** "Test Custom Name" still appears on that player's row

### Test 6: Clear custom name
1. Navigate to `/teams` (player from Test 5 should have custom name)
2. Right-click on the player with "Test Custom Name"
3. Click "Set Name"
4. **Verify:** Input is pre-filled with "Test Custom Name"
5. Clear the input and press Enter (or click a remove/clear button)
6. **Verify:** Player row reverts to showing the official name

### Test 7: Custom name is private
1. Log out and log in as a different user (same association)
2. Navigate to `/teams`
3. **Verify:** The player from Tests 5-6 shows the official name, not "Test Custom Name"

### Test 8: Hearts work in Previous Teams view
1. Navigate to `/teams`
2. Switch to "Previous Teams" view
3. Heart a player
4. **Verify:** Heart fills on the player row
5. Switch back to "Predictions" view
6. **Verify:** The same player's heart is still filled (annotations are shared across views)

### Test 9: Hearts survive drag-and-drop
1. Navigate to `/teams`
2. Heart a player
3. Drag that player to a different team position
4. **Verify:** Heart is still filled after the drag completes

### Test 10: Position filter with hearts
1. Heart a forward (F) player and a defenseman (D) player
2. Tap the "F" position filter
3. **Verify:** Only forwards are shown, hearted forward still has filled heart
4. Tap "D" position filter
5. **Verify:** Only defensemen shown, hearted defenseman still has filled heart
6. Tap "All"
7. **Verify:** Both hearted players visible with filled hearts

### Test 11: Dashboard My Players card
1. Navigate to `/dashboard`
2. **Verify:** A "My Players" card is visible showing the count of tracked players
3. Heart 2 players on the Teams page, set a custom name on 1 (different player)
4. Return to `/dashboard`
5. **Verify:** My Players card shows count of 3 (2 hearted + 1 named, assuming no overlap)

### Test 12: My Players page
1. From the Dashboard, click the "My Players" card
2. **Verify:** Navigates to `/my-players`
3. **Verify:** All hearted and named players are listed, grouped by division
4. **Verify:** Each row shows jersey number, position, heart status, name (custom or official), and division

### Test 13: My Players empty state
1. Log in as a user with no hearts or custom names
2. Navigate to `/my-players`
3. **Verify:** An empty state message is shown (e.g., "No tracked players yet")

### Test 14: Hearts on Continuations still work
1. Navigate to `/continuations`
2. Heart a player
3. Navigate to `/teams`
4. **Verify:** The same player shows a filled heart on the Teams page (shared annotation data)

## Files to Touch

### New files
1. `backend/supabase/migrations/20260420000003_add_custom_name_to_player_annotations.sql`
2. `frontend/app/(app)/annotations/actions.ts` — shared annotation server actions
3. `frontend/app/(app)/my-players/page.tsx` — My Players page
4. `frontend/components/dashboard/my-players-card.tsx` — dashboard card component

### Modified files
5. `frontend/types/database.ts` — regenerated after migration
6. `frontend/components/teams/player-row.tsx` — add heart icon + custom name display
7. `frontend/components/teams/long-press-menu.tsx` — wire heart, add name input
8. `frontend/components/teams/teams-page-client.tsx` — annotations state management
9. `frontend/components/teams/prediction-board.tsx` — thread annotations props
10. `frontend/components/teams/previous-teams-view.tsx` — thread annotations props
11. `frontend/app/(app)/teams/page.tsx` — fetch annotations
12. `frontend/app/(app)/dashboard/page.tsx` — add My Players card
13. `frontend/app/(app)/continuations/actions.ts` — re-export moved actions
14. `frontend/app/globals.css` — new styles for name input, my-players page

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
