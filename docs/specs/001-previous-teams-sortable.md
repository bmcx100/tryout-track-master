# Spec 001: Previous Teams Drag-and-Drop Sorting

**PRD Reference:** Enhances FR-015 (team projections)
**Priority:** Must Have
**Depends on:** None

## What This Feature Does

The Previous Teams view on the Teams page currently displays players in static, non-reorderable groups. This spec adds drag-and-drop reordering **within** each previous-team group (e.g., "From U15AA"), matching the interaction model already used in the Predictions view. The default sort within each group is by position (F → D → G), then by jersey number within each position. Drag-and-drop reorders players within their position subgroup. If a player is dragged across a position boundary, they snap to the top or bottom of their position subgroup in that team. The user's custom order is saved to the database and restored on next visit.

## Current State

### Components

- **`frontend/components/teams/previous-teams-view.tsx`** — Groups players by `previous_team` field using a `Map`. Each group renders a `PreviousTeamSection` with a collapsible header and static player rows (plain `<div>` elements, NOT using the `PlayerRow` component). No DnD support. No sort logic — players render in whatever order the Map produces.

- **`frontend/components/teams/prediction-board.tsx`** — The Predictions view. Uses `@dnd-kit/core` with `DndContext`, `PointerSensor`, `TouchSensor`. Uses `@dnd-kit/sortable` with `SortableContext` and `arrayMove`. Has helper functions: `sortByPosition()` (F→D→G), `sortByPreviousTeam()` (tier rank). Manages `predictedOrders` state as `Record<string, TryoutPlayer[]>`. Persists order via `onOrderChange` callback debounced in the parent.

- **`frontend/components/teams/team-section.tsx`** — Used by PredictionBoard. Wraps players in a `SortableContext` with `verticalListSortingStrategy`. Uses `PlayerRow` component for each player.

- **`frontend/components/teams/player-row.tsx`** — Sortable player row using `useSortable` from `@dnd-kit/sortable`. Shows grip handle (or check icon if locked), jersey number, position badge, name, previous team badge.

- **`frontend/components/teams/teams-page-client.tsx`** — Parent component. Manages `activeView` state ("predictions" | "previous"), DnD save debounce via `saveTimers` ref, calls `savePredictionOrder` server action.

### Server Action

- **`frontend/app/(app)/teams/actions.ts`** — `savePredictionOrder(associationId, division, playerOrder)` upserts to `player_predictions` table keyed by `(user_id, association_id, division)`.

### Database

- **`player_predictions`** table — Stores ordered arrays of player UUIDs keyed by `(user_id, association_id, division)`. RLS: users can only read/write their own rows.

### Page

- **`frontend/app/(app)/teams/page.tsx`** — Server component. Fetches all players, teams, and the user's saved predictions (queried by division). Passes `savedOrders: Record<string, string[]>` to `TeamsPageClient`.

### Types

- **`frontend/types/index.ts`** — `TryoutPlayer` has `position?: string | null` and `previous_team?: string | null`.

## Changes Required

### Database

**New migration: `backend/supabase/migrations/20260420000001_create_previous_team_orders.sql`**

Create a `previous_team_orders` table to persist the user's sort order within each previous-team group. Structure mirrors `player_predictions` but is keyed by `previous_team` instead of `division`:

```
previous_team_orders (
  id uuid PK DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations ON DELETE CASCADE,
  previous_team text NOT NULL,           -- e.g., "U15AA", "U13A"
  player_order uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, previous_team)
)
```

- Enable RLS.
- Policies mirror `player_predictions`: users can CRUD their own rows, INSERT requires `user_belongs_to_association(association_id)`.
- Add `update_updated_at` trigger.
- Add index on `(user_id, association_id, previous_team)`.

### Server Actions / API Routes

**Modify `frontend/app/(app)/teams/actions.ts`:**

Add `savePreviousTeamOrder(associationId: string, previousTeam: string, playerOrder: string[]): Promise<{ error?: string }>` — upserts to `previous_team_orders` table. Same pattern as `savePredictionOrder` but uses `previous_team` instead of `division` and targets the new table.

### Pages

**Modify `frontend/app/(app)/teams/page.tsx`:**

- Add a query for `previous_team_orders` filtered by `user_id` and `association_id`.
- Build a `savedPreviousOrders: Record<string, string[]>` map (keyed by `previous_team` value).
- Pass `savedPreviousOrders` as a new prop to `TeamsPageClient`.

### Components

**Modify `frontend/components/teams/teams-page-client.tsx`:**

- Accept new prop `savedPreviousOrders: Record<string, string[]>`.
- Add a `savePreviousTimers` ref (same debounce pattern as `saveTimers`).
- Add `handlePreviousOrderChange(previousTeam: string, playerIds: string[])` callback — debounces and calls `savePreviousTeamOrder` server action.
- Pass `savedPreviousOrders` and `onOrderChange={handlePreviousOrderChange}` to `PreviousTeamsView`.

**Modify `frontend/components/teams/previous-teams-view.tsx`:**

This is the largest change. The component needs to go from static lists to DnD-sortable lists.

- **Add props:** `savedOrders: Record<string, string[]>`, `onOrderChange?: (previousTeam: string, playerIds: string[]) => void`, `onPlayerLongPress?: (player: TryoutPlayer) => void`.
- **Add DnD context:** Wrap the entire view in a `DndContext` with `PointerSensor` and `TouchSensor` (same sensor config as `PredictionBoard`).
- **Add default sort function:** `sortByPositionThenJersey(players: TryoutPlayer[]): TryoutPlayer[]` — groups by position (F=0, D=1, G=2, ?/null=3), then sorts by jersey number within each position group.
- **Add order state:** `useState<Record<string, TryoutPlayer[]>>` initialized from `savedOrders` (apply saved order) or default sort.
- **DnD constraint:** Drag-and-drop reorders within a single previous-team group. If `active` and `over` belong to different groups, ignore the drag.
- **Position boundary enforcement:** After `arrayMove`, re-sort so that position groups stay together. If a player was moved across position boundaries, place them at the start or end of their position subgroup (whichever is closer to the drop position).
- **Replace inline player rows** with the existing `PlayerRow` component wrapped in `SortableContext` (same pattern as `TeamSection`).

**Modify `frontend/components/teams/team-section.tsx`:** (optional)

Consider extracting the `SortableContext` + `PlayerRow` rendering into a shared pattern, OR just replicate the pattern in `PreviousTeamSection`. Replicating is simpler — prefer that.

### Styles

No new CSS classes needed. The Previous Teams view already uses `.team-header`, `.player-row`, and related classes. Adding DnD uses the same visual patterns already established in the Predictions view.

## Key Implementation Details

**Position-boundary snapping logic:**

When `handleDragEnd` fires, after performing `arrayMove`, run a re-sort pass that:
1. Groups the reordered array by position (F, D, G, unknown).
2. Preserves the relative order of players within each position group as determined by the drag.
3. Concatenates the groups back together in position order (F → D → G → unknown).

This ensures dragging a forward into the defensemen section doesn't break position grouping — the forward snaps to the bottom of the forwards group (or top of the next group boundary).

**Saved order application:**

When `savedOrders[previousTeam]` exists, apply it the same way `PredictionBoard.applyOrder` does: iterate the saved ID array, pull matching players from the pool, then append any remaining players not in the saved order. After applying saved order, do NOT re-sort by position — the saved order is the user's intentional arrangement and should be respected as-is.

**Player-to-group lookup:**

Build a `Map<string, string>` mapping player ID → previous_team group. Use this in `handleDragEnd` to verify both `active` and `over` belong to the same group before processing the move.

**Existing DnD packages:** `@dnd-kit/core` and `@dnd-kit/sortable` are already installed. No new dependencies needed.

**RLS on new table:** Follow the exact same policy pattern as `player_predictions` — users can only access their own rows, insert requires association membership.

## Acceptance Criteria

- [ ] Previous Teams view groups players by `previous_team` value (unchanged behavior)
- [ ] Within each group, players are sorted by position (F → D → G → unknown), then by jersey number within each position
- [ ] Players can be dragged to reorder within a previous-team group
- [ ] Players cannot be dragged between different previous-team groups
- [ ] Dragging a player across a position boundary snaps them to the edge of their position subgroup
- [ ] The `PlayerRow` component is used for player rendering (replacing the current inline `<div>` rows)
- [ ] Grip handle appears on each player row (same as Predictions view)
- [ ] User's custom order is saved to `previous_team_orders` table after a 1-second debounce
- [ ] Saved order is restored when the user returns to the page
- [ ] New `previous_team_orders` table has RLS enabled with correct policies
- [ ] Long-press / right-click on a player opens the `LongPressMenu` (same as Predictions view)
- [ ] No semicolons in any new or modified files
- [ ] All multi-class styles use `@apply` in `globals.css`
- [ ] Build passes (`cd frontend && npm run build`)
- [ ] No lint errors (`cd frontend && npm run lint`)

## Files to Touch

1. `backend/supabase/migrations/20260420000001_create_previous_team_orders.sql` — **CREATE** — new table + RLS + trigger + index
2. `frontend/app/(app)/teams/actions.ts` — **MODIFY** — add `savePreviousTeamOrder` server action
3. `frontend/app/(app)/teams/page.tsx` — **MODIFY** — fetch `previous_team_orders`, pass as prop
4. `frontend/components/teams/teams-page-client.tsx` — **MODIFY** — accept new prop, add debounced save handler, pass to PreviousTeamsView
5. `frontend/components/teams/previous-teams-view.tsx` — **MODIFY** — add DnD context, sortable lists, default sort, order state, position-boundary logic, use `PlayerRow` component
