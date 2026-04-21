# Spec 009: Dashboard Redesign

**PRD Reference:** FR-039 (activity feed), FR-025 (player tracking)
**Priority:** Must Have
**Depends on:** 003 (Continuations tracker), 006 (Player management — parent)

## What This Feature Does

The Home page is replaced with a real dashboard that gives parents at-a-glance value: which levels just posted results, what happened to the players they're tracking, and whether any tracked player is missing from the next level down after being cut. Parents no longer need to manually navigate to Sessions to check for updates — the dashboard surfaces the most important information immediately.

## Current State

### Dashboard page (will be rewritten)
- `frontend/app/(app)/dashboard/page.tsx` — currently a navigation menu with cards explaining what each button does ("Header Buttons", "Menu Buttons"). No actual data.
- `frontend/components/dashboard/my-players-card.tsx` — a link card showing tracked-player count. Used only on the dashboard.

### Data sources that already exist
- **Continuation rounds:** `continuation_rounds` table stores published round results per team level. Each round has `jersey_numbers` (text[]) of continuing players, `round_number`, `team_level`, `division`, `status` (draft/published), `created_at`. Queried via `getAllPublishedRounds()` in `frontend/app/(app)/continuations/actions.ts`.
- **Player annotations:** `player_annotations` table stores per-user favorites (`is_favorite`), custom names, and notes. Queried via `getMyPlayers()` and `getPlayerAnnotations()` in `frontend/app/(app)/annotations/actions.ts`.
- **Player data:** `tryout_players` table has `jersey_number`, `division`, `status`, `team_id`, `previous_team`, `position`, `name`. Status enum includes: registered, trying_out, cut, made_team, moved_up, moved_down, withdrew.
- **Teams:** `teams` table has `name` (e.g., "AA", "A"), `division`, `association_id`.

### Navigation
- Bottom nav in `frontend/components/layout/bottom-nav.tsx` has 3 tabs: Home (`/dashboard`), Teams (`/teams`), Sessions (`/continuations`).
- Division switcher header is reused on every page via `frontend/components/layout/division-switcher.tsx`.

### Existing patterns to follow
- Server component page fetches data, passes to client component (see `frontend/app/(app)/teams/page.tsx`).
- CSS classes use `@apply` in `frontend/app/globals.css` — never inline more than 1 Tailwind class.
- The continuations page derives cuts by comparing consecutive rounds: `previousRound.jersey_numbers.filter(jn => !activeRound.jersey_numbers.includes(jn))` (see `frontend/components/continuations/round-section.tsx:154-157`).

## Changes Required

### Database

No database changes needed. All data exists in `continuation_rounds`, `player_annotations`, and `tryout_players`.

### Server Actions / API Routes

**New file: `frontend/app/(app)/dashboard/actions.ts`**

One main server action:

`getDashboardData(associationId: string, division: string)` — returns:

```
{
  activityCards: ActivityCard[]
  favoriteStatuses: FavoriteStatus[]
}
```

**ActivityCard** — one per team level with a recent round (published within the last 5 days):
- `teamLevel` (string) — e.g., "AA", "A"
- `roundNumber` (number)
- `continuingCount` (number) — jersey_numbers.length of latest round
- `cutCount` (number) — jerseys in previous round NOT in latest round
- `publishedAt` (string) — created_at of the latest round
- `isFinalTeam` (boolean) — whether this round is marked as final team

Activity cards should be sorted by team level rank: AA, A, BB, B, C.

**FavoriteStatus** — one per hearted player:
- `playerId` (string)
- `playerName` (string) — annotation custom_name or player.name
- `jerseyNumber` (string)
- `position` (string)
- `statusText` (string) — the derived human-readable status (see logic below)
- `statusType` ("continuing" | "cut" | "made_team" | "missing" | "registered")
- `division` (string)

**Status derivation logic** (per hearted player):

1. If `tryout_players.status` is `made_team` → statusText = "Made {team.name}", statusType = "made_team"
2. Otherwise, look at all published rounds in the player's division. For each team level (ordered AA → A → BB → B → C), find rounds where the player's jersey_number appears:
   - Find the **latest round** where the jersey appears → that's the player's current level and round
   - Check if a **later round exists** at that level where the jersey does NOT appear → player was cut
3. Most recent change wins:
   - If cut from level X at round N → statusText = "Cut R{N} ({X})"
   - If continuing at level X through round N → statusText = "Continuing R{N} ({X})"
   - If cut from level X and NOT seen in any round at the next level down → append to statusText: " · Not at {nextLevel}", statusType = "missing"
4. If no rounds data at all → statusText = player's status field from tryout_players (e.g., "Registered", "Trying Out"), statusType = "registered"

**Level hierarchy for "missing" detection:** AA → A → BB → B → C. If a player was cut from AA, the next level is A. If cut from B, the next level is C. If cut from C, there is no next level (skip the check).

### Pages

**Modified: `frontend/app/(app)/dashboard/page.tsx`** (rewrite)

Server component that:
1. Calls `requireAssociation()` for auth context
2. Fetches divisions and active division (same pattern as other pages)
3. Calls `getDashboardData(associationId, activeDivision)`
4. Renders `DivisionSwitcher` header (same as current)
5. Passes data to a new `DashboardClient` component

### Components

**New: `frontend/components/dashboard/dashboard-client.tsx`**

Client component (needs `"use client"` for tapping player rows to open detail sheet). Props:
- `activityCards: ActivityCard[]`
- `favoriteStatuses: FavoriteStatus[]`

Renders three sections in order:

1. **Activity section** — If `activityCards` is non-empty, show a section header "Recent Results" and one card per team level. Each card shows:
   - Team level badge + "Round {N}"
   - "{cutCount} cuts · {continuingCount} continuing"
   - If `isFinalTeam` is true, show "Final Roster" instead of cut/continuing counts
   - Entire card is tappable → navigates to `/continuations`
   - If no activity cards (nothing in last 5 days), show a muted line: "No results in the last 5 days"

2. **Favorites section** — If `favoriteStatuses` is non-empty, show section header "My Players" with a count badge, then a list of player rows. Each row shows:
   - Jersey number
   - Position badge (if not "?")
   - Player name (custom name if set, original name in muted text if different)
   - Status text on the right side, color-coded:
     - "Continuing R{N}" — green/positive
     - "Cut R{N}" — red/negative
     - "Made {Team}" — gold/highlight
     - "Not at {Level}" — orange/warning (appended after cut text)
     - Fallback statuses (Registered, etc.) — muted/neutral
   - Players with statusType "missing" should be visually distinguished (e.g., a small alert icon or the "Not at {Level}" text in orange)
   - Rows are sorted: "missing" players first, then by division → team level rank → jersey number

3. **Empty state** — If `favoriteStatuses` is empty (user has no hearts), show a centered prompt with a Heart icon: "Heart players on the Teams page to track them here." The word "Teams" should be a link to `/teams`.

**Delete: `frontend/components/dashboard/my-players-card.tsx`** — no longer needed (replaced by the favorites section above). Remove the import from the dashboard page.

### Styles

New CSS classes in `frontend/app/globals.css` under a `/* -- Dashboard Redesign -- */` comment block. Replace the existing dashboard link-card styles (`.dashboard-link-card`, `.dashboard-link-card-icon`, etc.) with new dashboard styles. Keep `.dashboard-page` and `.dashboard-header` classes.

New classes needed:
- `.dashboard-section-header` — section title ("Recent Results", "My Players")
- `.dashboard-activity-card` — tappable card for each team level's latest round
- `.dashboard-activity-badge` — team level badge within the card
- `.dashboard-activity-stats` — cut/continuing text
- `.dashboard-activity-empty` — "No results in the last 5 days" muted text
- `.dashboard-fav-row` — player row in favorites section
- `.dashboard-fav-status` — status text (right-aligned)
- `.dashboard-fav-status-continuing` — green color variant
- `.dashboard-fav-status-cut` — red color variant
- `.dashboard-fav-status-made` — gold color variant
- `.dashboard-fav-status-missing` — orange color variant
- `.dashboard-fav-status-neutral` — muted color variant
- `.dashboard-empty` — empty state container (centered, muted)

Use existing design tokens from globals.css: `--dm-gold`, `--dm-cinnabar` (red), `--dm-dust` (muted), `--dm-umber`, `--dm-dune`, `--dm-parchment`.

## Key Implementation Details

1. **Division-scoped data:** The dashboard shows data for the user's active division only. When the user switches divisions via the DivisionSwitcher, the page reloads with new data (same pattern as Teams and Continuations pages).

2. **5-day window for activity cards:** Compare `created_at` of the latest published round against `Date.now() - 5 * 24 * 60 * 60 * 1000`. Do this server-side in the action, not client-side.

3. **Cut computation between rounds:** For each team level, fetch the two most recent published rounds (ordered by `round_number` desc, limit 2). Cuts = jerseys in round N-1 but not in round N. If only one round exists, cut count is 0.

4. **Cross-level "missing" detection:** After determining a player was cut from level X, check if their jersey_number appears in ANY published round at the next level down. The level order is hard-coded: `["AA", "A", "BB", "B", "C"]`. Use `indexOf` to find the next level. If the player is cut from the lowest level (C), skip the check.

5. **Annotation custom names:** When displaying a hearted player, prefer `player_annotations.custom_name` over `tryout_players.name`. Show the original name in muted text if a custom name is set (same pattern as My Players page — see `frontend/app/(app)/my-players/page.tsx:89-91`).

6. **No client-side data fetching:** All data is fetched server-side in the page component and passed as props. No `useEffect` data loading on the dashboard.

7. **Performance:** The `getDashboardData` action should make as few database queries as possible. Suggested approach:
   - 1 query: all published rounds for the division
   - 1 query: user's favorite annotations (joined with tryout_players)
   - 1 query: teams (for "made team" display names)
   - Derive everything else in memory

8. **Existing page boilerplate:** Follow the exact same pattern as `frontend/app/(app)/teams/page.tsx` for the page component structure: `requireAssociation()`, division fetching, `DivisionSwitcher` rendering, pending corrections count, etc.

## Acceptance Criteria

- [ ] Dashboard shows activity cards for team levels with rounds published in the last 5 days
- [ ] Activity cards show correct continuing and cut counts
- [ ] Activity cards are tappable and navigate to `/continuations`
- [ ] Activity cards sorted by team level rank (AA first, C last)
- [ ] "No results in the last 5 days" shown when no recent rounds exist
- [ ] Hearted players shown with correct derived status (continuing, cut, made team)
- [ ] "Not at {Level}" shown for players cut from a higher level but not seen at the next level
- [ ] Missing players are sorted to the top of the favorites list
- [ ] Players with custom names show the custom name (with original in muted text)
- [ ] Empty state prompts user to heart players on the Teams page
- [ ] Division switcher changes the dashboard data (same as other pages)
- [ ] `my-players-card.tsx` deleted, no dead imports
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow these rules:

1. **Prefer read-only tests.** Verify by navigating and taking snapshots — do not modify data unless the test absolutely requires it.
2. **When a test MUST write data** (e.g., heart a player, set a custom name), log every mutation in the "Test Mutations Log" at the end of this section.
3. **Revert all test mutations after testing.** After all tests pass, undo every write operation listed in "Test Mutations Log".
4. **Confirm with the user.** Before finishing, present the list of any remaining data changes and ask the user to verify everything was restored.
5. **Never delete real player records or change real player statuses during testing.**

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, association Nepean Wildcats). The dev server should be running at `http://localhost:3000`. The test user should already have hearted players from previous sessions. If not, navigate to `/teams` and heart 3-4 players — but **log each hearted player in the Test Mutations Log** below so they can be un-hearted after testing. The active division should be U15 (default).

### Test 1: Dashboard loads with activity cards
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot of the page
3. **Verify:** The page shows a "Recent Results" section (if any continuation rounds were published in the last 5 days for U15). If recent rounds exist, each card shows a team level, round number, and cut/continuing stats. If no recent rounds, verify "No results in the last 5 days" text appears.

### Test 2: Activity card navigation
1. Navigate to `http://localhost:3000/dashboard`
2. If an activity card is visible, click/tap it
3. **Verify:** The browser navigates to `/continuations`

### Test 3: Favorites section shows hearted players
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot of the page
3. **Verify:** A "My Players" section appears with the user's hearted players listed. Each row shows jersey number, name, and a status text on the right.

### Test 4: Favorite player status display — continuing
1. Navigate to `http://localhost:3000/dashboard`
2. Find a hearted player whose jersey appears in the latest round for their team level
3. **Verify:** Their status shows "Continuing R{N} ({level})" in green-tinted text

### Test 5: Favorite player status display — cut
1. Navigate to `http://localhost:3000/dashboard`
2. Find a hearted player whose jersey was in a previous round but not the latest
3. **Verify:** Their status shows "Cut R{N} ({level})" in red-tinted text

### Test 6: Missing from next level alert
1. Navigate to `http://localhost:3000/dashboard`
2. Find a hearted player who was cut from a higher level (e.g., AA) and whose jersey does not appear in any round at the next level (e.g., A)
3. **Verify:** Their status includes "Not at {nextLevel}" text in orange, and they appear near the top of the favorites list

### Test 7: Made team status
1. Navigate to `http://localhost:3000/dashboard`
2. If any hearted player has `status = made_team`, verify their row shows "Made {team name}" in gold text

### Test 8: Empty state — no favorites
1. Log in as `testparent2@test.com` / `TestParent1234` (or a user with no hearted players)
2. Navigate to `http://localhost:3000/dashboard`
3. **Verify:** The page shows a centered empty state with a Heart icon and text prompting to heart players on the Teams page. The word "Teams" is a link to `/teams`.

### Test 9: Division switch changes dashboard data
1. Navigate to `http://localhost:3000/dashboard`
2. Note the current content (activity cards and/or favorites)
3. Tap the division badge (e.g., "NW-U15") in the header to open the division switcher
4. Select a different division (e.g., U13 or U18)
5. **Verify:** The dashboard reloads with data for the new division. Activity cards reflect that division's rounds. Favorites show only players from that division.

### Test 10: Custom name display
1. Check if any hearted player already has a custom name set (visible on the My Players page or Teams page detail sheet). If none do, set a custom name on one player via the detail sheet — **log this in the Test Mutations Log** so it can be reverted.
2. Navigate to `http://localhost:3000/dashboard`
3. **Verify:** The player row shows the custom name, with the original database name in muted/smaller text

### Test 11: No old dashboard content remains
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot
3. **Verify:** There are no "Header Buttons" or "Menu Buttons" section headers. No link cards explaining what each nav button does. The page shows real data or the empty state — not a navigation menu.

### Test 12: Admin sees same dashboard (no role-specific differences)
1. Log in as `testadmin@test.com` / `TestAdmin1234` (group_admin role)
2. Navigate to `http://localhost:3000/dashboard`
3. **Verify:** The dashboard displays the same structure: activity cards, favorites (if any hearted), or empty state. No admin-only content on the dashboard itself.

### Test Mutations Log

Log every write operation performed during testing. Revert all after tests pass.

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Setup | (if needed) Hearted player #XX (id: ...) | Un-heart via long-press detail sheet |
| Test 10 | (if needed) Set custom name on player #XX | Clear custom name in detail sheet |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

1. `frontend/app/(app)/dashboard/actions.ts` — **CREATE** (new server action)
2. `frontend/app/(app)/dashboard/page.tsx` — **REWRITE** (replace nav menu with data-driven dashboard)
3. `frontend/components/dashboard/dashboard-client.tsx` — **CREATE** (client component for interactivity)
4. `frontend/components/dashboard/my-players-card.tsx` — **DELETE** (replaced by favorites section)
5. `frontend/app/globals.css` — **MODIFY** (replace old dashboard link-card styles with new dashboard styles)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (un-heart players, restore names, etc.). Confirm with the user that all test data has been cleaned up.
