# Spec 002: Position Filter with Order Reset

**PRD Reference:** FR-012 (filter players by status, division, and team)
**Priority:** Must Have
**Depends on:** None

## What This Feature Does

The Teams page gets a row of position filter chips — All / F / D / G — plus a Reset button on the far right. Tapping a chip filters both the Predictions and Previous Teams views to show only players of that position. The Reset button reverts the drag-and-drop order of players matching the currently selected position back to their default sort, or reverts all players if "All" is selected. The filter resets to "All" on each page visit (no persistence).

## Current State

### Pages

- **`frontend/app/(app)/teams/page.tsx`** — Server component. Fetches players, teams, and saved prediction/previous-team orders. Passes everything to `TeamsPageClient`.

### Components

- **`frontend/components/teams/teams-page-client.tsx`** — Parent client component. Manages `activeView` state ("predictions" | "previous"), debounced save callbacks for both views, and the long-press menu. Renders `ViewToggle`, an instruction line, then either `PredictionBoard` or `PreviousTeamsView`.

- **`frontend/components/teams/view-toggle.tsx`** — Two-button toggle ("Predictions" / "Previous Teams"). Styled with `.view-toggle`, `.view-toggle-btn`, `.view-toggle-btn-active` classes in `globals.css`.

- **`frontend/components/teams/prediction-board.tsx`** — Splits players into official (made_team with team_id) and predicted. Predicted players are distributed across team sections using position caps (F:9, D:6, G:2). Uses `enforcePositionGroups()` to maintain F→D→G grouping after drags. Default sort: `sortByPreviousTeam()`. Saved order applied via `applyOrder()`.

- **`frontend/components/teams/previous-teams-view.tsx`** — Groups players by `previous_team` value. Each group is a `PreviousTeamSection` with DnD. Default sort: `sortByPositionThenJersey()`. Uses `enforcePositionGroups()` after drags. Saved order applied via `applyOrder()`.

- **`frontend/components/teams/team-section.tsx`** — Renders a single team's roster with a collapsible header and `SortableContext`. Used by PredictionBoard.

- **`frontend/components/teams/player-row.tsx`** — Sortable player row using `useSortable`.

### Server Actions

- **`frontend/app/(app)/teams/actions.ts`** — `savePredictionOrder(associationId, division, playerOrder)` upserts to `player_predictions`. `savePreviousTeamOrder(associationId, previousTeam, playerOrder)` upserts to `previous_team_orders`.

### Database

- **`player_predictions`** — Stores `player_order: uuid[]` keyed by `(user_id, association_id, division)`.
- **`previous_team_orders`** — Stores `player_order: uuid[]` keyed by `(user_id, association_id, previous_team)`.

### Styles

- `.view-toggle` — `@apply mx-5 my-3 flex rounded-2xl p-0.5` with semi-transparent background and border.
- `.view-toggle-btn` / `.view-toggle-btn-active` — Rounded pill buttons. Active state uses `var(--dm-cinnabar)` background with dark text.
- `.instruction-line` — `@apply px-5 pb-3 pt-1 text-center text-xs italic` with `color: var(--dm-dust)`.

### Types

- **`frontend/types/index.ts`** — `TryoutPlayer` has `position?: string | null` (values: "F", "D", "G", or null/"?").

## Changes Required

### Database

No database changes needed. The existing `player_predictions` and `previous_team_orders` tables are used as-is.

### Server Actions / API Routes

**Modify `frontend/app/(app)/teams/actions.ts`:**

Add two new server actions:

- `resetPredictionOrders(associationId: string): Promise<{ error?: string }>` — Deletes all rows from `player_predictions` where `user_id` matches the authenticated user and `association_id` matches. Used when "All" is selected and Reset is tapped in the Predictions view.

- `resetPreviousTeamOrders(associationId: string): Promise<{ error?: string }>` — Deletes all rows from `previous_team_orders` where `user_id` matches the authenticated user and `association_id` matches. Used when "All" is selected and Reset is tapped in the Previous Teams view.

These follow the same auth pattern as the existing save actions (get user, check auth, operate on table).

### Pages

No page changes needed. All logic is in client components.

### Components

**Create `frontend/components/teams/position-filter.tsx`:**

A row of filter chips: All, F, D, G, and a Reset button on the far right.

Props:
- `activePosition: string | null` — null means "All" is selected. "F", "D", or "G" for a specific position.
- `onPositionChange: (position: string | null) => void` — Called when a chip is tapped. Pass null for "All".
- `onReset: () => void` — Called when the Reset button is tapped.

Behavior:
- Exactly one chip is active at a time (All is default).
- Tapping the already-active chip does nothing.
- The Reset button is always visible. It uses a distinct style (not a position chip) — a text button or icon on the far right.

**Modify `frontend/components/teams/teams-page-client.tsx`:**

- Add `activePosition` state: `useState<string | null>(null)`.
- Import and render `PositionFilter` between `ViewToggle` and the instruction line.
- Compute `filteredPlayers` from `players` based on `activePosition`. If null, pass all players. If "F"/"D"/"G", filter to only players with that position.
- Pass `filteredPlayers` (instead of `players`) to both `PredictionBoard` and `PreviousTeamsView`.
- Add `handleReset` callback:
  - If `activePosition` is null (All is selected):
    - If `activeView` is "predictions": call `resetPredictionOrders(associationId)`, then reset `PredictionBoard` state to defaults. To trigger this, pass a `resetKey` prop (a counter) that increments on reset, causing the child to re-initialize its state from defaults.
    - If `activeView` is "previous": call `resetPreviousTeamOrders(associationId)`, then reset `PreviousTeamsView` state to defaults via the same `resetKey` pattern.
  - If `activePosition` is "F", "D", or "G":
    - The reset recalculates the order for the active view by re-sorting only the players of the selected position back to their default positions, while preserving the order of other positions.
    - For Predictions view: for each division's order array, extract players of the selected position, re-sort them by `previousTeamRank` (the default), then reinsert them at their position-group boundaries. Save each updated order via `savePredictionOrder`.
    - For Previous Teams view: for each group's order array, extract players of the selected position, re-sort them by jersey number (the default within position groups), then reinsert them. Save each updated order via `savePreviousTeamOrder`.
    - After recalculating, trigger state re-initialization via `resetKey`.
- Pass `resetKey` as a prop to both `PredictionBoard` and `PreviousTeamsView`.

**Modify `frontend/components/teams/prediction-board.tsx`:**

- Add `resetKey?: number` prop.
- Include `resetKey` in the dependency of the `useState` initializer for `predictedOrders`. When `resetKey` changes, re-run the initialization logic (recompute from `savedOrders` or defaults). Use a `useEffect` that watches `resetKey` and resets state, or use `key={resetKey}` on the component from the parent to force remount.

**Modify `frontend/components/teams/previous-teams-view.tsx`:**

- Add `resetKey?: number` prop.
- Same pattern as PredictionBoard — when `resetKey` changes, re-initialize `orderedGroups` from saved orders or defaults.

### Styles

**Add to `frontend/app/globals.css`:**

- `.position-filter` — Container for the chips row. Horizontal flex layout with gap, horizontally aligned with the view toggle (same horizontal padding). Vertically placed between the view toggle and instruction line.
- `.position-chip` — Inactive chip style. Similar to `.view-toggle-btn` but smaller — pill-shaped, semi-transparent background, dust-colored text.
- `.position-chip-active` — Active chip. Same accent treatment as `.view-toggle-btn-active` (cinnabar background, dark text).
- `.position-reset-btn` — Reset button on far right. Text-only or with a small icon. Uses `margin-left: auto` to push it to the right. Subtle styling — not a primary action. Consider `var(--dm-dust)` color with a slightly smaller font size.

## Key Implementation Details

**Filtering is purely visual.** The filter controls which players are rendered, but the underlying saved order arrays always contain all players. When `filteredPlayers` is passed to PredictionBoard/PreviousTeamsView, those components operate on the filtered set. When saving order changes, only the visible (filtered) players' IDs are in the order array — but this is fine because `applyOrder()` already handles missing players by appending them at the end.

**Reset for "All" is a delete operation.** Deleting saved orders from the database means the next initialization will use default sort (by previous_team rank for Predictions, by position+jersey for Previous Teams). This is the simplest approach.

**Reset for a specific position is a client-side recalculation.** The approach:
1. For each order group (division or previous_team), take the current ordered player array.
2. Separate players into two buckets: (a) players matching the reset position, (b) all others.
3. Re-sort bucket (a) by the view's default sort (previous_team rank for Predictions, jersey number for Previous Teams).
4. Reconstruct the full array by replacing the position group in-place — the position group's slot in the array (determined by `enforcePositionGroups` ordering: F=0, D=1, G=2, ?=3) gets the re-sorted players, while other position groups keep their existing order.
5. Save the new order via the existing save action.

**Use `key` prop for remount on reset.** The simplest way to re-initialize PredictionBoard and PreviousTeamsView after a reset is to change their React `key` prop. When the key changes, React unmounts and remounts the component, triggering a fresh `useState` initialization. The parent passes `key={resetKey}` and increments `resetKey` on reset. The child components do NOT need a `resetKey` prop — just the `key` on the JSX element.

**Instruction line update.** When a position filter is active (not "All"), update the instruction line text to reflect the filter. For example: "Showing forwards only — drag to&nbsp;reorder" instead of the generic "Drag players up and down between&nbsp;teams". When "All" is active, show the original text.

**No new dependencies.** Everything uses existing React state and the existing DnD infrastructure.

## Acceptance Criteria

- [ ] Position filter chips (All / F / D / G) appear between the view toggle and instruction line
- [ ] "All" is selected by default on page load
- [ ] Tapping F shows only forwards in both Predictions and Previous Teams views
- [ ] Tapping D shows only defensemen in both views
- [ ] Tapping G shows only goalies in both views
- [ ] Tapping All shows all players (returns to unfiltered state)
- [ ] Only one chip is active at a time
- [ ] Reset button appears on the far right of the filter row
- [ ] Reset with "All" selected deletes all saved prediction orders for the active view and reverts to default sort
- [ ] Reset with "F" selected re-sorts only forwards to their default positions while preserving D/G order
- [ ] Reset with "D" selected re-sorts only defensemen to their default positions while preserving F/G order
- [ ] Reset with "G" selected re-sorts only goalies to their default positions while preserving F/D order
- [ ] After reset, the view immediately reflects the new order without page reload
- [ ] Drag-and-drop still works when a position filter is active
- [ ] Switching between Predictions and Previous Teams preserves the active position filter
- [ ] Filter resets to "All" on page reload (no persistence)
- [ ] Instruction line text updates when a position filter is active
- [ ] No semicolons in any new or modified files
- [ ] All multi-class styles use `@apply` in `globals.css`
- [ ] Build passes (`cd frontend && npm run build`)
- [ ] No lint errors (`cd frontend && npm run lint`)

## Playwright Test Plan

Step-by-step browser tests to verify every variation of this feature. Each test should be runnable via the Playwright MCP browser tools (navigate, snapshot, click, type, etc.) by a Claude Code session.

**Setup:** Log in with a test account that belongs to the Nepean Wildcats association (join code: NGHA2026). Navigate to `/teams`. The association has 131 U15 players with positions F, D, and G. The default view is "Predictions".

### Test 1: Filter chips render correctly on page load
1. Navigate to `/teams`
2. Take a snapshot of the page
3. **Verify:** Four filter chips are visible: "All", "F", "D", "G". A "Reset" button is visible to the right of the chips. "All" chip has the active style (cinnabar background). The chips appear between the view toggle and the instruction line.

### Test 2: Filter to Forwards only (Predictions view)
1. Navigate to `/teams` (Predictions view is default)
2. Click the "F" chip
3. Take a snapshot
4. **Verify:** "F" chip now has active style, "All" chip is inactive. Every visible player row shows "F" as their position badge. No "D" or "G" players are visible. Team section headers are still visible (even if some teams have no forwards, their headers may be hidden or show empty — verify either behavior is consistent).

### Test 3: Filter to Defense only (Predictions view)
1. Click the "D" chip
2. Take a snapshot
3. **Verify:** "D" chip is active. Only defensemen are shown in each team section. No forwards or goalies visible.

### Test 4: Filter to Goalies only (Predictions view)
1. Click the "G" chip
2. Take a snapshot
3. **Verify:** "G" chip is active. Only goalies are shown. Since there are only 2 goalies per team, sections should have very few players each.

### Test 5: Return to All
1. Click the "All" chip
2. Take a snapshot
3. **Verify:** "All" chip is active. All players are visible again across all team sections. Player count matches the unfiltered state.

### Test 6: Filter persists when switching views
1. Click the "F" chip (filter to forwards)
2. Click the "Previous Teams" toggle
3. Take a snapshot
4. **Verify:** In Previous Teams view, only forwards are shown in each previous-team group. "F" chip remains active.
5. Click the "Predictions" toggle
6. Take a snapshot
7. **Verify:** Back in Predictions view, still only forwards visible. "F" chip still active.

### Test 7: Filter works in Previous Teams view
1. Click the "Previous Teams" toggle
2. Click the "D" chip
3. Take a snapshot
4. **Verify:** Each previous-team group (e.g., "From U15AA", "From U15A") shows only defensemen. Player counts in section headers reflect the filtered count.

### Test 8: Drag-and-drop works with filter active (Predictions view)
1. Click the "Predictions" toggle
2. Click the "F" chip (filter to forwards)
3. Identify two forward players in the same team section
4. Drag the second player above the first
5. Take a snapshot
6. **Verify:** The two players have swapped order. The drag completed successfully. After switching back to "All", the forward's new position is preserved while D and G players remain in their original positions.

### Test 9: Drag-and-drop works with filter active (Previous Teams view)
1. Click the "Previous Teams" toggle
2. Click the "D" chip (filter to defense)
3. Drag a defenseman within a previous-team group
4. Take a snapshot
5. **Verify:** The drag completed successfully and the defenseman's new position is preserved.

### Test 10: Reset with "All" selected (Predictions view)
1. Click the "Predictions" toggle
2. Click the "All" chip (ensure All is active)
3. Drag a few players to create custom order
4. Click the "Reset" button
5. Take a snapshot
6. **Verify:** All players revert to their default sort order (by previous_team rank within each team section). The custom drag order is gone.
7. Reload the page
8. **Verify:** The default order persists after reload (saved orders were deleted from DB).

### Test 11: Reset with "F" selected (Predictions view)
1. Click the "F" chip
2. Drag some forwards to rearrange them
3. Click "All" to see full roster, note the positions of D and G players
4. Click "F" again
5. Click the "Reset" button
6. Click "All"
7. Take a snapshot
8. **Verify:** Forwards are back in their default sort order. Defensemen and goalies remain in their previously saved positions (unchanged by the reset).

### Test 12: Reset with "All" selected (Previous Teams view)
1. Click the "Previous Teams" toggle
2. Click the "All" chip
3. Drag players within a group to create custom order
4. Click "Reset"
5. Take a snapshot
6. **Verify:** All groups show players in default sort order (position F→D→G, then jersey number within position).
7. Reload the page
8. **Verify:** Default order persists (saved orders deleted from DB).

### Test 13: Reset with specific position (Previous Teams view)
1. Click the "Previous Teams" toggle
2. Click the "G" chip
3. Drag goalies to rearrange within a group
4. Click "Reset"
5. Click "All"
6. Take a snapshot
7. **Verify:** Goalies are back in default order (by jersey number). Forwards and defensemen retain their custom order.

### Test 14: Instruction line updates with filter
1. Click the "F" chip
2. Take a snapshot
3. **Verify:** The instruction line text changes to reflect the active filter (not the generic "Drag players up and down between teams").
4. Click "All"
5. **Verify:** Instruction line returns to the original generic text.

### Test 15: Filter resets on page reload
1. Click the "D" chip (filter to defense)
2. Reload the page (`/teams`)
3. Take a snapshot
4. **Verify:** "All" chip is active (filter did not persist). All players are visible.

### Test 16: Mobile viewport
1. Resize browser to 393px width (phone frame)
2. Navigate to `/teams`
3. Take a snapshot
4. **Verify:** Position filter chips fit within the viewport width without horizontal overflow. All four chips and the Reset button are visible and tappable. Chips don't wrap to a second line.

### Test 17: Empty state after filter
1. If there are players with no position (null/"?"), click each chip to verify they only appear when "All" is selected (or define which chip shows them)
2. **Verify:** Players with unknown position appear under "All" but not under F, D, or G. If all players of a position are filtered out, team sections either hide or show empty gracefully.

**Coverage checklist:**
- [x] **Happy path** — filter to each position, see correct players (Tests 2–5)
- [x] **Empty state** — teams with no players of filtered position (Test 17)
- [x] **Boundary cases** — unknown position players (Test 17)
- [x] **Role variations** — N/A (all members see the same filter; no role-specific behavior)
- [x] **Mobile vs. desktop** — phone frame layout (Test 16)
- [x] **Persistence** — filter does NOT persist across reloads (Test 15); reset deletes saved orders from DB (Tests 10, 12)
- [x] **Interaction combos** — filter + view switch (Test 6), filter + drag (Tests 8–9), filter + reset + verify other positions unchanged (Tests 11, 13)

**Goal:** After running every test above, there should be zero need for manual QA. If a scenario isn't covered here, it won't be caught.

## Files to Touch

1. `frontend/app/(app)/teams/actions.ts` — **MODIFY** — add `resetPredictionOrders` and `resetPreviousTeamOrders` server actions
2. `frontend/components/teams/position-filter.tsx` — **CREATE** — new component with All/F/D/G chips + Reset button
3. `frontend/components/teams/teams-page-client.tsx` — **MODIFY** — add position filter state, compute filtered players, handle reset, render PositionFilter, pass `key` to child views
4. `frontend/components/teams/prediction-board.tsx` — **MODIFY** — no code changes needed if parent uses `key` prop for remount
5. `frontend/components/teams/previous-teams-view.tsx` — **MODIFY** — no code changes needed if parent uses `key` prop for remount
6. `frontend/app/globals.css` — **MODIFY** — add `.position-filter`, `.position-chip`, `.position-chip-active`, `.position-reset-btn` styles
