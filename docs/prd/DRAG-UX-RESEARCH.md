# Drag UX Research — Mobile Player Reorder

**Date:** 2026-04-22
**Status:** Research / Discussion — no decisions committed

## Current Implementation

- **Library:** `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2
- **Drag handle:** GripVertical icon (14px / `w-4`) on left side of each player row
- **Long-press:** Opens player detail/edit sheet (500ms timer)
- **Key files:** `player-row.tsx`, `team-section.tsx`, `prediction-board.tsx`, `previous-teams-view.tsx`, `globals.css`

## Known Mobile Issues

- Touch scrolling conflicts with drag gestures
- Grip handle touch target too small (14px, Apple HIG recommends 44px)
- No `touch-action: none` on drag handle — browser intercepts touch as scroll
- iOS Safari: rubber-banding, address bar animation, long-press system gestures
- Android Chrome: pull-to-refresh cancels drag, back gesture on edge swipes
- `e.preventDefault()` on entire row div may interfere with grip handle events

## Feature Audit

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Visual drag feedback | Partial | Row fades to 50% opacity. No lift/shadow/dimming of other rows |
| 2 | Drop zone indicators | Not implemented | `@dnd-kit/core` supports `DragOverlay` — no new deps needed |
| 3 | Auto-scroll while dragging | Not implemented | `@dnd-kit/core` has `autoScroll` prop on `DndContext` — no new deps needed |
| 4 | "Move to..." shortcut | Not implemented | See options below |
| 5 | Undo after drop | Not implemented | Orders auto-save via debounce (1000ms), no undo UI |
| 6 | Lock/unlock toggle | Partial | Official teams locked per-team, no global user toggle |

## "Move to..." Options Discussed

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Bottom sheet team picker | Tap Move → sheet shows team list → tap destination | Least code, most intuitive, solves long-distance moves | Extra tap vs drag |
| B. Floating pinned card | Tap Move → player card pins to top → scroll freely → tap destination row | Visual, feels native | Complex to build |
| C. Up/down team arrows | Arrows move player one team up/down | Simple | Tedious for long moves |
| D. Hybrid (recommended) | Keep drag for short moves + "Move to..." for long jumps | Each tool does what it's best at | Two mental models |

## Swipe-to-Reveal Discussion

- Swipe-left to reveal action buttons (Move, Edit) is a well-established iOS/Android pattern
- Users associate it with delete/archive — Edit is a mild stretch, Move is unusual but workable
- ~40-55 lines across two files (`player-row.tsx` + `globals.css`), no new dependencies
- Would replace long-press as the way to open Edit, and add Move as a new action
- Move button would trigger the bottom sheet team picker (Option A above)

## Current Thinking (Not Committed)

1. **Test first:** Implement drop zone indicators (#2) and auto-scroll (#3) with the existing drag method to see how much that improves the experience
2. **Then try:** Left-swipe revealing Move and Edit buttons
3. **Move button:** Opens a bottom sheet team picker (Option A)
4. **Edit button:** Opens the existing player detail sheet (replaces long-press trigger)
5. **Touch target:** Increase grip handle from `w-4` to `w-10` + `touch-action: none`

## Files That Would Be Changed

- **Drop zone indicators (#2):** `team-section.tsx`, `globals.css`
- **Auto-scroll (#3):** `prediction-board.tsx`, `previous-teams-view.tsx`
- **Swipe-to-reveal:** `player-row.tsx`, `globals.css`
- **Touch target fix:** `globals.css` only
- **Move-to bottom sheet:** new component + `player-row.tsx`

## Changes Made During This Session (To Revert)

1. **Backed up** `player-row.tsx` → `player-row.2026-04-22.bak`
2. **Commented out 3 `onLongPress?.(player)` calls** in `player-row.tsx` (lines 52, 104, 140) — disables edit sheet, preserves drag mechanics
3. **`globals.css`** — commented out original `w-4` drag handle, replaced with `w-10` + centering + `touch-action: none`

**These are test changes only. Revert before any other work on this file.**
