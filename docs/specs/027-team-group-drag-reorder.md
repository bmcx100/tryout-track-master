# Spec 027: Team Group Drag Reorder (Previous Teams)

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** None (builds on existing Previous Teams view)

## What This Feature Does

In the Previous Teams view, each team section (e.g., "Previously U15AA") can be grabbed by a handle on the team header and dragged to reorder among other team groups. When a team is picked up, its player rows collapse into a compact card showing the team name and player count. The new team order is saved per user to the database and also becomes the default team ordering in the Predictions view (when no custom prediction order exists). Player-level dragging within teams continues to work alongside team-level dragging.

## Current State

### Previous Teams view
`frontend/components/teams/previous-teams-view.tsx` groups players by `previous_team` and renders each group as a `PreviousTeamSection`. Team groups are sorted by `comparePreviousTeams()` which ranks by tier (AA > A > BB > B > C), then by division number, then current-association-first, then external alphabetically.

Each `PreviousTeamSection` has a header (`button.team-header`) with the team name, bulk heart button, player count, and expand/collapse chevron. Below the header is a `SortableContext` wrapping `PlayerRow` components for player-level drag.

A single `DndContext` wraps all sections. Player drags are constrained to the same previous-team group via the `playerGroupMap` lookup in `handleDragEnd`.

### State management
`frontend/components/teams/teams-page-client.tsx` manages `currentPreviousOrders` (player order within teams) and passes it to both `PreviousTeamsView` and `PredictionBoard`. Order changes are debounced (1 second) and saved via `savePreviousTeamOrder()` in `frontend/app/(app)/teams/actions.ts`.

### Predictions inheritance
`frontend/components/teams/prediction-board.tsx` has `sortByPreviousTeamOrders()` which uses `comparePreviousTeams()` to sort team group keys. When no custom prediction order exists, this function determines the default player distribution order.

### Database
Player order within teams is stored in `previous_team_orders` (columns: `user_id`, `association_id`, `previous_team`, `player_order uuid[]`). No table currently exists for team GROUP ordering.

### Server page
`frontend/app/(app)/teams/page.tsx` fetches players, teams, predictions, previous orders, and annotations, then passes them to `TeamsPageClient`.

## Changes Required

### Database

**New migration:** `backend/supabase/migrations/20260425000001_create_team_group_orders.sql`

Create `team_group_orders` table:
- `id` uuid PK (gen_random_uuid)
- `user_id` uuid FK to auth.users, NOT NULL
- `association_id` uuid FK to associations, NOT NULL
- `division` text NOT NULL (scopes to the active division)
- `team_order` text[] NOT NULL DEFAULT '{}' (ordered array of previous_team labels, e.g., `{"U15AA","U13A","U13BB"}`)
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()
- UNIQUE constraint on `(user_id, association_id, division)`

RLS policies (same pattern as `previous_team_orders`):
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid() AND user_belongs_to_association(association_id)`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

Index: `idx_team_group_orders_lookup (user_id, association_id, division)`

### Server Actions / API Routes

**In `frontend/app/(app)/teams/actions.ts`**, add two new actions:

1. `saveTeamGroupOrder(associationId: string, division: string, teamOrder: string[]): Promise<{ error?: string }>` — UPSERT into `team_group_orders` on conflict `(user_id, association_id, division)`.

2. `resetTeamGroupOrders(associationId: string): Promise<{ error?: string }>` — DELETE all rows from `team_group_orders` for the current user and association. (Called alongside `resetPreviousTeamOrders` when the reset button is pressed on the Previous Teams view.)

### Pages

**`frontend/app/(app)/teams/page.tsx`** — Add a query to fetch the user's saved team group order for the active division from `team_group_orders`. Pass it as a new `savedTeamGroupOrder: string[]` prop to `TeamsPageClient`.

### Components

#### `frontend/components/teams/teams-page-client.tsx`

- Accept new prop: `savedTeamGroupOrder: string[]`
- Add state: `currentTeamGroupOrder` (initialized from `savedTeamGroupOrder`)
- Add debounced handler: `handleTeamGroupOrderChange(teamOrder: string[])` — updates state + debounce-saves via `saveTeamGroupOrder(associationId, division, teamOrder)`
- Pass `savedTeamGroupOrder={currentTeamGroupOrder}` and `onTeamGroupOrderChange={handleTeamGroupOrderChange}` to `PreviousTeamsView`
- Pass `savedTeamGroupOrder={currentTeamGroupOrder}` to `PredictionBoard` (for default sort inheritance)
- Update `handleReset`: when resetting Previous Teams, also call `resetTeamGroupOrders(associationId)` and clear `currentTeamGroupOrder` to `[]`
- Update `hasCustomOrder` check: for the Previous view, include `currentTeamGroupOrder.length > 0` in the condition

#### `frontend/components/teams/previous-teams-view.tsx`

This is the main component that changes. The key challenge: two levels of drag (teams and players) coexist in one `DndContext`.

**New props:**
- `savedTeamGroupOrder: string[]` — saved team ordering (array of previous_team labels)
- `onTeamGroupOrderChange?: (teamOrder: string[]) => void` — callback when team order changes

**Team ordering logic:**
- Compute `groupEntries` using `savedTeamGroupOrder` when non-empty. For teams in the saved order, use that order. For teams not in the saved order (new teams since last save), append them at the end using `comparePreviousTeams()`.
- When `savedTeamGroupOrder` is empty, fall back to current behavior (`comparePreviousTeams()` sort).

**Two-level drag approach:**
- Maintain state `teamOrder: string[]` — the current ordered list of team labels.
- Each `PreviousTeamSection` wrapper becomes a sortable item via `useSortable`, using an ID like `team::U15AA` (prefix `team::` to distinguish from player UUIDs).
- An outer `SortableContext` wraps all team sections with `items={teamOrder.map(t => "team::" + t)}` and `verticalListSortingStrategy`.
- Within each team, the existing `SortableContext` wraps player rows (unchanged).
- The single `DndContext` wraps everything.

**Identifying drag type in `handleDragEnd`:**
- If `active.id` starts with `"team::"` — it's a team drag. Extract labels, do `arrayMove` on `teamOrder`, update state, call `onTeamGroupOrderChange`.
- Otherwise — it's a player drag. Run the existing player drag logic (unchanged).

**Team header drag handle:**
- Add a `GripVertical` icon (size 16) to the LEFT side of `.team-header-left`, before the team name.
- Connect it to the team-level `useSortable` listeners/attributes (NOT the player-level ones).
- The existing expand/collapse click on the header button must NOT trigger when the drag handle is used. The drag handle should use `e.stopPropagation()` or be a separate element that doesn't bubble to the button.

**DragOverlay for collapsed card:**
- Import `DragOverlay` from `@dnd-kit/core`.
- Track `activeDragTeam: string | null` in state via `onDragStart` handler.
- When `activeDragTeam` is set, render a `<DragOverlay>` containing a compact card:
  - Shows: `[GripVertical icon] Previously {teamLabel} — {playerCount} Players`
  - Background: matches the team's tone color (`.team-header-tone-N`)
  - Has subtle drop shadow and rounded corners
  - Fixed height (~40px), same width as the container
- When a team is being dragged, the original section (in-place) should collapse to just the header height (hide player rows) and show reduced opacity, so the user sees a thin placeholder where the team will land.

**DragOverlay for players:**
- No DragOverlay is needed for players — they continue using the existing CSS transform + opacity approach.

**Position filter interaction:**
- When a position filter is active, team drag should still work. The collapsed card shows the FULL player count (all positions), not just the filtered count. The team moves with all its players regardless of the filter.

#### `frontend/components/teams/prediction-board.tsx`

**New prop:**
- `savedTeamGroupOrder: string[]` — the user's custom team group ordering from Previous Teams

**Modify `sortByPreviousTeamOrders()`:**
- Accept a third parameter: `teamGroupOrder: string[]`
- When `teamGroupOrder` is non-empty, sort group keys using that order instead of `comparePreviousTeams()`. Teams not in the saved order go at the end (sorted by `comparePreviousTeams()`).
- When `teamGroupOrder` is empty, fall back to current behavior.

### Styles

**In `frontend/app/globals.css`**, add:

- `.team-drag-handle` — styling for the grip icon on team headers: flex-shrink-0, subtle color (same as `.player-drag-handle` but slightly larger), cursor grab, touch-action none. Should have enough padding to be a comfortable touch target (min 44x44 area via padding).

- `.team-section-dragging` — applied to the team section wrapper when `isDragging` is true: collapse to header height only (hide player rows), reduced opacity (~0.4), dashed border outline to show the drop zone.

- `.team-drag-overlay` — the compact card in the DragOverlay: rounded corners, drop shadow (0 4px 12px rgba(0,0,0,0.4)), padding to match header, min-height ~40px, pointer-events none. Uses the same tone background as the team header.

- `.team-drag-overlay-name` — team name text inside the overlay card, matching `.team-name` styling.

- `.team-drag-overlay-count` — player count inside the overlay card, matching `.team-count` styling.

## Key Implementation Details

### Distinguishing team vs player drags

The `active.id` prefix approach (`"team::U15AA"` vs a raw UUID) is the cleanest way to distinguish drag types in a shared `DndContext`. In `handleDragEnd`, check `String(active.id).startsWith("team::")` first.

### Wrapping PreviousTeamSection for sortability

Create a small wrapper component (e.g., `SortableTeamSection`) that calls `useSortable({ id: "team::" + label })` and passes the `setNodeRef`, `style` (transform/transition), and `isDragging` down. The wrapper div gets the sortable ref and transform. Inside, `PreviousTeamSection` renders as before, but when `isDragging` is true, player rows are hidden.

### Drag handle isolation

The team drag handle (`GripVertical` on the header) must use the team-level `useSortable` listeners. The player drag handles use the player-level `useSortable` listeners. These are separate hooks on separate elements, so they don't conflict. The team handle should be a `<span>` with `{...teamAttributes, ...teamListeners}` that stops propagation to prevent the header's expand/collapse toggle from firing.

### Sensor configuration

Use the same sensors as today (PointerSensor distance: 8, TouchSensor delay: 200ms tolerance: 5). These work for both team and player drags since the activation constraints are the same.

### DragOverlay portal

`DragOverlay` from dnd-kit renders into a portal by default, which means it appears above all other content. This is the desired behavior — the compact card floats above the list during drag.

### Reset behavior

When the reset button is pressed on Previous Teams:
1. Delete `previous_team_orders` rows (existing behavior)
2. Delete `team_group_orders` rows (new)
3. Clear both `currentPreviousOrders` and `currentTeamGroupOrder` in state
4. Increment `resetKey` to remount children with default ordering

### Pattern to follow

The debounced save pattern for team group order should mirror the existing `handlePreviousOrderChange` in `teams-page-client.tsx` — use a `useRef` timer, clear on new change, save after 1 second.

### dnd-kit imports needed

Add `DragOverlay`, `DragStartEvent` to the imports from `@dnd-kit/core` in `previous-teams-view.tsx`.

## Acceptance Criteria

- [ ] Team sections in Previous Teams view have a visible drag handle (GripVertical) on the left side of the team header
- [ ] Grabbing the team handle and dragging reorders the entire team section among other teams
- [ ] When a team is picked up, the in-place section collapses (player rows hidden, reduced opacity) and a floating compact card follows the cursor showing team name + player count
- [ ] When released, the team snaps into its new position and player rows reappear
- [ ] Player-level drag (via player row handle) continues to work within each team
- [ ] Team order is saved to the database and persists across page reloads
- [ ] Switching to Predictions view uses the custom team order (when no custom prediction order exists)
- [ ] The reset button clears both player order AND team group order
- [ ] Position filter does not prevent team dragging — teams move with all their players
- [ ] Touch devices: team drag activates with the same 200ms delay as player drag
- [ ] The team drag handle does not trigger expand/collapse when tapped
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow the safety rules: prefer read-only tests, log all mutations, revert after testing.

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to `/teams`. Ensure the "Previous Year" view is active and the division is U15.

### Test 1: Team drag handle is visible
1. Navigate to `/teams`
2. Take a snapshot of the page
3. **Verify:** Each team header shows a GripVertical icon on the left side, before the team name. The icon is visible and distinct from the player row drag handles.

### Test 2: Team drag and drop reorders teams
1. Identify the first and second team sections (e.g., "Previously U15AA" and "Previously U15A")
2. Grab the first team's drag handle and drag it below the second team
3. Release
4. **Verify:** The teams have swapped positions — the second team is now first, and the first team is now second. All player rows within each team are intact.

### Test 3: Collapsed card appears during drag
1. Begin dragging a team by its handle (press and hold on touch, or mousedown+move on desktop)
2. While dragging, take a screenshot
3. **Verify:** A floating compact card is visible showing the team name and player count (e.g., "Previously U15AA — 18 Players"). The original team section shows only its header with reduced opacity. Player rows are hidden in the placeholder.

### Test 4: Team order persists after reload
1. Reorder two teams by dragging
2. Wait 2 seconds (for debounce save)
3. Reload the page (navigate away and back to `/teams`)
4. **Verify:** The team order matches the reordered state — the drag change was saved.

### Test 5: Player drag still works within teams
1. After reordering teams, expand a team section
2. Drag a player row (via the player's grip handle) to a new position within the same team
3. **Verify:** The player moves to the new position. The team order does not change.

### Test 6: Reset clears team order
1. Reorder teams (if not already reordered from previous tests)
2. Click the reset button (RotateCcw icon)
3. **Verify:** Teams return to their default order (sorted by tier: AA, A, BB, B, C). The reset button animation plays.

### Test 7: Team order affects Predictions default
1. Reorder teams in Previous Teams (e.g., move U13A above U15AA)
2. Wait 2 seconds for save
3. Switch to the "Next Year" (Predictions) view
4. **Verify:** The player distribution in Predictions reflects the new team group order — players from the team moved up appear earlier in the distribution (when no custom prediction order exists).

### Test 8: Position filter + team drag
1. Switch back to Previous Year view
2. Select the "D" position filter
3. Drag a team to a new position
4. **Verify:** The team moves. The collapsed card shows the full player count (all positions), not just defensemen. After release, only defensemen are visible (filter still active) but the team is in its new position.

### Test 9: Expand/collapse still works
1. Clear position filter (select "All")
2. Tap/click on a team header (NOT on the drag handle)
3. **Verify:** The team section collapses (player rows hidden, chevron rotates). Tapping again expands it. The drag handle does not trigger expand/collapse.

### Test 10: Touch activation
1. On a touch device (or using touch emulation), long-press on the team drag handle for 200ms
2. Drag the team to a new position
3. **Verify:** The team drag activates and the collapsed card appears. A quick tap on the handle does NOT start a drag.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 2 | Team group order saved for U15 division | Reset button (Test 6) or manual reset |
| Test 4 | Team group order saved (same as Test 2) | Reset button |
| Test 5 | Player order within a team may have changed | Reset button clears player orders too |
| Test 7 | Team group order saved (different arrangement) | Reset button |
| Test 8 | Team group order saved (different arrangement) | Reset button |

**After all tests pass:** Click the reset button on Previous Teams view to clear all custom team and player orders. Verify teams return to default order. Confirm with the user that data is clean.

## Files to Touch

1. `backend/supabase/migrations/20260425000001_create_team_group_orders.sql` — **CREATE** new migration
2. `frontend/types/database.ts` — **REGENERATE** after migration (or manually add the new table type)
3. `frontend/app/(app)/teams/actions.ts` — **MODIFY** add `saveTeamGroupOrder()` and `resetTeamGroupOrders()`
4. `frontend/app/(app)/teams/page.tsx` — **MODIFY** fetch `team_group_orders` and pass to client
5. `frontend/components/teams/teams-page-client.tsx` — **MODIFY** add team group order state, handler, reset logic, pass new props
6. `frontend/components/teams/previous-teams-view.tsx` — **MODIFY** (major changes) add team-level sortable, DragOverlay, collapsed card, two-level drag handling
7. `frontend/components/teams/prediction-board.tsx` — **MODIFY** accept `savedTeamGroupOrder` prop, update `sortByPreviousTeamOrders()` to use it
8. `frontend/app/globals.css` — **MODIFY** add `.team-drag-handle`, `.team-section-dragging`, `.team-drag-overlay`, `.team-drag-overlay-name`, `.team-drag-overlay-count`

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (click reset button on Previous Teams view). Confirm with the user that all test data has been cleaned up.
