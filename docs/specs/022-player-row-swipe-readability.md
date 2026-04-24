# Spec 022: Player Row Swipe & Readability

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

Improves the readability of every player row in the app by increasing font sizes, enlarging the drag handle to Apple's recommended 44x44pt touch target, and pushing the handle flush to the left edge. Adds a swipe-left gesture on any player row that reveals an "Edit" button, which opens the existing player detail sheet. Swipe coexists with vertical drag-to-reorder on pages that support it.

## Current State

### Player Row Component
- **`frontend/components/teams/player-row.tsx`** (157 lines) — renders a single player row using `@dnd-kit/sortable`. Contains drag handle (`GripVertical` at `size={14}`), jersey number, position badge, favorite button, player name, custom name indicator, notes icon, and previous team label.
- Long-press callbacks are currently **commented out** (lines 52, 104, 140) from drag UX testing. This spec does NOT re-enable long-press — swipe replaces it as the way to open the detail sheet.

### Player Row Styles (`frontend/app/globals.css`, lines ~390–473)
- `.player-row` — `@apply flex items-center gap-1.5 px-5 py-2;` with alternating dark backgrounds
- `.player-drag-handle` — `@apply w-10 flex-shrink-0 text-sm flex items-center justify-center;` (widened from `w-4` during drag testing, but icon is still 14px)
- `.player-jersey` — `text-xs` / `font-size` not overridden (inherits ~12px)
- `.player-position` — `text-xs` with explicit `font-size: 11px`
- `.player-name` — `text-xs` with explicit `font-size: 13px`
- `.player-prev-team` — `text-xs` with explicit `font-size: 12px`
- `.favorite-btn` — `w-5` (20px)
- `.notes-indicator` — no explicit size
- `.custom-name-indicator` — `text-xs`

### Detail Sheet
- **`frontend/components/teams/long-press-menu.tsx`** (395 lines) — bottom sheet opened by `onLongPress` callback. Editable fields (jersey, name, notes), read-only fields (position, previous team, made team). Correction popup on close for parents. This component stays unchanged — the spec only changes how it gets triggered (swipe instead of long-press).

### Pages That Render Player Rows
1. **Teams → Predictions** — `frontend/components/teams/prediction-board.tsx` via `team-section.tsx` → `PlayerRow` (drag enabled)
2. **Teams → Previous Teams** — `frontend/components/teams/previous-teams-view.tsx` via `team-section.tsx` → `PlayerRow` (drag enabled)
3. **Sessions / Continuations** — `frontend/components/teams/continuations-page-client.tsx` via `round-section.tsx` → `PlayerRow` (drag enabled)
4. **My Favourites** — `frontend/components/dashboard/my-favourites-client.tsx` — renders its own row markup (not `PlayerRow`). Will need to adopt `PlayerRow` or get its own swipe implementation.
5. **Dashboard Hero Card** — `frontend/components/dashboard/hero-card.tsx` — compact player rows inside cards. Excluded from this spec (too small for swipe).

### Drag UX Research
- **`docs/prd/DRAG-UX-RESEARCH.md`** — documents swipe-to-reveal as a 40–55 line implementation. Notes drag handle was increased from `w-4` to `w-10` and tested on mobile.

## Changes Required

### Database
No database changes needed.

### Server Actions / API Routes
No new server actions needed. The existing detail sheet callbacks (`onSaveName`, `onSaveNote`, `onSubmitCorrection`, `onToggleFavorite`, etc.) are already wired up in every page that uses `PlayerRow`.

### Pages
No new pages. Existing pages that render `PlayerRow` will automatically get the readability and swipe changes.

**My Favourites** (`frontend/components/dashboard/my-favourites-client.tsx`) currently renders its own row markup instead of using `PlayerRow`. It should be refactored to use `PlayerRow` (with `isLocked={true}` to hide the drag handle) so it gets swipe and readability for free. If this refactor is too complex, add swipe directly to the existing markup as a fallback.

### Components

#### Modified: `frontend/components/teams/player-row.tsx`

**Swipe gesture:**
- Wrap the row content in a swipe container. On horizontal swipe-left (threshold: 50px), slide the row content left to reveal an "Edit" button behind it.
- The "Edit" button sits behind the row on the right side, revealed as the row slides left. Use a background color of `var(--dm-gold)` with dark text.
- Tapping "Edit" opens the detail sheet (calls `onLongPress` / a new `onEdit` prop — same callback, just renamed for clarity).
- Tapping anywhere else on the row, or swiping right, snaps the row back to its default position.
- Only one row can be swiped open at a time — opening a new row closes any previously open row.
- Swipe detection: track `touchstart` / `touchmove` / `touchend`. If horizontal movement exceeds vertical movement by a reasonable margin (e.g., 1.5x), treat as swipe and prevent vertical scroll. Otherwise, let the browser scroll normally.

**Coexistence with drag:**
- The drag handle already has `touch-action: none` which prevents browser gestures on the handle itself.
- Swipe should be detected on the **row body** (everything except the drag handle). This prevents conflicts: touching the handle starts a drag; touching the row body starts a swipe.
- If the row is locked (`isLocked={true}`), the drag handle is hidden but swipe still works.

**Readability — icon size:**
- Change `GripVertical` from `size={14}` to `size={20}`.

**Props change:**
- Rename `onLongPress` to `onEdit` for clarity (since swipe replaces long-press). Update all call sites.
- Remove the long-press timer logic (lines 40–75 approx) — it's already commented out and no longer needed.

#### Modified: `frontend/components/teams/team-section.tsx`
- Pass the renamed `onEdit` prop instead of `onLongPress`.

#### Modified: `frontend/components/dashboard/my-favourites-client.tsx`
- Add swipe-to-edit on favourite player rows. Either refactor to use `PlayerRow` or add swipe logic directly to the existing row markup.
- Apply the same readability styles (font sizes, spacing).

### Styles

#### Modified: `frontend/app/globals.css`

**`.player-row`** — reduce horizontal padding so the drag handle sits flush to the left edge:
```
Before: @apply flex items-center gap-1.5 px-5 py-2;
After:  @apply flex items-center gap-1.5 pr-4 py-2;
        padding-left: 0.25rem;  /* 4px — just enough to not touch the screen edge */
```

**`.player-drag-handle`** — set to Apple HIG 44x44pt minimum:
```
Before: @apply w-10 flex-shrink-0 text-sm flex items-center justify-center;
After:  @apply flex-shrink-0 flex items-center justify-center;
        width: 2.75rem;    /* 44px */
        min-height: 2.75rem; /* 44px */
```

**`.player-jersey`** — increase to text-base:
```
Before: @apply w-7 flex-shrink-0 text-xs font-medium;
After:  @apply w-8 flex-shrink-0 text-base font-medium;
```
Remove or update any explicit `font-size` override that contradicts text-base.

**`.player-position`** — increase to text-base:
```
Before: font-size: 11px;
After:  font-size: 1rem;  /* 16px, matches text-base */
```

**`.player-name`** — increase to text-base:
```
Before: @apply min-w-0 flex-1 truncate text-xs font-medium;
        font-size: 13px;
After:  @apply min-w-0 flex-1 truncate text-base font-medium;
```
Remove the explicit `font-size: 13px` override.

**`.player-prev-team`** — increase to text-base:
```
Before: font-size: 12px;
After:  font-size: 1rem;
```

**`.custom-name-indicator`** — increase from text-xs:
```
Before: @apply ml-1.5 text-xs;
After:  @apply ml-1.5 text-sm;
```

**New: `.player-row-swipe-container`** — wrapper for swipe behavior:
- `position: relative; overflow: hidden;` on the outer container
- Row content gets `transform: translateX(0); transition: transform 200ms ease-out;`
- When swiped: `transform: translateX(-80px);` (reveals 80px-wide Edit button)

**New: `.player-row-swipe-action`** — the revealed Edit button:
- `position: absolute; right: 0; top: 0; bottom: 0; width: 80px;`
- `background: var(--dm-gold); color: oklch(0.15 0 0);`
- `display: flex; align-items: center; justify-content: center;`
- `font-weight: 600; font-size: 0.875rem;`

## Key Implementation Details

1. **Swipe state management:** Use a React ref or context to track which row (if any) is currently swiped open. When a new row starts swiping, close the previous one. Close on scroll events too.

2. **Gesture discrimination:** The key challenge is distinguishing horizontal swipe from vertical scroll and from drag-handle grabs. Strategy:
   - On `touchstart`, record start position.
   - On `touchmove`, if the touch is on the drag handle, ignore (let dnd-kit handle it).
   - If horizontal delta > vertical delta * 1.5 AND horizontal delta > 15px, lock to horizontal swipe and call `preventDefault()` to stop scroll.
   - If vertical delta wins, abort swipe tracking and let the browser scroll.

3. **No external dependencies.** Implement swipe with raw touch events — no swipe library needed. Keep it under 60 lines of gesture code.

4. **Locked rows:** On pages where `isLocked={true}` (e.g., official teams), the drag handle is hidden but swipe still works. The Edit button opens the detail sheet in read-only mode (same as current behavior for locked/official team rows).

5. **Desktop:** On desktop, swipe is not relevant (no touch). The existing click-to-open-detail-sheet behavior should remain. If the row currently doesn't respond to click (because long-press is commented out), re-enable a simple `onClick` that opens the detail sheet.

6. **Accessibility:** The Edit action should also be reachable via keyboard (Enter/Space on a focused row) and the swipe container should have `role="button"` and `aria-label="Edit player [name]"`.

7. **My Favourites page:** If refactoring to use `PlayerRow` is straightforward (it likely is — the row structure is similar), do so. Otherwise, duplicate the swipe logic. Prefer the refactor.

## Acceptance Criteria

- [ ] Swiping left on a player row reveals an "Edit" button (gold background)
- [ ] Tapping "Edit" opens the player detail sheet
- [ ] Swiping right or tapping elsewhere closes the revealed button
- [ ] Only one row can be swiped open at a time
- [ ] Swipe works on all pages: Predictions, Previous Teams, Sessions, My Favourites
- [ ] Swipe and drag-to-reorder coexist without interference (swipe on row body, drag on handle)
- [ ] Drag handle icon is 20px, touch target is 44x44px (Apple HIG)
- [ ] Drag handle sits near the left edge (row left padding ~4px)
- [ ] All text elements in the row use text-base (16px): jersey, position, name, previous team
- [ ] Custom name indicator uses text-sm (14px)
- [ ] On desktop, clicking a player row opens the detail sheet
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. All tests below are **read-only** unless noted. Follow the mutation rules in the spec template.

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to the Teams page. Ensure division is set to U15 (Nepean Wildcats).

### Test 1: Readability — font sizes and drag handle size
1. Navigate to `/teams` (Predictions view).
2. Take a browser snapshot.
3. **Verify:** Player rows show visibly larger text than before. Jersey numbers, names, position badges, and previous team labels are all ~16px. The drag handle icon is larger (20px) and the handle area is wide (44px).

### Test 2: Readability — drag handle flush to left edge
1. On the Predictions view, take a screenshot.
2. **Verify:** The drag handle (grip icon) sits very close to the left edge of the screen. There is minimal space (~4px) between the screen edge and the handle.

### Test 3: Swipe-left reveals Edit button
1. On the Predictions view, find a player row.
2. Use Playwright to simulate a horizontal swipe-left on the row (touchstart → touchmove → touchend, moving ~100px left).
3. **Verify:** The row slides left, revealing a gold "Edit" button on the right side.

### Test 4: Tapping Edit opens detail sheet
1. With a row swiped open (from Test 3), click the "Edit" button.
2. **Verify:** The player detail sheet opens, showing the player's name, jersey, position, etc.
3. Close the detail sheet.

### Test 5: Swipe-right closes revealed button
1. Swipe a row left to reveal the Edit button.
2. Swipe right on the same row.
3. **Verify:** The row snaps back to its default position, hiding the Edit button.

### Test 6: Only one row swiped at a time
1. Swipe row A left to reveal Edit.
2. Swipe row B left.
3. **Verify:** Row A snaps back closed. Only row B shows the Edit button.

### Test 7: Swipe on Previous Teams view
1. Switch to the "Previous Teams" toggle.
2. Swipe a player row left.
3. **Verify:** Edit button appears. Tapping it opens the detail sheet.

### Test 8: Swipe on Sessions page
1. Navigate to `/sessions` (or the continuations/sessions route).
2. Swipe a player row left.
3. **Verify:** Edit button appears and opens the detail sheet when tapped.

### Test 9: Swipe on My Favourites page
1. Navigate to `/favourites` (or the My Favourites route).
2. Swipe a player row left.
3. **Verify:** Edit button appears and opens the detail sheet when tapped.

### Test 10: Swipe does not interfere with drag
1. On the Predictions view, grab a player's drag handle (the grip icon on the left).
2. Drag the player vertically to a different position in the list.
3. **Verify:** The drag works normally — no horizontal swipe triggers during vertical drag.

### Test 11: Desktop click opens detail sheet
1. Resize browser to desktop width (1024px+).
2. Navigate to `/teams`.
3. Click (not swipe) on a player row.
4. **Verify:** The player detail sheet opens.

### Test 12: Locked rows still allow swipe but not drag
1. If there is a team section showing official/locked teams (check icon instead of drag handle), swipe a row left.
2. **Verify:** Edit button appears. The row cannot be dragged (no grip handle visible).

### Test 13: Readability on all pages
1. Navigate to `/teams` (Predictions) — take snapshot, verify text sizes.
2. Switch to Previous Teams — take snapshot, verify text sizes.
3. Navigate to Sessions — take snapshot, verify text sizes.
4. Navigate to My Favourites — take snapshot, verify text sizes.
5. **Verify:** All player rows across all pages show the same increased font sizes.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| — | No mutations — all tests are read-only | — |

## Files to Touch

1. `frontend/app/globals.css` — update `.player-row`, `.player-drag-handle`, `.player-jersey`, `.player-position`, `.player-name`, `.player-prev-team`, `.custom-name-indicator` styles; add `.player-row-swipe-container` and `.player-row-swipe-action`
2. `frontend/components/teams/player-row.tsx` — add swipe gesture, increase icon size, rename `onLongPress` → `onEdit`, remove long-press timer code
3. `frontend/components/teams/team-section.tsx` — update prop name `onLongPress` → `onEdit`
4. `frontend/components/teams/prediction-board.tsx` — update callback prop name
5. `frontend/components/teams/previous-teams-view.tsx` — update callback prop name
6. `frontend/components/teams/continuations-page-client.tsx` — update callback prop name (if it uses `onLongPress`)
7. `frontend/components/dashboard/my-favourites-client.tsx` — refactor to use `PlayerRow` or add swipe logic; apply readability styles

## Implementation Checklist

After implementing the changes above, you MUST complete these steps
in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.

## Implementation Notes (2026-04-24)

Changes made beyond the original spec during implementation:

### Row layout reordered
Both `PlayerRow` (teams) and `ContinuationPlayerRow` (sessions) now use the same element order:
**Handle / Jersey / Position / Name / (right-justified group: Edit icon / Heart / Prev team)**

The right-justified group uses `.continuation-row-right` (`flex items-center gap-1.5 ml-auto`).

### Edit icon replaces note icon
- `FileText` replaced with `SquarePen` (edit details icon) from Lucide
- Always visible on every row: faded when inactive (`.note-btn`, opacity 0.4), gold when player has a note (`.note-btn-active`)
- Tapping opens the player detail sheet

### IP badge moved
IP badge moved from the right-justified group to inline after the player name (inside `.player-name` span), with `ml-2` spacing.

### Row heights unified
- Both `.player-row` (teams) and `.continuation-player-row` (sessions) set to `height: 44px`
- Left padding: `0.25rem` (handles flush to left edge)
- Gap: `gap-1`
- Team header padding reduced from `py-2.5` to `py-1.5`

### Optimistic annotation updates fixed
`RoundSection` was reading stale annotation data from `useState`-initialized `orderedList`. Fixed by reading `annotations` prop directly at render time instead of from baked-in `PlayerEntry` objects.

### Bottom nav optimistic feedback
- `BottomNav` switched from `Link` to `<a>` with `router.push()` for optimistic tab highlighting
- Tapped tab immediately highlights before page loads (`pendingHref` state)
- Press animation: `scale(0.85)` on `:active` state

### New priority item
Added priority #26: "Sessions column sort header" with draft at `docs/specs/drafts/sessions-column-sort.md`.

### Additional files modified (not in original spec)
- `frontend/components/continuations/round-section.tsx` — annotation read fix
- `frontend/components/layout/bottom-nav.tsx` — optimistic nav feedback
- `docs/specs/PRIORITIES.md` — added #26
- `docs/specs/drafts/sessions-column-sort.md` — new draft
