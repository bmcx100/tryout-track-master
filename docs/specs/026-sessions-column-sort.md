# Spec 026: Sessions Column Sort Header

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

The Sessions (Continuations) page gets a thin table-style header row positioned directly below the position filter. Each column label is clickable to sort players by that column. Clicking cycles through ascending, descending, and reset (default sort). Sorting and dragging are mutually exclusive modes: clicking a column sort clears any custom drag order, and dragging a player clears the active column sort. The sort header appears in both the Continuing and Cuts views.

## Current State

The Sessions page lives at `/continuations` and displays player rows from continuation rounds. Players are sorted by a default algorithm (position rank F > D > G > ?, then blended previous team rank, then jersey number) or by the user's saved drag order (stored in `continuation_orders` table). There is no column-based sorting.

### Key files:
- `frontend/components/continuations/continuations-page-client.tsx` — main client orchestrator, manages state for view/filter/orders
- `frontend/components/continuations/round-section.tsx` — builds player lists, handles drag-and-drop sorting, renders player rows per session
- `frontend/components/continuations/continuation-player-row.tsx` — individual player row with columns: drag handle, jersey, position, name, IP/NEW badges, note icon, heart icon, previous team
- `frontend/components/teams/position-filter.tsx` — All/F/D/G/? filter chips with reset button
- `frontend/app/globals.css` — all styles for the above components

### Current player row column layout (left to right):
1. Drag handle (`player-drag-handle`, width 1.5rem)
2. Jersey number (`player-jersey`, width 2.5rem / `w-10`)
3. Position badge (`player-position`, flex-shrink-0, ~30px)
4. Name (`player-name`, flex-1, truncated)
5. IP/NEW badges (inline, conditional)
6. Note icon (`note-btn`, width 1.25rem / `w-5`)
7. Heart icon (`favorite-btn`, width 1.25rem / `w-5`)
8. Previous team (`player-prev-team`, flex-shrink-0)

### Current sort state management:
- `currentOrders` state in `ContinuationsPageClient` tracks drag order per round (keyed by round ID)
- `RoundSection` receives `savedOrder` prop; if present, uses it; otherwise falls back to `sortByPositionThenTeam`
- Reset button in `PositionFilter` clears `currentOrders[roundId]` and deletes from DB
- `RoundSection` remounts on key change: `key={roundId}-${activeView}-${hasCustomOrder}`

## Changes Required

### Database
No database changes needed. Column sort is a client-only visual sort (not persisted). The existing `continuation_orders` table continues to store drag orders only.

### Server Actions / API Routes
No new server actions needed. When column sort is activated, it clears the saved drag order via the existing `resetContinuationOrder(roundId)` server action.

### Pages
No new pages. The sort header is added within the existing `/continuations` page.

### Components

#### New: `frontend/components/continuations/sort-header.tsx`

A thin header row that aligns with `ContinuationPlayerRow` columns. Each column label is clickable and shows an arrow indicator when active.

**Props:**
```
type SortColumn = "jersey" | "position" | "name" | "notes" | "favorite" | "prevTeam"
type SortDirection = "asc" | "desc"

type SortHeaderProps = {
  activeSort: { column: SortColumn, direction: SortDirection } | null
  onSort: (column: SortColumn, direction: SortDirection | null) => void
}
```

**Behavior:**
- Renders a single row with column labels aligned to `ContinuationPlayerRow`
- Column labels: (empty for drag handle slot) | `#` | `Pos` | `Name` | (empty for note) | (empty for heart) | `Team`
- The note and heart columns are clickable but have no visible text label — they sort by "has note" and "is favourite" respectively. Use a subtle icon or keep the header cell clickable but visually minimal.
- Click cycle per column: first click = ascending, second click on same column = descending, third click on same column = reset to null (default sort)
- Active sort column shows `▲` (ascending) or `▼` (descending) next to the label
- When `activeSort` is null, no arrows are shown

#### Modified: `frontend/components/continuations/round-section.tsx`

Add sort state and sort logic to `RoundSection`.

**New props:**
```
activeSort: { column: SortColumn, direction: SortDirection } | null
onSortChange: (sort: { column: SortColumn, direction: SortDirection } | null) => void
```

**Sort logic:** When `activeSort` is not null, apply column-based sorting INSTEAD of saved order or default sort. The sort functions:

| Column | Ascending | Descending |
|--------|-----------|------------|
| `jersey` | Numeric: 1, 2, 3... (parse as integer) | 99, 98, 97... |
| `position` | F (0) → D (1) → G (2) → ? (3) | ? (3) → G (2) → D (1) → F (0) |
| `name` | A → Z (case-insensitive, using `displayName` which respects customName) | Z → A |
| `notes` | Has note first, then no note | No note first, then has note |
| `favorite` | Favourites first, then non-favourites | Non-favourites first, then favourites |
| `prevTeam` | Existing tier ranking (AA first, using `getBlendedTeamRank`) | Reversed tier ranking |

**Secondary sort:** Within same-value groups (e.g., two players both with notes), use default sort (`sortByPositionThenTeam`) as tiebreaker.

**Session-based sorting:** When sessions exist, column sort applies WITHIN each session independently. Session headers remain visible. Players are sorted within their session group.

**Drag interaction:** When `handleDragEnd` fires and column sort is active, call `onSortChange(null)` to clear the column sort. The drag produces a new custom order and the sort header arrows disappear.

#### Modified: `frontend/components/continuations/continuations-page-client.tsx`

Add column sort state and integrate with the sort header.

**New state:**
```
const [activeSort, setActiveSort] = useState<{ column: SortColumn, direction: SortDirection } | null>(null)
```

**`handleSortChange` callback:**
- When a sort is activated (not null): clear `currentOrders[roundId]` from local state AND call `resetContinuationOrder(roundId)` to delete saved drag order from DB. This ensures sorting and dragging are mutually exclusive.
- When sort is reset to null: do nothing extra — user is back to default sort.

**`handleOrderChange` callback (existing):**
- Add: when called, also set `setActiveSort(null)` to clear column sort (dragging clears sort).

**`handleReset` callback (existing):**
- Add: also set `setActiveSort(null)` to clear column sort on reset.

**Render sort header:** Place `<SortHeader>` between `<PositionFilter>` and `<RoundSection>`.

**Key prop update:** Add `activeSort` to the `RoundSection` key so it remounts when sort changes: `key={roundId}-${activeView}-${hasCustomOrder}-${activeSort?.column ?? 'none'}-${activeSort?.direction ?? 'none'}`

**Reset state on round change:** In `handleRoundChange`, also set `setActiveSort(null)`.

### Styles

Add to `frontend/app/globals.css`:

**`.sort-header`** — The header row container. Match the horizontal layout of `continuation-player-row`: same `padding-left`, `pr-4`, `gap-1`, `flex`, `items-center`. Height should be compact (~28–30px). Background slightly different from player rows to distinguish it (e.g., `oklch(0.12 0 0)` or similar very dark). Bottom border matching `--dm-border-subtle`.

**`.sort-header-cell`** — Each clickable column cell. No background, no border. Text: small (`font-size: 0.7rem`), uppercase, `letter-spacing: 0.06em`, color `var(--dm-dust)` at 60% opacity. Cursor pointer. On hover: opacity increases to 100%.

**`.sort-header-cell-active`** — Active sort column. Color `var(--dm-gold)`, opacity 1. Arrow indicator (▲/▼) displayed inline after the label text.

**Column widths must match `ContinuationPlayerRow` exactly:**
- Handle slot: `width: 1.5rem` (empty, not clickable)
- Jersey (`#`): `width: 2.5rem` (`w-10`)
- Position (`Pos`): match `player-position` flex-shrink-0 width (~30px)
- Name: `flex: 1`
- Note: `width: 1.25rem` (`w-5`)
- Heart: `width: 1.25rem` (`w-5`)
- Prev Team (`Team`): match `player-prev-team` flex-shrink-0

## Key Implementation Details

1. **Column sort does NOT persist to the database.** It is client-side state only, reset on round change, view change, or page reload. Only drag orders persist.

2. **Column sort clears saved drag order.** When the user clicks a column header, any saved drag order for that round is deleted (both locally and in the DB). This is intentional — the two modes are mutually exclusive, and the user's action of clicking a sort column is an explicit choice to leave custom drag mode.

3. **Position filter interacts with column sort.** When a position filter is active (e.g., showing only F), column sort applies to just the visible forwards. Switching the position filter back to "All" shows all players still sorted by the active column. The position filter is applied AFTER the column sort — it's a visual filter on top of the sorted list.

4. **Sort header renders once, above all session groups.** Even when sessions exist, there is only one sort header above everything. The sort logic is applied within each session independently, but the header itself is not repeated per session.

5. **Note and heart column headers.** These columns are narrow (20px each). The header cells for these should be clickable but don't need visible text. Options: use a tiny icon (SquarePen/Heart at 10px) or just leave them as invisible tap targets. The arrow indicator still appears on the active one. Use the same SquarePen and Heart icons at small size (10px) with the same dust/dim styling.

6. **Follow existing patterns.** The sort header follows the same CSS class conventions: define styles with `@apply` in `globals.css`, use custom classes in JSX. Match the dark theme colors (`oklch` values) used throughout the sessions page.

7. **`displayName` for name sort.** When sorting by name, use the same display name logic as the player row: `customName || player.name || "Unknown"`. Unknown players (no linked player record) sort to the bottom for ascending, top for descending.

## Acceptance Criteria

- [ ] Sort header appears below position filter in both Continuing and Cuts views
- [ ] Clicking a column header sorts players by that column (ascending first)
- [ ] Clicking the same column again reverses sort direction (descending)
- [ ] Third click on the same column resets to default sort (no active sort)
- [ ] Active sort column shows ▲ (ascending) or ▼ (descending) arrow
- [ ] Dragging a player clears the active column sort (arrow disappears)
- [ ] Clicking a column sort clears any saved drag order (DB + local state)
- [ ] Reset button (RotateCcw) clears both column sort and drag order
- [ ] When sessions exist, sorting applies within each session independently
- [ ] Position filter works correctly with column sort active
- [ ] Sort header column widths align with player row columns
- [ ] Sort state resets on round change and view change (Continuing ↔ Cuts)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. All tests below are read-only (navigate + snapshot). No data mutations needed — sorting is client-side only.

**Setup:**
1. Log in as `testparent@test.com` / `testpass123`
2. Navigate to `/continuations`
3. Ensure at least one round with multiple players is visible

### Test 1: Sort header is visible
1. Navigate to `/continuations`
2. Take a snapshot of the page
3. **Verify:** A header row appears between the position filter and the first player row. It shows column labels: `#`, `Pos`, `Name`, and `Team`.

### Test 2: Click jersey column — ascending sort
1. Click the `#` column header
2. Take a snapshot
3. **Verify:** Players are sorted by jersey number ascending (1, 2, 3...). The `#` header shows a ▲ arrow. Drag handles are still visible.

### Test 3: Click jersey column again — descending sort
1. Click the `#` column header again
2. Take a snapshot
3. **Verify:** Players are sorted by jersey number descending (99, 98...). The `#` header shows a ▼ arrow.

### Test 4: Click jersey column third time — reset
1. Click the `#` column header again (third click)
2. Take a snapshot
3. **Verify:** No arrow indicator on any column. Players return to default sort (position group order: F → D → G → ?).

### Test 5: Click name column — alphabetical sort
1. Click the `Name` column header
2. Take a snapshot
3. **Verify:** Players are sorted alphabetically A → Z. The `Name` header shows ▲.

### Test 6: Switch sort column
1. While name sort is active (▲), click the `#` column header
2. Take a snapshot
3. **Verify:** Name column no longer shows an arrow. Jersey column shows ▲. Players are sorted by jersey ascending.

### Test 7: Sort persists across position filter changes
1. Click `#` to sort by jersey ascending
2. Click the `F` position filter chip
3. Take a snapshot
4. **Verify:** Only forwards are shown, sorted by jersey ascending. ▲ still visible on `#`.
5. Click `All` position filter chip
6. Take a snapshot
7. **Verify:** All players shown, still sorted by jersey ascending.

### Test 8: Sort header in Cuts view
1. Click the "Cuts" toggle
2. Take a snapshot
3. **Verify:** Sort header is visible in the Cuts view. Click `#` and verify cut players sort by jersey.

### Test 9: Sort resets on view change
1. In Continuing view, click `Name` to sort ascending
2. Switch to Cuts view
3. Take a snapshot
4. **Verify:** No active sort arrow — sort resets when switching views.

### Test 10: Sort resets on round change
1. If multiple rounds exist, click `Name` to sort ascending
2. Switch to a different round via the dropdown
3. Take a snapshot
4. **Verify:** No active sort arrow — sort resets when switching rounds.

### Test 11: Sort within sessions (if sessions exist)
1. Navigate to a round that has session subheaders (e.g., "Session 1 · 4:15pm–5:45pm")
2. Click `#` to sort by jersey ascending
3. Take a snapshot
4. **Verify:** Session headers remain visible. Players within each session are sorted by jersey independently. Session 1 players are sorted among themselves, Session 2 players are sorted among themselves.

### Test 12: Favourite sort
1. Click the heart icon in the sort header (or the heart column area)
2. Take a snapshot
3. **Verify:** Favourited players appear first, non-favourites below. ▲ indicator on the heart column.

### Test 13: Previous team sort
1. Click the `Team` column header
2. Take a snapshot
3. **Verify:** Players sorted by previous team tier: AA teams first, then A, BB, B, C. ▲ indicator on `Team`.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| — | No mutations — all tests are read-only | N/A |

## Files to Touch

1. `frontend/components/continuations/sort-header.tsx` — **NEW** — sort header component
2. `frontend/components/continuations/round-section.tsx` — **MODIFY** — add sort props, column sort logic, clear sort on drag
3. `frontend/components/continuations/continuations-page-client.tsx` — **MODIFY** — add sort state, wire sort header, clear drag order on sort, reset sort on round/view change
4. `frontend/app/globals.css` — **MODIFY** — add `.sort-header`, `.sort-header-cell`, `.sort-header-cell-active` styles

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
