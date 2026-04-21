# Spec 012: My Favourites Detail Page

**PRD Reference:** FR-025 (player tracking)
**Priority:** Must Have
**Depends on:** 009 v2 (Dashboard My Favourites summary)

## What This Feature Does

The "See All My Favourites ›" link on the dashboard navigates to a full detail page at `/my-favourites`. This page shows every hearted player in the active division, grouped by status (continuing, cut, missing, made team, registered). Each player row uses continuations-style formatting: jersey number, position badge, heart toggle, full name, and previous team. Tapping a row opens the player detail sheet. Tapping the heart un-favourites the player, but the row stays visible (faded) until the next page load.

## Current State

### Existing `/my-players` page (to be replaced)
- `frontend/app/(app)/my-players/page.tsx` — Server component. Groups by division → previous team. No status info, no interactivity (server component only). No detail sheet. No heart toggle.

### Data available
- `frontend/app/(app)/dashboard/actions.ts` — `getDashboardData()` returns `FavoriteStatus[]` with `statusType` and `statusText` per player. Also has `derivePlayerStatus()` helper. The `FavoriteStatus` type currently lacks `previousTeam`.
- `frontend/app/(app)/annotations/actions.ts` — `toggleFavorite()`, `saveCustomName()`, `savePlayerNote()`, `getMyPlayers()` (returns full `TryoutPlayer` + annotations).

### Detail sheet
- `frontend/components/teams/long-press-menu.tsx` — `LongPressMenu` component. Accepts `player: TryoutPlayer`, `isFavorite`, `customName`, `note`, plus callback props (`onClose`, `onToggleFavorite`, `onSaveName`, `onSaveNote`, `onSubmitCorrection`). Already used on Teams and Continuations pages.

### Navigation references to `/my-players`
- `frontend/components/layout/division-switcher.tsx` — `TITLE_MAP` maps `"/my-players"` → `"My Players"`.
- `frontend/components/dashboard/dashboard-client.tsx` — v1 links from "My Players" section (v2 will change to "See All My Favourites ›" → `/my-favourites`).

### Styles
- `frontend/app/globals.css` — `.my-players-*` classes (`.my-players-page`, `.my-players-empty`, `.my-players-division`, `.my-players-row`, etc.) around lines 1885+.

## Approved Design

**Mockup file:** `frontend/public/mockups/012-my-favourites-page.html` — open in browser to see the approved layout.

### Page structure

1. **Page header:** Back arrow (`‹`) linking to `/dashboard` + "My Favourites (N)" title with count in parentheses.

2. **Status groups** — one section per status type, shown in this order (skip any group with 0 players):
   - **Continuing** (green dot + "N continuing" heading)
   - **Cut** (red dot + "N cut" heading)
   - **Missing** (orange dot + "⚠ N missing" heading)
   - **Made team** (gold dot + "N made team" heading)
   - **Registered** (muted dot + "N registered" heading — fallback for players with no rounds data)

3. **Player rows** (continuations-style, within each group):
   - Jersey number (`#7`) — monospace, muted grey. **Strikethrough** on cut players.
   - Position badge (`F` / `D` / `G`) — gold on gold-tinted background, same as continuations.
   - Heart toggle button — filled red when hearted, hollow when un-hearted.
   - Full name ("Lee, Marcus") — `--dm-umber`. Custom name indicator in italic if set.
   - Previous team ("U15 AA") — right-aligned, monospace, light grey.
   - For missing players: "Not at {level}" label in orange, between name and previous team.

4. **Row states:**
   - **Cut rows:** 50% opacity (faded), strikethrough jersey. Same as continuations.
   - **Missing rows:** Subtle warm orange background tint (`oklch(0.72 0.15 55 / 4%)`).
   - **Un-hearted rows:** Heart goes hollow, entire row fades to ~50% opacity. Row stays in its position until the page is refreshed or navigated away. This prevents accidental removal.

5. **Footer:** "N players tracked" centered at bottom, muted text.

6. **Tap interaction:** Tapping anywhere on a player row (except the heart button) opens the `LongPressMenu` detail sheet, same as Teams/Continuations pages.

7. **Sections always expanded** — no collapsing/accordion behaviour.

8. **Dividers:** Thin `--dm-border` line between status groups.

### Design rules (same as dashboard)
- Gold (`--dm-gold`) only for clickable/interactive elements and the position badge.
- Canadian spelling: "Favourites" not "Favorites".
- Jersey numbers in rows use muted grey, NOT gold.

## Changes Required

### Database
No database changes needed.

### Server Actions / API Routes

**Modified: `frontend/app/(app)/dashboard/actions.ts`**

Add `previousTeam` field to the `FavoriteStatus` type:

```
export type FavoriteStatus = {
  ...existing fields...
  previousTeam: string | null   // NEW — from tryout_players.previous_team
}
```

Populate it from the player data already available in the `getDashboardData()` query (the join already fetches `tryout_players!inner(*)`, so `previous_team` is accessible).

**New action in same file (or `annotations/actions.ts`):**

`getMyFavouritesPageData(associationId, division)` — returns an array of objects, each containing:
- All `FavoriteStatus` fields (including new `previousTeam`)
- `notes: string | null` — from `player_annotations.notes` (needed for detail sheet)
- `playerId` (already in FavoriteStatus)

This is essentially `getDashboardData()` but returning the full favourites data needed for the detail page (including notes). Reuse `derivePlayerStatus()` from the same file.

Alternatively, the implementer may choose to simply reuse `getDashboardData()` and extend it, or create a separate action. The key requirement is that the page receives: status grouping info, full player names, jersey numbers, positions, previous teams, notes, and custom names — all in one server call.

### Pages

**Delete: `frontend/app/(app)/my-players/page.tsx`** — replaced by the new route.

**Create: `frontend/app/(app)/my-favourites/page.tsx`** — Server component. Follows the same pattern as `frontend/app/(app)/dashboard/page.tsx`:
1. Call `requireAssociation()` for auth + association context.
2. Get active division (same as dashboard).
3. Fetch favourites data for active division.
4. Pass to a client component.

**Create: `frontend/app/(app)/my-players/page.tsx`** — Redirect-only page. Import `redirect` from `next/navigation` and redirect to `/my-favourites`. This handles any existing bookmarks or links.

### Components

**Create: `frontend/components/dashboard/my-favourites-client.tsx`**

Client component (`"use client"`). Props:
- `favourites` — array of favourite player data with status info.
- `associationId` — for server action calls.

Responsibilities:
- Group `favourites` by `statusType` into ordered sections.
- Render status group headers with coloured dots and counts.
- Render continuations-style player rows.
- Heart toggle: call `toggleFavorite()` on tap, update local state to show hollow heart + faded row. Do NOT remove the row from the list.
- Row tap (not heart): open `LongPressMenu` detail sheet for that player.
- Detail sheet callbacks: `onToggleFavorite`, `onSaveName`, `onSaveNote`, `onSubmitCorrection` — use existing server actions from `annotations/actions.ts` and `corrections/actions.ts`.

**Pattern to follow:** Look at how `frontend/components/continuations/continuation-player-row.tsx` renders rows and integrates with `LongPressMenu`. The favourites page should use the same detail sheet component and similar row structure.

### Styles

**Modified: `frontend/app/globals.css`**

Remove old classes (no longer used after `/my-players` page is replaced):
- `.my-players-page`, `.my-players-empty`, `.my-players-empty-hint`, `.my-players-division`, `.my-players-division-title`, `.my-players-row`, `.my-players-heart`, `.my-players-team-gap`

Add new classes:
- `.my-favourites-page` — page container with padding.
- `.my-favourites-header` — flex row with back arrow, title, count.
- `.my-favourites-back` — back arrow link styling (gold, clickable).
- `.my-favourites-title` — page title (15px, semi-bold, `--dm-umber`).
- `.my-favourites-count` — count in parentheses (`--dm-dust`).
- `.my-favourites-group` — status group container.
- `.my-favourites-group-header` — flex row with dot + count text (13px mono, semi-bold, status colour).
- `.my-favourites-group-dot` — 6px coloured circle.
- `.my-favourites-group-header-continuing`, `-cut`, `-missing`, `-made-team`, `-registered` — colour variants.
- `.my-favourites-row` — player row (flex, items-center, gap, padding, border-bottom). Alternating backgrounds like continuations.
- `.my-favourites-row-cut` — 50% opacity for cut players.
- `.my-favourites-row-missing` — warm orange background tint.
- `.my-favourites-row-unhearted` — faded state after un-hearting (~50% opacity, except heart button stays full opacity).
- `.my-favourites-missing-level` — "Not at X" label (11px mono, orange).
- `.my-favourites-group-divider` — thin border line between groups.
- `.my-favourites-footer` — centered muted text at bottom.

Reuse existing shared classes: `.player-jersey`, `.player-position`, `.player-name`, `.custom-name-indicator`, `.favorite-btn`, `.favorite-btn-active`, `.player-prev-team` — these are already defined in globals.css for continuations.

### Navigation updates

**Modified: `frontend/components/layout/division-switcher.tsx`**

Update `TITLE_MAP`:
- Change `"/my-players": "My Players"` to `"/my-favourites": "My Favourites"`.

**Modified: `frontend/components/dashboard/dashboard-client.tsx`** (part of spec 009 v2)

The "See All My Favourites ›" link should point to `/my-favourites` (not `/my-players`). This is already implied by spec 009 v2 but noting explicitly since the URL changed.

## Key Implementation Details

1. **Reuse `derivePlayerStatus()`** from `frontend/app/(app)/dashboard/actions.ts` for status derivation. Don't reimplement the status logic.

2. **Detail sheet integration:** The `LongPressMenu` component needs a full `TryoutPlayer` object. The server action should return enough data to construct this, or the page should fetch full player objects. The simplest approach: the server action query already joins `tryout_players!inner(*)`, so cast the joined data to `TryoutPlayer` (same pattern used in `getMyPlayers()`).

3. **Un-heart local state:** Maintain a `Set<string>` of un-hearted player IDs in component state. When a heart is tapped, add the ID to the set and call `toggleFavorite()`. Rows with IDs in this set render with the faded/hollow style. The set is lost on navigation or refresh, which is the desired behaviour (the player disappears from the list on next load).

4. **Re-heart:** If a user taps the hollow heart again (re-hearts), remove the ID from the un-hearted set and call `toggleFavorite()` again. The row returns to normal appearance. This provides a natural "undo" without a separate undo mechanism.

5. **Division scoping:** The page is scoped to the active division, matching dashboard behaviour. When the user switches divisions via `DivisionSwitcher`, the page should reload with the new division's data. Follow the same pattern as the dashboard page for getting active division.

6. **Empty state:** If no favourites exist for the active division, show the same empty state as the dashboard: Heart icon + "Heart players on the Teams page to track them here" with "Teams" as a gold link to `/teams`.

7. **Correction submission from detail sheet:** Reuse the existing correction flow from `frontend/app/(app)/corrections/actions.ts` (`submitCorrection()`). The detail sheet already handles this via `onSubmitCorrection` callback.

8. **Sorting within groups:** Within each status group, sort players by jersey number (numeric ascending). This matches the continuations page behaviour.

## Acceptance Criteria

- [ ] `/my-favourites` route renders the grouped favourites page
- [ ] `/my-players` redirects to `/my-favourites`
- [ ] Players grouped by status: continuing → cut → missing → made team → registered
- [ ] Empty status groups are not rendered
- [ ] Player rows show: jersey, position badge, heart, full name, previous team
- [ ] Cut rows are faded with strikethrough jersey
- [ ] Missing rows have warm orange tint and "Not at {level}" label
- [ ] Tapping heart un-favourites player — row fades but stays until page refresh
- [ ] Tapping heart again re-favourites (row returns to normal)
- [ ] Tapping a row (not heart) opens the player detail sheet
- [ ] Detail sheet allows editing name, notes, submitting corrections (same as Teams page)
- [ ] Page is scoped to active division — switches when division changes
- [ ] Page header shows back arrow → `/dashboard` and "My Favourites (N)" title
- [ ] DivisionSwitcher shows "My Favourites" as page title
- [ ] Empty state matches dashboard empty state
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow standard rules: read-only preferred, log mutations, revert after.

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, Nepean Wildcats). Dev server at `http://localhost:3000`. Active division U15. User should already have hearted players from previous testing.

### Test 1: Page renders with status groups
1. Navigate to `http://localhost:3000/my-favourites`
2. Take a snapshot.
3. **Verify:** Page header shows "My Favourites (N)" with back arrow. Player rows are visible, grouped by status with coloured group headers. Each row shows jersey, position, heart (filled), name, previous team.

### Test 2: Back arrow navigation
1. Click the back arrow (`‹`) in the page header.
2. **Verify:** Navigates to `/dashboard`.

### Test 3: Redirect from old URL
1. Navigate to `http://localhost:3000/my-players`
2. **Verify:** Redirected to `/my-favourites`. Same content renders.

### Test 4: Status group ordering
1. Navigate to `/my-favourites`
2. Take a snapshot.
3. **Verify:** Groups appear in order: continuing (green), then cut (red), then missing (orange, if any), then made team (gold, if any). No empty groups rendered.

### Test 5: Cut player styling
1. Find a cut player row (if any hearted players are cut).
2. **Verify:** Row is faded (~50% opacity). Jersey number has strikethrough. Heart is still filled.

### Test 6: Missing player styling (if applicable)
1. Find a missing player row (if any hearted players are missing).
2. **Verify:** Row has warm orange background. "Not at {level}" label visible in orange. Heart is filled.

### Test 7: Un-heart a player
1. Find a player row with a filled heart.
2. Note the player's jersey number and name.
3. Tap the heart button.
4. **Verify:** Heart goes hollow (unfilled). Row fades but stays in its position. Row is still visible.

### Test 8: Re-heart the same player
1. On the same row from Test 7, tap the hollow heart again.
2. **Verify:** Heart fills back in. Row returns to normal opacity. Player is re-hearted.

### Test 9: Un-hearted row persists until refresh
1. Un-heart a player (tap the heart).
2. **Verify:** Row is faded but visible.
3. Refresh the page (navigate to `/my-favourites` again).
4. **Verify:** The un-hearted player is no longer in the list. Count in header decreased by 1.
5. **Revert:** Navigate to `/teams`, find the player, re-heart them via detail sheet.

### Test 10: Tap row opens detail sheet
1. Navigate to `/my-favourites`.
2. Tap on a player row (not the heart button).
3. **Verify:** Detail sheet opens showing player info — name, jersey, position, notes field. Heart toggle visible in sheet.

### Test 11: Close detail sheet
1. With detail sheet open from Test 10, close it (tap outside or swipe down).
2. **Verify:** Sheet closes. Player row still visible.

### Test 12: DivisionSwitcher shows correct title
1. Navigate to `/my-favourites`.
2. Take a snapshot of the header area.
3. **Verify:** DivisionSwitcher shows "My Favourites" as the page title.

### Test 13: Empty state
1. Log in as `testparent2@test.com` / `TestParent1234` (no hearted players).
2. Navigate to `/my-favourites`.
3. **Verify:** Heart icon and "Heart players on the Teams page to track them here" prompt. "Teams" is a gold link to `/teams`. No status groups visible.

### Test 14: Division switch updates page
1. Log in as `testparent@test.com`.
2. Navigate to `/my-favourites`.
3. Note the player count.
4. Open DivisionSwitcher, select a different division (if available).
5. **Verify:** Page reloads with favourites for the new division. Count may differ.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 9 | Un-hearted a player | Re-heart via Teams page detail sheet (described in test step) |

**After all tests pass, verify Test 9 revert was completed. Confirm with user that data is clean.**

## Files to Touch

1. `frontend/app/(app)/dashboard/actions.ts` — **MODIFY** (add `previousTeam` to `FavoriteStatus`, add `getMyFavouritesPageData()` action or extend existing)
2. `frontend/app/(app)/my-favourites/page.tsx` — **CREATE** (server component, fetches data, passes to client)
3. `frontend/components/dashboard/my-favourites-client.tsx` — **CREATE** (client component, renders grouped list with heart toggle + detail sheet)
4. `frontend/app/(app)/my-players/page.tsx` — **MODIFY** (replace contents with redirect to `/my-favourites`)
5. `frontend/components/layout/division-switcher.tsx` — **MODIFY** (update TITLE_MAP)
6. `frontend/components/dashboard/dashboard-client.tsx` — **MODIFY** (update link target if not already done by spec 009 v2)
7. `frontend/app/globals.css` — **MODIFY** (remove `.my-players-*` classes, add `.my-favourites-*` classes)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
