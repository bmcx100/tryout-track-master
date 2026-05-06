# Spec 037: Favourite Made Team Split — Per-Level Cards and Ordering

**PRD Reference:** FR-025 (player tracking), FR-039 (activity feed)
**Priority:** Must Have
**Depends on:** 023 (Fix favourite logic), 033 (Complete level + dashboard favourites)

## What This Feature Does

Fixes how "Made Team" favourites are displayed on the dashboard and `/my-favourites` page. Currently all Made Team favourites are lumped into a single card/section regardless of which team level they made. This change splits them into **separate cards per team level** (e.g., one card for "Made U15 AA", another for "Made U15 A"), displays team names from the database when available, and reorders the favourite cards so that Continuing and Cut from the active round appear first, followed by Made Team cards in reverse level order (most recently completed first), then Registered.

## Current State

### FavoriteStatus type
**File:** `frontend/app/(app)/dashboard/actions.ts` (lines 37-48)

```
export type FavoriteStatus = {
  playerId: string
  playerName: string
  jerseyNumber: string
  position: string
  statusText: string
  statusType: "continuing" | "cut" | "made_team" | "registered"
  division: string
  originalName: string | null
  previousTeam: string | null
  roundType: "round1" | "regular" | "final" | null
}
```

**Problem:** No `teamLevel` field. The UI cannot distinguish which team level a `made_team` player belongs to without parsing `statusText`.

### deriveFavouriteStatuses()
**File:** `frontend/app/(app)/dashboard/actions.ts` (lines 356-560)

Three paths produce `made_team` statuses:

1. **DB override** (lines 366-389): Players with `status === "made_team"` in `tryout_players`. Sets `statusText` to `Made {teamName}` using the team lookup, or `Made Team` if no team assigned. No `teamLevel` field emitted.

2. **Active level final round** (lines 513-527): Players on the active level's final team round. Sets `statusText = "Made Team"` — no level info at all.

3. **Completed level persistence** (lines 530-557): Players on completed levels' final rounds. Sets `statusText = "Made Team ({level})"`. Level info is embedded in text only.

### Dashboard favourites — buildStatusGroups()
**File:** `frontend/components/dashboard/dashboard-client.tsx` (lines 17-34)

Groups by `statusType` using a fixed order: `["continuing", "made_team", "cut", "registered"]`. All `made_team` players end up in one group regardless of team level.

### Dashboard favourites — getStatusLabel()
**File:** `frontend/components/dashboard/dashboard-client.tsx` (lines 48-61)

For `made_team`, uses the first player's `statusText` as the label. If multiple levels are mixed, only the first player's level appears.

### My Favourites page — buildStatusGroups()
**File:** `frontend/components/dashboard/my-favourites-client.tsx` (lines 31-46)

Same logic as dashboard — groups by `statusType`, same fixed order, same single `made_team` group.

### My Favourites page — getStatusLabel()
**File:** `frontend/components/dashboard/my-favourites-client.tsx` (lines 48-58)

Same logic as dashboard — first player's `statusText` used for label.

### Teams table
**File:** `backend/supabase/migrations/20260417000004_create_teams.sql`

The `teams` table has `id`, `name` (e.g., "U15 AA"), `division`, `display_order`, `max_roster_size`. No `team_level` column. To find the team name for a given level, match `LEVEL_ORDER` values against team names.

### LEVEL_ORDER constant
**File:** `frontend/app/(app)/dashboard/actions.ts` (line 5)

```
const LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]
```

AA is the highest rank (finalized earliest), C is the lowest rank (finalized last/most recently).

## Changes Required

### Database
No database changes needed.

### Server Actions / API Routes

**Modify `FavoriteStatus` type in `frontend/app/(app)/dashboard/actions.ts`:**

Add a `teamLevel` field:

```
export type FavoriteStatus = {
  ...existing fields...
  teamLevel: string | null   // NEW — e.g., "AA", "A", "BB", "B", "C"
}
```

**Modify `deriveFavouriteStatuses()` in `frontend/app/(app)/dashboard/actions.ts`:**

Three changes, one per `made_team` path:

1. **DB override path** (lines 366-389): After looking up the team from `teamsMap`, determine the team level by matching `LEVEL_ORDER` values against the team name. For example, if team name is "U15 AA", check each level in `LEVEL_ORDER` — "AA" is found in the name, so `teamLevel = "AA"`. If no match, check if the player's jersey appears on any final team round and use that round's `team_level`. Set `teamLevel` on the emitted `FavoriteStatus`. Also update `statusText`: use `Made {teamName}` when a team name is available (already done), fall back to `Made Team ({teamLevel})` when only the level is known, or `Made Team` as last resort.

2. **Active level final round path** (lines 513-527): Set `teamLevel` to the current active level variable (already known as `level` in the loop). Update `statusText` from `"Made Team"` to include the team name: build a `teamNameByLevel` lookup from `teamsMap` (map each team to its level by matching LEVEL_ORDER against team name), then set `statusText = Made {teamNameByLevel[level]}` if found, otherwise `Made Team ({level})`.

3. **Completed level persistence path** (lines 530-557): Set `teamLevel` to the `completedLevel` loop variable. Update `statusText` the same way: use the team name if available from `teamNameByLevel`, otherwise keep `Made Team ({completedLevel})`.

**Build the `teamNameByLevel` lookup:** Near the top of `deriveFavouriteStatuses()` (or in the caller), build a `Map<string, string>` mapping team level to team name. Iterate `teamsMap` values. For each team, find which LEVEL_ORDER value appears in the team name (checking from longest match first to avoid "B" matching inside "BB"). Map that level to the team name. This lookup is used in paths 2 and 3 above.

**No changes needed to `getDashboardData()` or `getMyFavouritesPageData()`** — they already call `deriveFavouriteStatuses()` and pass through the results. The new `teamLevel` field flows through automatically.

### Pages
No page changes needed.

### Components

**Modify `frontend/components/dashboard/dashboard-client.tsx`:**

1. **Change `STATUS_ORDER`** (line 17): Remove the static array. Replace `buildStatusGroups()` with a new version that produces ordered groups dynamically:

   - First: all `continuing` players in one group
   - Second: all `cut` players in one group
   - Third: `made_team` players, split into **separate groups per `teamLevel`**, ordered in **reverse `LEVEL_ORDER`** (C, B, BB, A, AA — most recently completed first). Each sub-group's key should be `made_team:{teamLevel}` (e.g., `made_team:AA`) to ensure unique keys.
   - Fourth: all `registered` players in one group
   - Skip any group with 0 players

2. **Update `getStatusLabel()`** (lines 48-61): For `made_team` groups, use the first player's `statusText` which now contains the team name (e.g., "Made U15 AA"). No need to special-case — the `statusText` already carries the right label.

3. **Update `renderFavCard()`** (lines 146-166): The `key` prop currently uses `statusType`. Since there can now be multiple `made_team` groups, use the group key (`made_team:AA`, etc.) or a composite key. The CSS class should still use `dashboard-fav-card-made_team` for all Made Team cards (same gold styling).

**Modify `frontend/components/dashboard/my-favourites-client.tsx`:**

1. **Same `buildStatusGroups()` change** as dashboard: split `made_team` into per-`teamLevel` groups, same reverse level ordering.

2. **Update `getStatusLabel()`** (lines 48-58): Same approach — use `statusText` from the first player in each group.

3. **Update the status groups rendering** (lines 247-271): The `key` on each group `div` should use the composite key (e.g., `made_team:AA`) instead of just `statusType`, since multiple groups can share the `made_team` type. The CSS class on the section header should still use `my-favourites-group-header-made_team`.

### Styles
No new CSS classes needed. Existing `.dashboard-fav-card-made_team` and `.my-favourites-group-header-made_team` styles apply to all Made Team cards/sections regardless of level.

## Key Implementation Details

1. **Reverse level order for Made Team cards:** The display order for Made Team sub-groups is the reverse of `LEVEL_ORDER`. Since `LEVEL_ORDER = ["AA", "A", "BB", "B", "C"]`, the Made Team card order is C → B → BB → A → AA. This puts the most recently completed level first (AA completes earliest and should be at the bottom; C completes latest and should be at the top).

2. **Team name matching to level:** To build the `teamNameByLevel` map from `teamsMap`, iterate each team and check which `LEVEL_ORDER` value appears in the team name. Check longer values first (BB before B) to avoid false matches. Example: team name "U15 BB" should match "BB", not "B". A simple approach: sort `LEVEL_ORDER` by descending string length, then for each team, find the first level whose string appears in the team name.

3. **DB override `teamLevel` fallback:** For players with `status === "made_team"` in the database who have a `team_id`, the primary approach is to determine `teamLevel` from the team name (via the matching described above). If the player has no `team_id` or the team name doesn't match any level, fall back to checking which final team round the player's jersey appears on. If still no match, set `teamLevel = null` and these players will appear in a generic "Made Team" group at the end of the Made Team cards.

4. **Null teamLevel grouping:** If any `made_team` players have `teamLevel = null` (edge case), group them together in a single "Made Team" card that appears after all level-specific Made Team cards.

5. **`StatusGroup` type change:** The `statusType` field on `StatusGroup` currently uniquely identifies each group. With multiple Made Team groups, add a `groupKey` field (e.g., `"continuing"`, `"cut"`, `"made_team:AA"`, `"registered"`) for unique identification. The `statusType` remains `"made_team"` for CSS class purposes.

6. **No changes to hero cards.** Hero card logic, ordering, and display are unaffected by this spec.

7. **The `LEVEL_ORDER` constant** is currently defined only in `actions.ts`. Both client components need it for the reverse ordering. Either export it from `actions.ts` (it's a server file, so this may not work for client imports), or duplicate the constant in both client components, or move it to a shared location like `frontend/lib/constants.ts`. The implementer should choose the simplest approach — duplicating a 5-element array is acceptable.

8. **`FavouritePagePlayer` type** extends `FavoriteStatus`, so the new `teamLevel` field flows through automatically. No type changes needed in `my-favourites-client.tsx`.

## Acceptance Criteria

- [ ] `FavoriteStatus` type includes `teamLevel: string | null`
- [ ] `deriveFavouriteStatuses()` populates `teamLevel` for all three made_team paths (DB override, active final, completed persistence)
- [ ] `statusText` for active level final team includes the team name when available (e.g., "Made U15 AA"), not just "Made Team"
- [ ] Dashboard shows separate Made Team cards per team level (e.g., "Made U15 AA" card with 3 players, "Made U15 A" card with 2 players)
- [ ] Dashboard card order is: Continuing → Cut → Made Team (reverse level order) → Registered
- [ ] Made Team cards ordered most-recently-completed first (C before B before BB before A before AA)
- [ ] `/my-favourites` page shows separate Made Team sections per team level with the same ordering
- [ ] Made Team section headers on `/my-favourites` show team name when available
- [ ] Players within each Made Team group are sorted by jersey number (ascending)
- [ ] When only one team level has made_team players, it still shows as a single card with the correct team name
- [ ] No changes to hero card display or logic
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Testing Association:**
All tests below are **read-only** — they navigate and verify visuals without modifying data.

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, Nepean Wildcats). Dev server at `http://localhost:3000`. Active division U15. User should already have hearted players. Multiple team levels should have completed final teams for the full test to exercise per-level splitting.

### Test 1: Dashboard shows separate Made Team cards per level
1. Navigate to `http://localhost:3000/dashboard`
2. Take a browser snapshot
3. **Verify:** If the user has favourites who made teams at different levels (e.g., AA and A), separate Made Team cards appear — one per level. Each card shows the team name (e.g., "Made U15 AA") and a count of players. Cards are NOT merged into a single "Made Team" card.

### Test 2: Dashboard card ordering — Continuing and Cut first
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** The favourite cards appear in this order (skip any empty groups):
   - Continuing (green border) — if any
   - Cut (red border) — if any
   - Made Team cards (gold border) — one per level
   - Registered (muted border) — if any
4. **Verify:** Continuing and Cut cards appear ABOVE all Made Team cards.

### Test 3: Dashboard Made Team cards in reverse level order
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** If multiple Made Team cards exist, they are ordered with the most recently completed level first. For example, if AA and A are both complete, "Made U15 A" appears above "Made U15 AA" (A completed after AA).

### Test 4: Dashboard Made Team card shows team name
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** Made Team card labels use the team name from the database (e.g., "Made U15 AA"), not just "Made Team" or "Made Team (AA)".

### Test 5: Dashboard Made Team card sample names
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** Each Made Team card shows sample player names (jersey + last name) for players who made THAT specific team level only. Players from other levels do not appear in the wrong card.

### Test 6: My Favourites page — separate Made Team sections per level
1. Navigate to `/my-favourites`
2. Take a browser snapshot
3. **Verify:** If the user has favourites who made teams at different levels, separate Made Team sections appear — one per level with a section header showing the team name (e.g., "Made U15 AA (3)"). Players within each section belong to that specific team level.

### Test 7: My Favourites page — section ordering
1. Navigate to `/my-favourites`
2. Take a browser snapshot
3. **Verify:** Sections appear in order: Continuing → Cut → Made Team (reverse level order, most recent first) → Registered. Made Team sections follow the same reverse level ordering as the dashboard.

### Test 8: My Favourites page — players sorted within Made Team sections
1. Navigate to `/my-favourites`
2. Take a browser snapshot
3. **Verify:** Within each Made Team section, players are sorted by jersey number ascending.

### Test 9: Dashboard and My Favourites consistency
1. Navigate to `/dashboard`, note the Made Team card counts per level
2. Navigate to `/my-favourites`
3. **Verify:** The number of players in each Made Team section matches the corresponding dashboard card count.

### Test 10: Single Made Team level — no regression
1. If only one team level has Made Team favourites, navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** A single Made Team card appears with the correct team name and player count. No visual regression from the current single-card display.

### Test 11: No Made Team favourites — empty state
1. If the user has no Made Team favourites (only continuing/cut), navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** No Made Team cards appear. Continuing and Cut cards display normally.

### Test 12: Empty favourites state — no regression
1. Log in as `testparent2@test.com` / `TestParent1234` (may have no favourites)
2. Navigate to `/dashboard`
3. Take a browser snapshot
4. **Verify:** Empty state shows heart icon + "Heart players on the Teams page to track them here" with "Teams" as a link. No Made Team cards visible.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none) | All tests are read-only | N/A |

## Files to Touch

1. `frontend/app/(app)/dashboard/actions.ts` — **MODIFY**: Add `teamLevel` to `FavoriteStatus` type, update all three `made_team` paths in `deriveFavouriteStatuses()` to populate `teamLevel` and improve `statusText` with team names, build `teamNameByLevel` lookup from `teamsMap`
2. `frontend/components/dashboard/dashboard-client.tsx` — **MODIFY**: Rewrite `buildStatusGroups()` to split `made_team` into per-level groups with reverse level ordering, update group keys, update `getStatusLabel()` and `renderFavCard()` for composite keys
3. `frontend/components/dashboard/my-favourites-client.tsx` — **MODIFY**: Same `buildStatusGroups()` and ordering changes as dashboard, update group keys in rendering

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
