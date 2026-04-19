# Spec 004: Division Switcher

**PRD Reference:** FR-039 (Association selector), custom feature
**Priority:** Must Have
**Depends on:** None

## What This Feature Does

Parents tap the association-division badge (e.g., "NW-U15") in the header to open a bottom sheet modal listing all available divisions (U11, U13, U15, U18) with player counts. Selecting a division updates the badge, filters the Teams and Sessions pages to that division's data, and saves the preference to the database so it persists across sessions and devices. The Dashboard page content is unchanged — only the header badge updates to reflect the active division.

## Current State

### Header Badge (display only, not interactive)
- **`frontend/components/layout/teams-header.tsx`** — Renders `<span className="app-header-group-label">{label}</span>` where `label` is computed as `${groupLabel}-${division}` (e.g., "NW-U15"). Currently a static `<span>`, not clickable.

### Division Calculation (computed per page, no user selection)
Each page independently computes divisions from player data:
- **`frontend/app/(app)/dashboard/page.tsx`** (line 19–20) — `[...new Set(playersData.map(p => p.division))].sort()`, joins with `/` if multiple.
- **`frontend/app/(app)/teams/page.tsx`** (line 56–57) — Same pattern. Passes ALL players/teams to `TeamsPageClient` regardless of division.
- **`frontend/app/(app)/continuations/page.tsx`** (line 23–24) — Same pattern, but hardcodes `activeDivision = divisions[0]`.

### Data Filtering
- **Teams page:** Fetches ALL players and ALL teams for the association. `TeamsPageClient` and its children (`PredictionBoard`, `PreviousTeamsView`) receive everything — no division filter applied at query or component level.
- **Continuations page:** Fetches rounds for only the first division (`divisions[0]`), so it already filters — just not by user choice.
- **Dashboard page:** Only queries `division` column (not full player data). Content is static cards and links.

### Existing Database Table (unused)
- **`backend/supabase/migrations/20260418000004_create_user_tracked_groups.sql`** — `user_tracked_groups` table already exists with `user_id`, `association_id`, `division`, `label`, `is_active` columns. Has RLS policies. Currently unused by any application code. This table will store the user's active division preference.

### Bottom Sheet Pattern (existing)
- **`frontend/components/teams/long-press-menu.tsx`** — Existing bottom sheet with overlay, used for player actions. Uses CSS classes `.long-press-overlay` and `.long-press-sheet` with `fadeIn` and `slideUp` animations defined in `globals.css` (lines 714–776).

### Auth Helper
- **`frontend/lib/auth.ts`** — `requireAssociation()` returns `{ supabase, user, associationId, role, association }`. Does not return division info.

## Changes Required

### Database

**No new migration needed.** The `user_tracked_groups` table already exists with the right schema. We will use it as follows:

- One row per user per association per division
- `is_active = true` marks the user's currently selected division
- When switching divisions: set all rows for this user+association to `is_active = false`, then set the selected one to `is_active = true` (or upsert)
- If no active row exists, the app defaults to the division with the most players

### Server Actions / API Routes

**New file: `frontend/app/(app)/division/actions.ts`**

```
"use server"

getDivisions(associationId: string): Promise<{ division: string, playerCount: number }[]>
  — Queries tryout_players grouped by division, returns sorted list with counts

getActiveDivision(associationId: string): Promise<string | null>
  — Queries user_tracked_groups for is_active = true row, returns division or null

setActiveDivision(associationId: string, division: string): Promise<{ error?: string }>
  — Sets is_active = false on all user's rows for this association
  — Upserts the selected division row with is_active = true
```

### Pages

**`frontend/app/(app)/dashboard/page.tsx`** — Modified:
- Fetch the user's active division from `user_tracked_groups`
- Pass `divisions` array and `activeDivision` to header
- Header badge shows `NW-{activeDivision}` (e.g., "NW-U15")
- Dashboard content (cards, links) is unchanged
- Pass `divisions`, `activeDivision`, `associationId`, `abbreviation`, and `initials` to a new `DivisionSwitcherWrapper` client component that wraps the header

**`frontend/app/(app)/teams/page.tsx`** — Modified:
- Fetch the user's active division
- Filter players query: `.eq("division", activeDivision)` instead of fetching all
- Filter teams query: `.eq("division", activeDivision)` instead of fetching all
- Filter predictions query: `.eq("division", activeDivision)` instead of fetching all divisions
- Pass `divisions`, `activeDivision` to header wrapper
- Badge shows `NW-{activeDivision}`

**`frontend/app/(app)/continuations/page.tsx`** — Modified:
- Fetch the user's active division instead of hardcoding `divisions[0]`
- Filter players to active division
- Fetch rounds for active division (already does this, just use the correct division)
- Pass `divisions`, `activeDivision` to header wrapper

### Components

**New: `frontend/components/layout/division-switcher.tsx`** — Client component:
- Props: `divisions: { division: string, playerCount: number }[]`, `activeDivision: string`, `associationId: string`, `abbreviation: string`, `initials: string`, `title?: string`
- Renders the `TeamsHeader` but makes the badge a `<button>` instead of a `<span>`
- Badge shows a small down-chevron icon (ChevronDown from lucide-react) after the label
- On tap: opens the bottom sheet modal with division options
- Each option shows division name (e.g., "U15") and player count (e.g., "42 players")
- The currently active division has a filled radio indicator and highlighted border
- Tapping an option calls `setActiveDivision()` server action, then triggers a page reload via `router.refresh()`
- Cancel button or tapping the overlay dismisses the sheet
- Uses same animation pattern as the existing long-press menu (slideUp + fadeIn)

**Modified: `frontend/components/layout/teams-header.tsx`** — Keep as-is for the actual header rendering, but export it so `DivisionSwitcher` can compose with it. The badge will be extracted into a prop pattern where either a static `<span>` or a clickable `<button>` can be rendered.

Actually, simpler approach: `DivisionSwitcher` replaces `TeamsHeader` entirely on all three pages. It renders the same header layout but with the badge as a button. This avoids modifying `TeamsHeader` (which would break if used elsewhere without division context).

### Styles

Add to `frontend/app/globals.css`:

```
/* Division Switcher Badge */
.division-badge — button version of app-header-group-label, same styling plus cursor pointer and chevron
.division-badge-chevron — small down arrow icon next to the label

/* Division Switcher Bottom Sheet */
.division-overlay — same pattern as .long-press-overlay (fixed inset-0 z-20, dark backdrop, fadeIn)
.division-sheet — same pattern as .long-press-sheet (fixed bottom-0, rounded top, slideUp)
.division-sheet-handle — horizontal grabber bar at top of sheet
.division-sheet-title — "Select Division" heading
.division-option — individual division row (flex, rounded, border, padding)
.division-option-active — highlighted border and background for current selection
.division-option-name — division name text (bold)
.division-option-count — player count text (muted)
.division-option-radio — radio circle indicator
.division-option-radio-checked — filled radio for active division
.division-cancel-btn — full-width cancel button at bottom of sheet
```

Desktop media query: `.division-overlay` and `.division-sheet` use `position: absolute` and `max-width: 393px` to stay within the phone frame (same as `.long-press-overlay` and `.long-press-sheet`).

## Key Implementation Details

### Default Division Logic
When no `user_tracked_groups` row has `is_active = true` for this user+association:
1. Query `tryout_players` grouped by division, count players per division
2. Pick the division with the highest count
3. Do NOT auto-insert a row — only insert when the user explicitly taps a division

### Page Reload After Division Switch
After calling `setActiveDivision()`, call `router.refresh()` to re-run the server component data fetches with the new division. This is simpler than lifting all data into client state. The server components will re-query with the new active division.

### Division Filtering at Server Level
Currently the Teams page fetches ALL players and teams. After this change, the server component queries will filter by division:
```
.eq("division", activeDivision)
```
This means `TeamsPageClient` will receive only players/teams for the active division. `PredictionBoard` and `PreviousTeamsView` already work correctly with a subset of players, so no changes needed in those components.

### Position Filter + Division Switcher Interaction
The position filter (All/F/D/G) operates on the players received by `TeamsPageClient`. Since those players will now be pre-filtered to one division, the position filter will naturally only show players from the active division. No interaction issues.

### Reset Button Scope
The reset button in the position filter currently resets prediction/previous-team orders for the entire association. After this change, the reset server actions should be scoped to the active division:
- `resetPredictionOrders` should accept an optional `division` parameter
- `resetPreviousTeamOrders` should remain association-wide (previous teams span divisions)

### Continuations Page Division Awareness
The continuations page currently passes `division` as a prop to `ContinuationsPageClient`. After this change, it will pass the user's active division instead of `divisions[0]`. No changes needed to `ContinuationsPageClient` itself — it already accepts `division` as a prop.

### Single-Division Associations
If an association has only one division, the badge still shows `NW-U15` but tapping it opens a sheet with only one option. This is fine — it confirms to the user which division they're viewing. Alternatively, the badge could skip the chevron and be non-interactive when there's only one division. **Implement the simpler path: always show the chevron, always allow opening the sheet**, even with one division. Avoids conditional logic.

### RLS
The `user_tracked_groups` table already has RLS policies:
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid() AND user_belongs_to_association(association_id)`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

No new policies needed.

## Acceptance Criteria

- [ ] Tapping the header badge opens a bottom sheet modal listing all divisions
- [ ] Each division shows its name and player count
- [ ] The currently active division is visually highlighted (border + radio fill)
- [ ] Selecting a different division closes the sheet and reloads the page with filtered data
- [ ] The header badge updates to show the new division (e.g., "NW-U13")
- [ ] The Teams page shows only players and teams for the active division
- [ ] The Sessions page shows only rounds for the active division
- [ ] The Dashboard page content is unchanged (only the header badge updates)
- [ ] The selected division persists across page navigations (Home → Teams → Sessions)
- [ ] The selected division persists across browser sessions (close and reopen)
- [ ] If no division preference is saved, the division with the most players is shown
- [ ] Tapping Cancel or the overlay dismisses the sheet without changing division
- [ ] The bottom sheet animates in (slideUp) and overlay fades in (fadeIn)
- [ ] On desktop, the sheet and overlay are contained within the 393px phone frame
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

Step-by-step browser tests to verify every variation of this feature. Each test is runnable via the Playwright MCP browser tools (navigate, snapshot, click, type, etc.).

**Setup:** The test user is logged in and belongs to the "Nepean Wildcats" association (join code "NGHA2026"). The association has players in division "U15" (131 players). The dev server is running on `http://localhost:3000`. The user has no saved division preference (fresh state).

**Login Steps (run before each test unless stated otherwise):**
1. Navigate to `http://localhost:3000/login`
2. Enter email and password for the test user
3. Click "Sign In"
4. Verify redirect to `/dashboard`

---

### Test 1: Badge displays correct default division
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot of the page
3. **Verify:** The header badge shows "NW-U15" (the division with the most players)
4. **Verify:** A down-chevron icon is visible next to or within the badge

### Test 2: Badge is tappable and opens bottom sheet
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot and find the header badge element
3. Click the header badge ("NW-U15")
4. Take a snapshot of the page
5. **Verify:** A dark overlay covers the content
6. **Verify:** A bottom sheet is visible with the title "Select Division"
7. **Verify:** The sheet lists at least one division option

### Test 3: Division options show names and player counts
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge
3. Take a snapshot of the bottom sheet
4. **Verify:** Each division option shows the division name (e.g., "U15")
5. **Verify:** Each division option shows a player count (e.g., "131 players")
6. **Verify:** The currently active division (U15) has a highlighted/selected visual indicator

### Test 4: Cancel button dismisses the sheet
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge to open the sheet
3. Take a snapshot to confirm the sheet is open
4. Click the "Cancel" button
5. Take a snapshot
6. **Verify:** The bottom sheet is no longer visible
7. **Verify:** The overlay is gone
8. **Verify:** The header badge still shows the same division (unchanged)

### Test 5: Overlay tap dismisses the sheet
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge to open the sheet
3. Click on the dark overlay area (above the sheet)
4. Take a snapshot
5. **Verify:** The bottom sheet is dismissed
6. **Verify:** The division is unchanged

### Test 6: Selecting a different division updates the Teams page
**Prerequisite:** Association must have players in at least 2 divisions. If only U15 exists, this test should verify the UI still works when tapping the same division (no change expected). For full testing, seed a second division's data.

1. Navigate to `http://localhost:3000/teams`
2. Take a snapshot and note the current teams displayed (e.g., U15 AA, U15 A, U15 BB...)
3. Click the header badge
4. Click a different division option (e.g., "U13") if available
5. Wait for the page to reload
6. Take a snapshot
7. **Verify:** The header badge now shows "NW-U13"
8. **Verify:** The teams displayed are U13 teams (e.g., U13 AA, U13 A), not U15 teams
9. **Verify:** The player names/jersey numbers are different from the U15 view

### Test 7: Selecting same division closes sheet without reload
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge
3. Click the already-active division (the one with the filled radio)
4. Take a snapshot
5. **Verify:** The sheet closes
6. **Verify:** The page content is unchanged

### Test 8: Division persists across page navigation (Teams → Dashboard → Teams)
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge and select a division (e.g., "U13" if available, otherwise "U15")
3. Wait for reload
4. Navigate to `http://localhost:3000/dashboard` (click Home in bottom nav)
5. Take a snapshot
6. **Verify:** The Dashboard header badge shows the same division (e.g., "NW-U13")
7. Navigate to `http://localhost:3000/teams` (click Teams in bottom nav)
8. Take a snapshot
9. **Verify:** The Teams header badge still shows "NW-U13"
10. **Verify:** Only U13 teams/players are displayed

### Test 9: Division persists across page navigation (Teams → Sessions)
1. Navigate to `http://localhost:3000/teams`
2. Note the active division from the badge
3. Navigate to `http://localhost:3000/continuations` (click Sessions in bottom nav)
4. Take a snapshot
5. **Verify:** The Sessions header badge shows the same division as Teams

### Test 10: Division persists after page refresh (browser reload)
1. Navigate to `http://localhost:3000/teams`
2. If multiple divisions exist, switch to a non-default one
3. Reload the page (navigate to the same URL again)
4. Take a snapshot
5. **Verify:** The header badge shows the previously selected division
6. **Verify:** The page content matches that division

### Test 11: Dashboard content is unchanged regardless of division
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot and note all visible cards and links
3. Click the header badge and select a different division (if available)
4. Wait for reload
5. Take a snapshot
6. **Verify:** The Dashboard still shows the same cards: "Age Picker", "Profile", "Home", "Teams", "Tryout Sessions"
7. **Verify:** No content on the Dashboard has changed except the header badge text

### Test 12: Badge appears on all three pages
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot
3. **Verify:** Header badge is visible with division and chevron
4. Navigate to `http://localhost:3000/teams`
5. Take a snapshot
6. **Verify:** Header badge is visible with division and chevron
7. Navigate to `http://localhost:3000/continuations`
8. Take a snapshot
9. **Verify:** Header badge is visible with division and chevron

### Test 13: Bottom sheet works on Teams page
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge
3. Take a snapshot
4. **Verify:** Bottom sheet opens with division options
5. **Verify:** The sheet has a grabber handle at top, title "Select Division", options, and Cancel button

### Test 14: Bottom sheet works on Sessions page
1. Navigate to `http://localhost:3000/continuations`
2. Click the header badge
3. Take a snapshot
4. **Verify:** Bottom sheet opens with division options
5. Click Cancel
6. **Verify:** Sheet dismisses

### Test 15: Bottom sheet works on Dashboard page
1. Navigate to `http://localhost:3000/dashboard`
2. Click the header badge
3. Take a snapshot
4. **Verify:** Bottom sheet opens with division options
5. Click Cancel
6. **Verify:** Sheet dismisses

### Test 16: Desktop phone frame containment
1. Resize the browser window to 1280x800 (desktop viewport)
2. Navigate to `http://localhost:3000/teams`
3. Click the header badge
4. Take a screenshot
5. **Verify:** The overlay and bottom sheet are contained within the phone frame (393px wide), not covering the full browser width
6. **Verify:** The dark background outside the phone frame is visible around the sheet

### Test 17: Mobile viewport layout
1. Resize the browser window to 393x852 (mobile viewport)
2. Navigate to `http://localhost:3000/teams`
3. Click the header badge
4. Take a screenshot
5. **Verify:** The bottom sheet spans the full width
6. **Verify:** The overlay covers the full viewport
7. **Verify:** Division options are tappable with adequate touch targets

### Test 18: View toggle and position filter state resets on division switch
1. Navigate to `http://localhost:3000/teams`
2. Click the "Previous Teams" view toggle
3. Click the "D" position filter chip
4. Take a snapshot to confirm the view and filter are active
5. Click the header badge and select a different division (if available)
6. Wait for reload
7. Take a snapshot
8. **Verify:** The view toggle is back to "Predictions" (default)
9. **Verify:** The position filter is back to "All" (default)
10. **Verify:** The instruction text shows the default message

### Test 19: Default division is the one with most players (fresh user)
**Prerequisite:** User has NO rows in `user_tracked_groups` for this association. If you need to reset, delete all rows for this user via the Supabase dashboard.

1. Navigate to `http://localhost:3000/teams`
2. Take a snapshot
3. **Verify:** The badge shows the division with the most players (U15 in the NGHA case, with 131 players)
4. Click the header badge
5. Take a snapshot
6. **Verify:** U15 shows as the selected (radio filled) option

### Test 20: Player counts are accurate
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge
3. Take a snapshot of the division list
4. Note the player count shown for each division
5. Close the sheet
6. **Verify:** The number of players visible on the Teams page matches the count shown in the sheet for the active division (may need to expand all team sections and count)

### Test 21: Sheet dismisses on Escape key
1. Navigate to `http://localhost:3000/teams`
2. Click the header badge to open the sheet
3. Press the Escape key
4. Take a snapshot
5. **Verify:** The sheet is dismissed
6. **Verify:** The division is unchanged

### Test 22: Division badge text updates immediately (no stale state)
1. Navigate to `http://localhost:3000/teams`
2. Note the current badge text
3. Click the badge and select a new division
4. Wait for page reload
5. **Verify:** The badge text updates to the new division immediately — no flash of old text

### Test 23: Prediction orders are scoped to division
1. Navigate to `http://localhost:3000/teams` (on U15)
2. Drag a player to reorder within a team (if drag is available in test tooling, otherwise skip)
3. Switch to a different division via the badge
4. Switch back to U15
5. **Verify:** The custom drag order from step 2 is preserved (orders are saved per-division)

### Test 24: Sessions page shows correct rounds for selected division
1. Navigate to `http://localhost:3000/continuations`
2. Take a snapshot
3. **Verify:** Any rounds shown correspond to the active division
4. If the active division has no rounds, verify the empty state is displayed
5. Switch division via badge (if multiple divisions exist)
6. **Verify:** Rounds update to match the new division (or show empty state)

### Test 25: Single-division association still shows the switcher
**Prerequisite:** For this test, use an association that has players in only one division.

1. Navigate to `http://localhost:3000/teams`
2. **Verify:** The badge shows the single division with a chevron
3. Click the badge
4. **Verify:** The sheet opens with one division option, showing it as selected
5. Click Cancel
6. **Verify:** Sheet dismisses normally

---

**Coverage Checklist:**
- [x] **Happy path** — switch division, page reloads with correct data (Tests 6, 8, 9)
- [x] **Empty state** — single division, no preference saved (Tests 19, 25)
- [x] **Dismiss behavior** — cancel button, overlay tap, escape key (Tests 4, 5, 21)
- [x] **Persistence** — across pages, across sessions, after reload (Tests 8, 9, 10)
- [x] **All pages** — badge and sheet work on Dashboard, Teams, Sessions (Tests 12–15)
- [x] **Desktop vs mobile** — phone frame containment, full-width mobile (Tests 16, 17)
- [x] **State reset** — view toggle and position filter reset on switch (Test 18)
- [x] **Data accuracy** — player counts match, correct teams shown (Tests 6, 20)
- [x] **No stale UI** — badge updates immediately (Test 22)
- [x] **Interaction combos** — division + predictions + position filter (Tests 18, 23)
- [x] **Scoped data** — rounds match division on Sessions page (Test 24)
- [x] **Same-division tap** — selecting current division just closes sheet (Test 7)
- [x] **Dashboard unchanged** — content identical regardless of division (Test 11)

## Files to Touch

**New files:**
1. `frontend/components/layout/division-switcher.tsx` — Bottom sheet modal component + header badge button
2. `frontend/app/(app)/division/actions.ts` — Server actions for getting/setting active division

**Modified files:**
3. `frontend/app/(app)/dashboard/page.tsx` — Replace `TeamsHeader` with `DivisionSwitcher`, fetch active division
4. `frontend/app/(app)/teams/page.tsx` — Replace `TeamsHeader` with `DivisionSwitcher`, filter queries by active division
5. `frontend/app/(app)/continuations/page.tsx` — Replace `TeamsHeader` with `DivisionSwitcher`, use active division instead of `divisions[0]`
6. `frontend/app/globals.css` — Add division switcher styles (badge button, overlay, sheet, options, cancel)

**Unchanged files (for reference):**
- `frontend/components/layout/teams-header.tsx` — Keep as-is, may still be used by admin pages or other contexts
- `frontend/components/teams/teams-page-client.tsx` — No changes needed; it receives pre-filtered data
- `frontend/components/teams/prediction-board.tsx` — No changes needed
- `frontend/components/teams/previous-teams-view.tsx` — No changes needed
- `frontend/lib/auth.ts` — No changes needed
- `frontend/types/index.ts` — No changes needed (UserTrackedGroup type can be derived from `Tables<"user_tracked_groups">` if needed)
- `backend/supabase/migrations/` — No new migration needed

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
