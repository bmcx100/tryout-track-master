# Spec 016: Sessions Position Filter & Draggable Sorting

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** 003 (Continuations tracker), 002 (Position filter)

## What This Feature Does

Adds two features to the Sessions (Continuations) page that already exist on the Teams page: (1) a position filter bar with All/F/D/G/? chips for filtering players by position, and (2) drag-and-drop reordering of players in the Continuing view. Custom drag orders are persisted per round so they survive page reloads. The Cuts view remains non-draggable with fixed sort order.

## Current State

### Sessions page (what exists today)

- **Server page:** `frontend/app/(app)/continuations/page.tsx` fetches players, published rounds, and annotations, then renders `ContinuationsPageClient`.
- **Client component:** `frontend/components/continuations/continuations-page-client.tsx` manages state for round selection, active view (continuing/cuts), annotations, long-press menu, player linking.
- **Round section:** `frontend/components/continuations/round-section.tsx` renders the player lists. In continuing view, players are grouped by session (collapsible sections) or shown as a flat list. Players are sorted by `sortByPositionThenTeam()` (position rank F=0, D=1, G=2, unknown=99, then blended team rank). In cuts view, same sort, no sessions.
- **Player row:** `frontend/components/continuations/continuation-player-row.tsx` displays jersey, position badge, heart, name, notes icon, IP badge, previous team. Has long-press (500ms) for detail sheet. No drag support.
- **Toggle:** `frontend/components/continuations/sessions-toggle.tsx` toggles between "Continuing" and "Cuts" views.
- **Server actions:** `frontend/app/(app)/continuations/actions.ts` has `getAllPublishedRounds`, `toggleFavorite`, `savePlayerNote`, `linkUnknownPlayer`, etc.
- **No position filter exists on the Sessions page.**
- **No drag-and-drop exists on the Sessions page.**
- **No `continuation_orders` table exists in the database.**

### Teams page (patterns to port from)

- **Position filter:** `frontend/components/teams/position-filter.tsx` renders All/F/D/G pills with animated background pill and reset button. Takes `activePosition`, `onPositionChange`, `onReset`, `isResetting`, `hasCustomOrder` props.
- **Drag sorting:** Uses `@dnd-kit/core` and `@dnd-kit/sortable` in `previous-teams-view.tsx` and `prediction-board.tsx`. Sensors: PointerSensor (8px distance), TouchSensor (200ms delay, 5px tolerance). Cross-position drag logic: drop on higher position group = insert at top of own group; drop on lower = insert at bottom.
- **Player row:** `frontend/components/teams/player-row.tsx` uses `useSortable` hook from `@dnd-kit/sortable`, with drag handle via `listeners` and `attributes` spread.
- **Order persistence:** `frontend/app/(app)/teams/actions.ts` has `savePreviousTeamOrder` (upserts to `previous_team_orders` table keyed by `user_id + association_id + previous_team`) with debounced save on client.
- **CSS:** Position filter styles in `frontend/app/globals.css` (`.position-filter`, `.position-filter-track`, `.position-filter-pill`, `.position-chip`, `.position-reset-btn`, `.reset-spin`).

### Key data model consideration

The Sessions page identifies players by **jersey number** (not player UUID), because some jersey numbers are "unknown" (no matching player record in the database). The Teams page uses player UUIDs for its order arrays. The continuation order table must store **jersey numbers (text[])** rather than UUIDs to support reordering unknown players.

## Changes Required

### Database

**New migration:** `backend/supabase/migrations/YYYYMMDDHHMMSS_create_continuation_orders.sql`

Create `continuation_orders` table:

```
continuation_orders
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid NOT NULL FK -> auth.users(id) ON DELETE CASCADE
  round_id        uuid NOT NULL FK -> continuation_rounds(id) ON DELETE CASCADE
  player_order    text[] NOT NULL DEFAULT '{}'    -- jersey numbers, not UUIDs
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
  UNIQUE (user_id, round_id)
```

RLS policies (same pattern as `player_predictions` and `previous_team_orders`):
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

Auto-update `updated_at` trigger (same as other order tables).

Index on `(user_id, round_id)` for fast lookup.

### Server Actions / API Routes

**Add to `frontend/app/(app)/continuations/actions.ts`:**

- `saveContinuationOrder(roundId: string, playerOrder: string[]): Promise<{ error?: string }>` — Upsert a row in `continuation_orders` for the current user + round. `playerOrder` is an array of jersey number strings.

- `resetContinuationOrder(roundId: string): Promise<{ error?: string }>` — Delete the user's saved order for the given round.

- `getContinuationOrders(roundIds: string[]): Promise<Record<string, string[]>>` — Fetch saved orders for the current user across multiple rounds. Returns a map of `roundId -> jersey number order`. Called from the server page to pass initial orders as props.

### Pages

**Modify `frontend/app/(app)/continuations/page.tsx`:**

- After fetching rounds, call `getContinuationOrders()` with the round IDs to get the user's saved orders.
- Pass `savedOrders` as a new prop to `ContinuationsPageClient`.

### Components

**Extend `frontend/components/teams/position-filter.tsx`:**

- Add an optional `showUnknown?: boolean` prop (default `false`).
- When `showUnknown` is true, append `{ label: "?", value: "?" }` to the positions array.
- The "?" chip matches players with `position === null` or `position === "?"`.
- Add an optional `positionCounts?: Record<string, number>` prop. When provided, position chips (except "All") display the count — e.g. `F (14)`, `D (7)`, `G (3)`. The "?" chip is hidden entirely when its count is 0.

*[Added after initial implementation]*

**Modify `frontend/components/continuations/continuations-page-client.tsx`:**

- Import `PositionFilter` from `@/components/teams/position-filter`.
- Add state: `activePosition` (string | null, default null), `isResetting` (boolean), `currentOrders` (Record<string, string[]>, initialized from `savedOrders` prop).
- Compute `positionCounts` from the active round's jersey numbers and player positions.
- Render `PositionFilter` between `SessionsToggle` and `RoundSection` with `showUnknown={true}` and `positionCounts`.
- Pass `activePosition` as `positionFilter` to `RoundSection`.
- Pass `savedOrder` for the active round from `currentOrders` to `RoundSection`.
- Add `handleOrderChange(roundId, newOrder)` callback that updates `currentOrders` state and debounce-saves via `saveContinuationOrder`.
- Add `handleReset()` that calls `resetContinuationOrder` for the active round, clears the order from `currentOrders`, and triggers the spin animation.
- Compute `hasCustomOrder` from whether `currentOrders[activeRound.id]` exists and is non-empty.
- Reset `activePosition` to null when round selection changes.

**Modify `frontend/components/continuations/round-section.tsx`:**

- Add props: `positionFilter?: string | null`, `savedOrder?: string[]`, `onOrderChange?: (jerseyNumbers: string[]) => void`.
- Import `DndContext`, `closestCenter`, `PointerSensor`, `TouchSensor`, `useSensor`, `useSensors` from `@dnd-kit/core`.
- Import `SortableContext`, `verticalListSortingStrategy`, `arrayMove` from `@dnd-kit/sortable`.
- In continuing view: wrap each session's player list (and the flat list) in `DndContext` + `SortableContext`.
- When `savedOrder` is provided, use it to sort players (respecting the saved order while placing new players at the end in default position sort). When no saved order, use the existing `sortByPositionThenTeam` default.
- Add drag-end handler with same cross-position logic as `previous-teams-view.tsx`:
  - Same-position drags: `arrayMove` + `enforcePositionGroups`
  - Cross-position drags: insert at top (overshoot up) or bottom (overshoot down) of position group
- After drag, call `onOrderChange` with the new jersey number order for the entire round (all sessions combined into one flat order).
- Apply `positionFilter` at display level after ordering (same as Teams page): filter player entries to only show matching positions. For the "?" filter value, match players where `player?.position` is null or "?".
- Cuts view: no drag context, no position filter (always show all, fixed sort).

**Modify `frontend/components/continuations/continuation-player-row.tsx`:**

- Import `useSortable` and `CSS` from `@dnd-kit/sortable`.
- Add optional prop `sortableId?: string` (jersey number). When provided, the row becomes draggable.
- When `sortableId` is set, call `useSortable({ id: sortableId })` and spread `attributes`/`listeners` on the row div, apply `transform`/`transition` styles, reduce opacity when `isDragging`.
- When `sortableId` is not set (cuts view, or non-sortable contexts), behavior is unchanged.
- The existing long-press handler (500ms) coexists with drag because the TouchSensor has a 200ms delay — drag activates before long-press fires. If the user holds still for 500ms without moving 5px, the long-press fires instead.

### Styles

**Add to `frontend/app/globals.css`:**

No new position filter styles needed (reuses existing `.position-filter` classes).

Add drag-related styles for continuation rows:
- `.continuation-player-row` already has `user-select: none` which is good for drag.
- Add `.continuation-player-row-dragging` class with reduced opacity (0.5) for the dragged item — or handle via inline style from `useSortable` (same as Teams page `player-row.tsx`).

## Key Implementation Details

1. **Jersey numbers as sort IDs.** The dnd-kit `SortableContext` `items` array and `useSortable` `id` must use jersey numbers (strings), not player UUIDs. This is because unknown players (no matching DB record) still need to be draggable. Jersey numbers are unique within a round.

2. **Order applies per-round, rendered per-session.** One saved order per round (flat list of all jersey numbers). When the round has sessions, each session filters the saved order to only its jersey numbers, preserving the relative order. This means dragging within session 1 can change the relative order of players who also appear in session 2 (if there's overlap) — but in practice, sessions within a round typically have the same player set or disjoint subsets.

3. **Position filter "?" matching.** The "?" chip must match players where `player` is null (truly unknown, not in DB) OR where `player.position` is null/undefined OR where `player.position === "?"`. This is different from the Teams page filter which only matches known positions.

4. **Debounce save.** Same 1000ms debounce pattern as the Teams page. Use a ref-based timer that resets on each drag.

5. **Reset clears per-round.** The reset button clears the saved order for the currently selected round only (not all rounds). This differs from the Teams page which resets all orders for the association.

6. **Sensor configuration.** Match the Teams page exactly: `PointerSensor` with 8px distance activation, `TouchSensor` with 200ms delay and 5px tolerance. This prevents accidental drags during scroll and allows long-press to coexist.

7. **Cross-position drag logic.** Copy the exact same logic from `previous-teams-view.tsx`. Position ranks: F=0, D=1, G=2, ?=3. When a player is dropped on a different position group, they move to the top (if they overshot up) or bottom (if they overshot down) of their own position group.

8. **Position filter placement.** The filter sits between the SessionsToggle and the RoundSection. It uses the same visual style as the Teams page filter (`.position-filter` classes). The "?" chip is the 5th option after G.

9. **Shared PositionFilter component.** The `showUnknown` prop is the only change to the existing component. The Teams page does not pass this prop (defaults to false), so its behavior is unchanged.

## Acceptance Criteria

- [ ] Position filter (All/F/D/G/?) appears below the Continuing/Cuts toggle on the Sessions page
- [ ] Clicking a position chip filters the player list to show only that position
- [ ] "?" filter shows players with null/unknown position
- [ ] "All" shows all players (default on page load)
- [ ] Players in the Continuing view can be dragged to reorder within each session section
- [ ] Cross-position drags work correctly (overshoot up = top, overshoot down = bottom)
- [ ] Drag order is saved to the database and restored on next visit
- [ ] Reset button clears custom order for the current round and spins
- [ ] Reset button turns red when a custom order exists for the current round
- [ ] Cuts view is NOT draggable (fixed sort order)
- [ ] Position filter applies to both Continuing and Cuts views (visual only)
- [ ] Switching rounds resets the position filter to "All"
- [ ] Long-press still opens the player detail sheet (coexists with drag)
- [ ] Unknown players (no DB match) can be dragged and their position is preserved in the order
- [ ] The Teams page position filter is unchanged (no "?" chip)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to the Sessions page (bottom nav "Sessions" tab). Ensure at least one published round exists with multiple players across positions.

### Test 1: Position filter renders with "?" chip
1. Navigate to `/continuations`
2. Take a snapshot of the page
3. **Verify:** Position filter bar appears below the Continuing/Cuts toggle with five chips: All, F, D, G, ?

### Test 2: Filter by F shows only forwards
1. Click the "F" chip
2. Take a snapshot
3. **Verify:** Only players with position "F" are visible. The "F" chip has the active pill behind it. Player count in session headers may change to reflect filtered count.

### Test 3: Filter by D shows only defensemen
1. Click the "D" chip
2. Take a snapshot
3. **Verify:** Only players with position "D" are visible.

### Test 4: Filter by G shows only goalies
1. Click the "G" chip
2. Take a snapshot
3. **Verify:** Only players with position "G" are visible.

### Test 5: Filter by "?" shows unknown positions
1. Click the "?" chip
2. Take a snapshot
3. **Verify:** Only players with no position (null/unknown) are visible. If none exist, an empty state or no player rows shown.

### Test 6: "All" shows all players
1. Click "F" first to filter, then click "All"
2. Take a snapshot
3. **Verify:** All players are visible again, same count as before filtering.

### Test 7: Position filter applies to Cuts view
1. Switch to "Cuts" view via the toggle
2. Click "F" chip
3. Take a snapshot
4. **Verify:** Only cut players with position "F" are shown.

### Test 8: Switching rounds resets filter to All
1. Switch to "F" filter
2. Change the round via the dropdown
3. Take a snapshot
4. **Verify:** Filter is back to "All", all players visible.

### Test 9: Drag a player within same position in Continuing view
1. Ensure filter is "All" and view is "Continuing"
2. Note the order of the first two F players in the first session
3. Drag the second F player above the first
4. Take a snapshot
5. **Verify:** The two players have swapped positions. Position grouping (F, D, G, ?) is maintained.

### Test 10: Cross-position drag (overshoot up)
1. Identify the first D player and the last F player in a session
2. Drag the D player onto the F player area
3. Take a snapshot
4. **Verify:** The D player moves to the TOP of the D group (not into the F group). F/D/G/? grouping is preserved.

### Test 11: Cross-position drag (overshoot down)
1. Identify an F player and a D player below
2. Drag the F player onto the D player area
3. Take a snapshot
4. **Verify:** The F player moves to the BOTTOM of the F group. Position grouping preserved.

### Test 12: Drag order persists after page reload
1. Drag a player to a new position (note the new order)
2. Wait 2 seconds (for debounce save)
3. Reload the page
4. Take a snapshot
5. **Verify:** The custom order is restored — players appear in the same order as before reload.

### Test 13: Reset button clears custom order
1. With a custom order saved (from Test 12), verify the reset button is red/active
2. Click the reset button
3. **Verify:** The button icon spins. Players return to default sort (position then team rank). The reset button dims.

### Test 14: Reset persists after reload
1. After resetting (Test 13), reload the page
2. Take a snapshot
3. **Verify:** Players still in default sort order (reset was persisted — order deleted from DB).

### Test 15: Cuts view is NOT draggable
1. Switch to "Cuts" view
2. Attempt to drag a player row
3. **Verify:** No drag behavior occurs. Players remain in fixed position-then-team sort.

### Test 16: Long-press still opens detail sheet
1. Switch back to "Continuing" view
2. Long-press (hold 500ms) on a known player
3. **Verify:** The player detail sheet opens (not a drag action).

### Test 17: Drag does not fire on short tap
1. Tap quickly on a player row (do not hold)
2. **Verify:** No drag starts, no detail sheet opens.

### Test 18: Teams page filter unchanged
1. Navigate to the Teams page
2. Take a snapshot of the position filter
3. **Verify:** Only four chips: All, F, D, G. No "?" chip visible.

### Test 19: Filter + drag interaction
1. Navigate back to Sessions, Continuing view
2. Set filter to "F"
3. Drag an F player to reorder
4. Switch filter to "All"
5. **Verify:** The drag reorder is preserved in the full list. F players are in the new order, D/G/? players unchanged.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 9 | Saved custom order for round (continuation_orders row) | Reset button (Test 13) |
| Test 10 | Updated custom order | Reset button |
| Test 11 | Updated custom order | Reset button |
| Test 12 | Saved custom order | Reset button |
| Test 13 | Deleted custom order | No revert needed (already clean) |

**After all tests pass, click the reset button on the Sessions page to ensure no custom orders remain. Confirm with the user that the data is clean.**

## Files to Touch

1. `backend/supabase/migrations/YYYYMMDDHHMMSS_create_continuation_orders.sql` — **CREATE** new migration
2. `frontend/components/teams/position-filter.tsx` — **MODIFY** add `showUnknown` prop
3. `frontend/components/continuations/continuations-page-client.tsx` — **MODIFY** add position filter, drag order state, reset handler
4. `frontend/components/continuations/round-section.tsx` — **MODIFY** add DndContext, SortableContext, drag handler, position filter, saved order support
5. `frontend/components/continuations/continuation-player-row.tsx` — **MODIFY** add useSortable support via `sortableId` prop
6. `frontend/app/(app)/continuations/page.tsx` — **MODIFY** fetch saved orders, pass as prop
7. `frontend/app/(app)/continuations/actions.ts` — **MODIFY** add saveContinuationOrder, resetContinuationOrder, getContinuationOrders
8. `frontend/app/globals.css` — **MODIFY** add any needed drag styles for continuation rows (if inline styles from useSortable are insufficient)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
