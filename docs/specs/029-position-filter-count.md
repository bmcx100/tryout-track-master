# Spec 029: Teams Position Filter — Heading Player Count

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** None

## What This Feature Does

When a position filter (F/D/G) is active on the Teams page, team headings update their player count to show a "filtered/total" format — e.g., "3/18 Players". When no filter is active, the count displays normally as "18 Players". Teams with zero matching players remain visible with "0/18 Players" instead of being hidden.

## Current State

### Position filter
- `frontend/components/teams/position-filter.tsx` — chips for All/F/D/G with animated pill, reset button
- Filter state (`activePosition`) lives in `frontend/components/teams/teams-page-client.tsx` and is passed as `positionFilter` prop to both views

### Predictions view
- `frontend/components/teams/prediction-board.tsx` — distributes players into teams by position caps (9F/6D/2G)
- Position filter applied at **line 400–407**: maps sections to filter players by position, then **removes sections with 0 matching players** via `.filter((s) => s.players.length > 0)`
- Passes only the filtered `players` array to `TeamSection` — no total count
- `frontend/components/teams/team-section.tsx` — displays `players.length` in the heading (line 44): `{players.length} Players`
- `TeamSection` has no concept of total vs filtered player count

### Previous Teams view
- `frontend/components/teams/previous-teams-view.tsx` — groups players by previous team
- Position filter applied at **line 426–429**: maps entries to filter players, then **removes groups with 0 matching players** via `.filter(([, gp]) => gp.length > 0)`
- `SortableTeamSection` already receives both `players` (filtered, for display) and `allPlayers` (unfiltered, for bulk heart and count)
- Heading at line 196 shows `allPlayers.length` — always the total, never the filtered count

## Changes Required

### Database

No database changes needed.

### Server Actions / API Routes

No server action changes needed.

### Pages

No page changes needed.

### Components

#### `frontend/components/teams/team-section.tsx`

Add a new optional prop `totalPlayerCount`:

- When `totalPlayerCount` is provided and differs from `players.length`, display the count as `{players.length}/{totalPlayerCount} Players`
- When `totalPlayerCount` is not provided or equals `players.length`, display the count as `{players.length} Players` (current behavior)

#### `frontend/components/teams/prediction-board.tsx`

1. When building `displaySections` (line 400–407), **stop filtering out sections with 0 matching players**. Remove the `.filter((s) => s.players.length > 0)` call. All teams should remain visible regardless of filter.
2. Preserve the original (unfiltered) player count for each section. Before applying the position filter, capture each section's total player count.
3. Pass `totalPlayerCount` to each `TeamSection` — the unfiltered count from the section's original `players` array.

#### `frontend/components/teams/previous-teams-view.tsx`

1. When building `displayEntries` (line 426–429), **stop filtering out groups with 0 matching players**. Remove the `.filter(([, gp]) => gp.length > 0)` call. All groups should remain visible regardless of filter.
2. In `SortableTeamSection`, update the heading count display (line 196). When `positionFilter` is active, show `{players.length}/{allPlayers.length} Players`. When no filter, show `{allPlayers.length} Players` (current behavior).
3. Add `positionFilter` as a prop to `SortableTeamSection` so it knows whether to show the filtered format.

### Styles

No new CSS classes needed. The existing `.team-count` class handles the display.

## Key Implementation Details

- **Do not change player distribution or drag behavior.** The filtered count is purely visual — it does not affect which players appear in the list or how drag-and-drop works.
- **Teams with 0 matching players** should appear with their header (e.g., "0/18 Players") but show no player rows beneath — the section is effectively collapsed to just the header. The expand/collapse chevron can still be clicked but there are no rows to show.
- **Predictions view pattern:** The `sections` array (built at lines 324–397) already has the full unfiltered player list per team. Capture `section.players.length` before the position filter map at line 400 to get the total count.
- **Previous Teams view pattern:** `allPlayers` is already the unfiltered list. The filtered list is `players`. Both are already passed to `SortableTeamSection`.

## Acceptance Criteria

- [ ] When position filter is "All" (default), team headings show total count as "N Players" (no change from current behavior)
- [ ] When position filter is F, D, or G, Predictions team headings show "X/Y Players" where X is the filtered count and Y is the total
- [ ] When position filter is F, D, or G, Previous Teams headings show "X/Y Players" where X is the filtered count and Y is the total
- [ ] Teams with 0 players matching the active filter still appear with "0/Y Players" heading
- [ ] Teams with 0 matching players show no player rows (empty section body)
- [ ] Drag-and-drop behavior is unchanged
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Live Data Safety:**
This feature is read-only — no data mutations needed for testing. All tests verify visual display only.

**Setup:**
1. Log in as `testparent@test.com` / `testpass123`
2. Navigate to `/teams`
3. Ensure the division has players with mixed positions (F, D, G)

### Test 1: Default state — no filter active
1. Navigate to `/teams`
2. Take a snapshot of the page
3. **Verify:** All team headings show "N Players" format (no slash), where N is the total player count for that team

### Test 2: Position filter active — Predictions view
1. Navigate to `/teams` (Predictions view should be the default)
2. Tap the "F" position filter chip
3. Take a snapshot of the page
4. **Verify:** Each team heading shows "X/Y Players" where X is the number of forwards and Y is the total player count
5. Tap the "D" position filter chip
6. Take a snapshot
7. **Verify:** Each team heading now shows defense count / total count
8. Tap the "G" position filter chip
9. Take a snapshot
10. **Verify:** Each team heading now shows goalie count / total count

### Test 3: Position filter active — Previous Teams view
1. Navigate to `/teams`
2. Switch to "Previous Teams" view
3. Tap the "F" position filter chip
4. Take a snapshot
5. **Verify:** Each team heading shows "X/Y Players" where X is the number of forwards and Y is the total player count for that previous team group

### Test 4: Teams with 0 matching players remain visible
1. Navigate to `/teams` (Predictions view)
2. Tap the "G" position filter chip (goalies — typically 2 per team, some teams may have 0)
3. Take a snapshot
4. **Verify:** Teams that have 0 goalies still appear with a heading showing "0/Y Players"
5. **Verify:** Those teams show no player rows beneath the heading

### Test 5: Switching back to "All" restores normal count
1. With a position filter active, tap the "All" chip
2. Take a snapshot
3. **Verify:** All team headings revert to "N Players" format (no slash)
4. **Verify:** All teams show their full player lists again

### Test 6: Reset button restores normal count
1. Tap the "F" position filter chip
2. Tap the reset button (RotateCcw icon)
3. Take a snapshot
4. **Verify:** Filter resets to "All", headings show "N Players" format

### Test Mutations Log

No mutations — all tests are read-only.

## Files to Touch

1. `frontend/components/teams/team-section.tsx` — add `totalPlayerCount` prop, update heading display
2. `frontend/components/teams/prediction-board.tsx` — capture total counts before filtering, pass to TeamSection, stop hiding empty sections
3. `frontend/components/teams/previous-teams-view.tsx` — pass `positionFilter` to SortableTeamSection, update heading display, stop hiding empty groups

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
