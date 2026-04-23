# Spec 019: Retest Long-Press on Feature Branch

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** 016 (Sessions position filter & drag sorting)

## What This Feature Does

Re-enables the long-press gesture to open the player detail/edit sheet, which was temporarily disabled during drag UX research. The long-press delay is increased from 500ms to 1000ms to reduce accidental triggers while dragging. The drag handle touch target is increased to Apple HIG's recommended 44px minimum. All changes happen on a dedicated feature branch deployed to a Vercel preview URL for mobile testing — `main` is not touched.

## Research Reference

Review [DRAG-UX-RESEARCH.md](../prd/DRAG-UX-RESEARCH.md) for full context on known mobile issues, feature audit, and the test changes that were made during the research session.

## Current State

Long-press is **disabled** on `main` — three `onLongPress?.(player)` calls are commented out in `frontend/components/teams/player-row.tsx` (lines 52, 104, 140). The drag handle was widened from `w-4` to `w-10` with `touch-action: none` added as a test change. The `GripVertical` icon is still `size={14}`.

### Key files

- `frontend/components/teams/player-row.tsx` — long-press timer, drag handle, pointer events
- `frontend/components/teams/prediction-board.tsx` — `DndContext`, `TouchSensor` config (200ms delay, 5px tolerance)
- `frontend/components/teams/previous-teams-view.tsx` — separate `DndContext` with same sensor config
- `frontend/components/teams/team-section.tsx` — renders `PlayerRow` within `SortableContext`
- `frontend/app/globals.css` — `.player-drag-handle` styles

### Current gesture timeline

| Time | Finger still | Finger moving |
|------|-------------|---------------|
| 0–200ms | Nothing | Nothing |
| 200ms+ | Nothing | Drag activates (TouchSensor) |
| 500ms+ | Long-press fires (DISABLED) | Drag continues |

### Target gesture timeline

| Time | Finger still | Finger moving |
|------|-------------|---------------|
| 0–200ms | Nothing | Nothing |
| 200ms+ | Nothing | Drag activates (TouchSensor) |
| 1000ms+ | Long-press fires (opens detail sheet) | Drag continues |

## Changes Required

### Branch Setup

Create a feature branch from `main`. Do NOT merge back or modify `main`.

```bash
git switch -c feature/long-press-retest
```

After pushing, Vercel will auto-deploy a preview URL for mobile testing.

### Database

No database changes needed.

### Server Actions / API Routes

No server action changes needed.

### Pages

No page changes needed.

### Components

#### `frontend/components/teams/player-row.tsx`

1. **Increase `LONG_PRESS_MS`** from `500` to `1000`
2. **Uncomment all three `onLongPress?.(player)` calls:**
   - Line 52 (inside `handlePointerDown` setTimeout callback)
   - Line 104 (inside `onContextMenu` handler)
   - Line 140 (inside notes indicator `onClick`)
3. **Increase grip icon size** from `size={14}` to `size={20}` — the container provides the 44px touch target, the icon should be large enough to be visually clear within it

#### No changes to `prediction-board.tsx` or `previous-teams-view.tsx`

The `TouchSensor` activation config (200ms delay, 5px tolerance) stays the same. The 800ms gap between drag activation (200ms) and long-press (1000ms) should provide clear separation.

### Styles

#### `frontend/app/globals.css`

Update `.player-drag-handle`:
- Change `w-10` (40px) to `w-11` (44px / 2.75rem) — Apple Human Interface Guidelines minimum touch target size
- Keep `touch-action: none`, `flex items-center justify-center`

```css
.player-drag-handle {
  @apply w-11 flex-shrink-0 text-sm flex items-center justify-center;
  color: var(--dm-dust);
  opacity: 0.5;
  cursor: grab;
  touch-action: none;
}
```

## Key Implementation Details

- The `e.preventDefault()` on `handlePointerDown` is critical — it prevents the browser from initiating native drag or text selection, which fires `pointercancel` and kills the long-press timer
- The 10px `MOVE_THRESHOLD` in `handlePointerMove` cancels the long-press if the finger moves, preventing it from firing during a drag gesture
- The `TouchSensor` delay (200ms) is much shorter than the long-press (1000ms), so drag always wins if the finger moves. The long-press only fires if the finger stays still for a full second
- `firedRef` prevents the long-press from firing twice (once from timer, once from contextmenu)
- The detail sheet component (`long-press-menu.tsx`) is already fully functional — it just needs the `onLongPress` callback to be active

## Acceptance Criteria

- [ ] Feature branch `feature/long-press-retest` created from `main`
- [ ] `main` branch is NOT modified
- [ ] Long-press (1000ms, finger still) opens the player detail sheet
- [ ] Drag (200ms + finger move) initiates drag without opening the detail sheet
- [ ] Drag handle touch target is 44px wide (Apple HIG)
- [ ] Grip icon is `size={20}` and visually centered in the handle
- [ ] Long-press cancels if finger moves more than 10px
- [ ] Context menu (right-click / long-press on desktop) opens the detail sheet
- [ ] Notes icon tap opens the detail sheet
- [ ] Position filter, cross-position drag, and order saving still work
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)
- [ ] Branch is pushed to GitHub and Vercel preview URL is accessible

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. All tests below are read-only (navigate + snapshot). No mutations needed.

**Setup:**
1. Log in as `testparent@test.com` / `testpass123`
2. Navigate to `/teams`
3. Ensure division is set to U15

### Test 1: Long-press opens detail sheet
1. Navigate to `/teams`
2. Ensure "Predictions" view is active
3. Identify a player row (not in an official/locked team)
4. Long-press (hold pointer down for 1000ms without moving) on the player row body (not the grip handle)
5. **Verify:** Player detail sheet opens showing the player's name, jersey number, and editable fields

### Test 2: Short press does NOT open detail sheet
1. Navigate to `/teams`
2. Tap (quick press and release, under 500ms) on a player row
3. **Verify:** No detail sheet opens

### Test 3: Drag does NOT trigger long-press
1. Navigate to `/teams`
2. Press and hold on the grip handle of a player row
3. After 200ms, move finger/pointer vertically (more than 10px)
4. **Verify:** Drag activates (row becomes semi-transparent at 50% opacity). Detail sheet does NOT open

### Test 4: Drag handle is visually wider
1. Navigate to `/teams`
2. Take a screenshot of a player row
3. **Verify:** The grip handle area is visibly wider than before (44px), with the GripVertical icon centered

### Test 5: Long-press on Previous Teams view
1. Navigate to `/teams`
2. Switch to "Previous Teams" view
3. Long-press on a player row (1000ms, finger still)
4. **Verify:** Player detail sheet opens

### Test 6: Notes icon tap opens detail sheet
1. Navigate to `/teams`
2. Find a player with a notes icon (FileText) visible on their row
3. Tap the notes icon
4. **Verify:** Player detail sheet opens for that player

### Test 7: Context menu opens detail sheet (desktop)
1. Navigate to `/teams` on desktop viewport
2. Right-click on a player row
3. **Verify:** Player detail sheet opens (browser context menu is suppressed)

### Test 8: Position filter still works
1. Navigate to `/teams`
2. Tap "D" position filter chip
3. **Verify:** Only defensemen are shown
4. Long-press a defenseman row
5. **Verify:** Detail sheet opens for that player

### Test 9: Build and lint pass
1. Run `cd frontend && npm run build`
2. **Verify:** Build completes with no errors
3. Run `cd frontend && npm run lint`
4. **Verify:** No lint errors

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none) | No mutations — all tests are read-only | N/A |

## Files to Touch

1. `frontend/components/teams/player-row.tsx` — uncomment long-press, increase delay, increase icon size
2. `frontend/app/globals.css` — widen drag handle to `w-11`

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Create branch:** `git switch -c feature/long-press-retest` from `main`
2. **Make changes** to the two files listed above
3. **Build:** Run `cd frontend && npm run build` — fix any errors
4. **Lint:** Run `cd frontend && npm run lint` — fix any errors
5. **Push branch:** `git push -u origin feature/long-press-retest`
6. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000
7. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it
8. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete
9. **Report the Vercel preview URL** so the user can test on their phone
