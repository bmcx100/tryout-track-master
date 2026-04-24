# Spec 023: Fix Favourite Status Logic — Round-Driven Derivation

**PRD Reference:** FR-025 (player tracking)
**Priority:** Must Have
**Depends on:** 012 (My Favourites page), 015 (Dashboard hero cards)

## What This Feature Does

Replaces the current per-player status derivation with a round-driven approach. Instead of looping through each favourited player and independently deriving their status from all rounds, the new logic first determines **what type of round is currently active** at the most recent level, then categorizes all players from that round's data, and finally cross-references with the user's favourites to produce counts and player lists.

Only one level is active at a time (levels are sequential: AA → A → BB → B → C). When a new level starts, the previous level's info stops showing. The exception is B/C which may run simultaneously.

## Current State

### Status derivation — `derivePlayerStatus()`
**File:** `frontend/app/(app)/dashboard/actions.ts` (lines 338–439)

The function loops through ALL levels (AA → C) for a single player's jersey number, checking every round at every level to find the player's most recent appearance. It picks the status based on the most recent `created_at` timestamp across all levels. This is **wrong** because:

1. It processes each favourite independently instead of starting from the round data
2. It doesn't distinguish between the three round types (Round 1, regular, final)
3. It shows statuses that don't apply to the current round type (e.g., "continuing" during Round 1, or "missing" during a regular continuation)

### Dashboard favourites section
**File:** `frontend/components/dashboard/dashboard-client.tsx` (line 343)

Currently **hidden** with a comment: `{/* My Favourites — hidden for now */}`. The section uses `favoriteStatuses` from `getDashboardData()` which relies on the broken `derivePlayerStatus()`.

### My Favourites page
**Files:**
- `frontend/app/(app)/my-favourites/page.tsx` — server component
- `frontend/components/dashboard/my-favourites-client.tsx` — client component
- `frontend/app/(app)/dashboard/actions.ts` → `getMyFavouritesPageData()` (lines 447–543)

Uses the same broken `derivePlayerStatus()` function. Groups favourites by status type (continuing, cut, missing, made_team, registered).

### Round data structure
**Table:** `continuation_rounds` — each row has `team_level` (AA/A/BB/B/C), `round_number`, `jersey_numbers[]`, `is_final_team`, `division`, `status` ("published"), `created_at`.

### Key files that consume favourite statuses
- `frontend/app/(app)/dashboard/actions.ts` — `getDashboardData()` and `getMyFavouritesPageData()`
- `frontend/components/dashboard/dashboard-client.tsx` — renders dashboard favourite cards
- `frontend/components/dashboard/my-favourites-client.tsx` — renders `/my-favourites` page

## Changes Required

### Database
No database changes needed.

### Server Actions / API Routes

**Rewrite `derivePlayerStatus()` in `frontend/app/(app)/dashboard/actions.ts`:**

Replace with a new function `deriveFavouriteStatuses()` that takes a **round-driven** approach:

```
function deriveFavouriteStatuses(
  allRounds: ContinuationRound[],
  favouriteJerseyNumbers: Set<string>,
  favouritesByJersey: Map<string, FavPlayerData>
): FavoriteStatus[]
```

**Algorithm:**

1. **Find the active level** — group rounds by `team_level`, find the level with the most recently published round (by `created_at`). If B and C both have rounds with the same recency, treat them as co-active.

2. **Determine the round type** for the active level:
   - **Round 1:** Only one round exists at this level (`levelRounds.length === 1`)
   - **Final team:** Latest round has `is_final_team === true`
   - **Regular continuation:** Everything else (2+ rounds, latest is not final)

3. **Build player lists from round data** (not from favourites):

   **Round 1:**
   - "Registered" = jersey numbers on the Round 1 list
   - "Missing" = jersey numbers that were cut from the level above (on any above-level round but NOT on the latest above-level round) AND don't appear on the Round 1 list at this level

   **Regular continuation:**
   - "Continuing" = jersey numbers on the latest round
   - "Cut" = jersey numbers on the previous round but NOT on the latest round

   **Final team:**
   - "Made Team" = jersey numbers on the final round
   - "Final Cut" = jersey numbers on the previous round but NOT on the final round

4. **Cross-reference with favourites** — for each list (registered, missing, continuing, cut, made_team, final_cut), filter to only jersey numbers that are in `favouriteJerseyNumbers`. Build `FavoriteStatus` objects from the matched players.

**Update the `FavoriteStatus` type:**

Change the `statusType` union to include the new round-type-specific statuses. Keep it as: `"continuing" | "cut" | "made_team" | "missing" | "registered"`. The existing values map cleanly:
- Round 1 registered → `"registered"`
- Round 1 missing → `"missing"`
- Regular continuing → `"continuing"`
- Regular cut → `"cut"`
- Final made team → `"made_team"`
- Final cut → `"cut"` (reuse "cut" — the display can say "Final Cut" based on context)

**Update `getDashboardData()`:**

Replace the existing favourite status building loop (lines 266–333) with a call to `deriveFavouriteStatuses()`. The function should:
1. Collect favourite jersey numbers and player data from the `favData` query (already done)
2. Call `deriveFavouriteStatuses(allRounds, favJerseyNumbers, favPlayerMap)`
3. Return the result as `favoriteStatuses`

**Update `getMyFavouritesPageData()`:**

Same change — replace the per-player derivation loop (lines 487–532) with `deriveFavouriteStatuses()`, then enrich each result with `notes`, `customName`, and `playerRawName` from the annotation data.

### Pages

No page changes needed. Both `frontend/app/(app)/dashboard/page.tsx` and `frontend/app/(app)/my-favourites/page.tsx` already pass the correct props.

### Components

**Modify `frontend/components/dashboard/dashboard-client.tsx`:**

1. **Un-hide the My Favourites section** — remove the comment wrapper on line 343 and restore the favourites cards rendering. The existing `renderFavCard()` and `buildStatusGroups()` functions should work with the corrected data.

2. **Update `getStatusLabel()`** — when the round is a final team round, the "cut" group label should say "Final Cut" instead of just "Cut". Pass a flag or detect from the data whether the current round type is final.

**Modify `frontend/components/dashboard/my-favourites-client.tsx`:**

Update `STATUS_LABELS` to handle "Final Cut" display when the active round is a final team round. The `statusType` value is still `"cut"` but the label should change contextually. One approach: add a `roundType` prop to the component and adjust labels accordingly. Or: add a `roundType` field to `FavouritePagePlayer` so the component knows the context.

### Styles

No new CSS classes needed. The existing `.dashboard-fav-*` and `.my-favourites-*` classes already handle all the status types.

## Key Implementation Details

1. **"Active level" determination:** Group all published rounds by `team_level`. For each level, take the latest round's `created_at`. The level with the most recent `created_at` is the active level. If two levels have rounds published within the same day (B/C combo case), treat both as active and merge their statuses.

2. **Round 1 "missing" logic:** A player is "missing" if they appear on ANY round at the level above but NOT on the latest round at the level above (i.e., they were cut from above), AND they don't appear on the Round 1 list at the current level. This is the same calculation the hero card already does for `missingCount`, so reuse that logic.

3. **`made_team` from database status:** Players with `player.status === "made_team"` in the `tryout_players` table should still be detected as made_team regardless of the round-driven logic. This is a database-level status set by the admin. Check this BEFORE the round-driven derivation as an override.

4. **Sorting within groups:** Keep the current sort: jersey number ascending within each status group.

5. **The hero cards are NOT affected.** The hero card data (`HeroCard` type with `continuingCount`, `cutCount`, `missingCount`, etc.) is computed separately and uses aggregate counts across ALL players (not just favourites). That logic is correct and should not be changed.

6. **`derivePlayerStatus()` can be removed** once both `getDashboardData()` and `getMyFavouritesPageData()` use the new `deriveFavouriteStatuses()`. If any other file imports `derivePlayerStatus()`, update those too.

7. **B/C combo edge case:** When both B and C have recent rounds, process each level independently and concatenate the resulting `FavoriteStatus[]` arrays. The dashboard and favourites page will show statuses from both levels together (e.g., "2 continuing" could include 1 from B and 1 from C). This is fine since there are typically few players tracked at these lower levels.

8. **Empty favourites:** If the user has no favourites, both pages show the existing empty state (heart icon + "Heart players on the Teams page"). No change needed here.

## Acceptance Criteria

- [ ] Favourite statuses are derived from the active level's round type, not per-player across all levels
- [ ] Round 1: favourites show as "Registered" or "Missing" only
- [ ] Regular continuation: favourites show as "Continuing" or "Cut" only
- [ ] Final team round: favourites show as "Made Team" or "Final Cut" only
- [ ] When a new level starts (Round 1), the previous level's statuses stop showing
- [ ] Dashboard favourites section is visible (un-hidden)
- [ ] Dashboard favourite cards show correct counts and labels
- [ ] `/my-favourites` page shows correct player groupings with updated logic
- [ ] Players with `status === "made_team"` in the database are always shown as "Made Team"
- [ ] B/C combo levels both show their statuses when active simultaneously
- [ ] Hero card data is NOT affected (aggregate counts unchanged)
- [ ] `derivePlayerStatus()` is removed or replaced
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. All tests below are **read-only** — they navigate and verify visuals without modifying data.

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, Nepean Wildcats). Dev server at `http://localhost:3000`. Active division U15. User should already have hearted players from previous testing.

### Test 1: Dashboard favourites section visible
1. Navigate to `http://localhost:3000/dashboard`
2. Take a browser snapshot.
3. **Verify:** Below the hero cards, the My Favourites section is visible with status cards (coloured left borders, count numbers, labels, sample names). It is NOT hidden or commented out.

### Test 2: Dashboard favourite status labels match round type
1. Navigate to `/dashboard`
2. Take a browser snapshot.
3. Look at the hero card to determine the current round type (Round 1, regular continuation, or final team).
4. **Verify:** The favourite status cards below use labels appropriate to the round type:
   - If Round 1: only "Registered" and/or "Missing" cards
   - If regular continuation: only "Continuing" and/or "Cut" cards
   - If final team: only "Made Team" and/or "Final Cut" cards
   - No status types from other round types should appear

### Test 3: Dashboard favourite counts are non-zero
1. Navigate to `/dashboard`
2. Take a browser snapshot.
3. **Verify:** At least one status card has a non-zero count (since the test user has hearted players). The total across all cards should equal the number of favourites at the active level.

### Test 4: Favourite cards link to /my-favourites
1. Navigate to `/dashboard`
2. Click on any favourite status card.
3. **Verify:** Navigation goes to `/my-favourites`.

### Test 5: My Favourites page grouping matches round type
1. Navigate to `/my-favourites`
2. Take a browser snapshot.
3. **Verify:** Players are grouped into sections matching the current round type:
   - If Round 1: "Registered" and/or "Missing" groups
   - If regular continuation: "Continuing" and/or "Cut" groups
   - If final team: "Made Team" and/or "Final Cut" groups
4. **Verify:** The group headings match (e.g., "Continuing (5)", "Cut (2)").

### Test 6: My Favourites player rows have correct data
1. Navigate to `/my-favourites`
2. Take a browser snapshot.
3. **Verify:** Each player row shows jersey number, position badge, heart (filled), name, and previous team. The data matches what's expected based on the continuation round data.

### Test 7: My Favourites page footer count
1. Navigate to `/my-favourites`
2. Scroll to the bottom.
3. **Verify:** Footer shows "N players tracked" where N matches the total number of rows on the page.

### Test 8: Empty favourites state (dashboard)
1. Log in as `testparent2@test.com` / `TestParent1234` (may have no favourites).
2. Navigate to `/dashboard`
3. Take a browser snapshot.
4. **Verify:** If no favourites exist, the favourites section shows the heart icon + "Heart players on the Teams page to track them here" with "Teams" as a link. Hero cards still appear at top.

### Test 9: Empty favourites state (my-favourites page)
1. Still logged in as `testparent2@test.com`.
2. Navigate to `/my-favourites`
3. Take a browser snapshot.
4. **Verify:** Empty state with heart icon and "Heart players on the Teams page to track them here" message.

### Test 10: Dashboard and My Favourites consistency
1. Log in as `testparent@test.com`.
2. Navigate to `/dashboard`, note the status card counts (e.g., "3 Continuing", "1 Cut").
3. Navigate to `/my-favourites`.
4. **Verify:** The number of players in each group on the favourites page matches the counts shown on the dashboard cards.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none) | All tests are read-only | N/A |

## Files to Touch

1. `frontend/app/(app)/dashboard/actions.ts` — **MODIFY**: Replace `derivePlayerStatus()` with `deriveFavouriteStatuses()`, update `getDashboardData()` and `getMyFavouritesPageData()` to use the new function
2. `frontend/components/dashboard/dashboard-client.tsx` — **MODIFY**: Un-hide the favourites section, update status label for "Final Cut" context
3. `frontend/components/dashboard/my-favourites-client.tsx` — **MODIFY**: Update `STATUS_LABELS` to handle "Final Cut" display when applicable

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
