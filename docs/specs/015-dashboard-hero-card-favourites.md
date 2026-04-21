# Spec 015: Dashboard Redesign — Hero Cards + Favourites

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** 009 (Dashboard redesign), 011 (Dashboard favourites summary), 012 (My Favourites page)

## What This Feature Does

The parent dashboard is redesigned with two sections. The top section shows one or more "hero cards" — prominent gold-gradient cards summarizing each active tryout level (e.g., "AA Round 3") with aggregate stats (continuing, cuts, missing). Below that, the My Favourites section uses stacked status cards with colored left borders and player name previews, all clickable to navigate to `/my-favourites`. The existing Recent Results horizontal cards, "Results Details" link, and section divider are removed entirely.

## Current State

The dashboard currently has two sections separated by a divider:

1. **Recent Results** — horizontal activity cards per level (AA, A, BB...) showing cuts/continuing counts and a "Results Details >" link. Built in `frontend/components/dashboard/dashboard-client.tsx` lines 98–136.
2. **My Favourites** — status summary cards (continuing, cut, missing, made_team, registered) with heading + sample names, plus a "See All My Favourites >" link. Built in lines 141–161.

**Key files:**
- `frontend/components/dashboard/dashboard-client.tsx` — client component rendering both sections
- `frontend/app/(app)/dashboard/actions.ts` — `getDashboardData()` returns `activityCards` (per-level stats) and `favoriteStatuses` (per-player favourite breakdown)
- `frontend/app/(app)/dashboard/page.tsx` — server page that fetches data and passes it as props
- `frontend/app/globals.css` — all `.dashboard-*` CSS classes

**Data already available from `getDashboardData()`:**
- `activityCards[]`: each has `teamLevel`, `roundNumber`, `continuingCount`, `cutCount`, `publishedAt`, `isFinalTeam`
- `favoriteStatuses[]`: each has `playerId`, `playerName`, `jerseyNumber`, `statusType`, `statusText`, etc.

**What's missing for hero cards:**
- The current `activityCards` don't include `totalPlayers` or `missingCount` — only `continuingCount` and `cutCount`.
- For Round 1 (no previous round), the card needs `totalPlayers` (length of jersey_numbers) and `missingCount` (players cut from level above who haven't appeared at this level).
- For "Team Finalized" cards, we need counts of favourites who made the team and favourites who were cut in final cuts at that level.

## Changes Required

### Database

No database changes needed. All data comes from existing `continuation_rounds`, `player_annotations`, and `tryout_players` tables.

### Server Actions / API Routes

**Modify `getDashboardData()` in `frontend/app/(app)/dashboard/actions.ts`:**

Change the return type to include hero card data:

```
type HeroCard = {
  teamLevel: string
  roundNumber: number
  isFinalTeam: boolean
  publishedAt: string
  // For in-progress tryouts (not final):
  continuingCount: number      // players on latest round list
  cutCount: number             // players cut from previous round
  missingCount: number         // players cut from level above, not seen at this level
  totalPlayers: number         // total on latest round's jersey_numbers list
  isRoundOne: boolean          // true if this is the first round (no previous round)
  // For finalized teams:
  favouritesOnTeam: number     // count of user's favourites who made this team
  favouritesCutFinal: number   // count of user's favourites cut in the final round
}
```

The function should return `heroCards: HeroCard[]` instead of `activityCards: ActivityCard[]`. Build one `HeroCard` per level that has published rounds. For each level:

1. Get the latest round's `jersey_numbers.length` as `totalPlayers`.
2. Get `continuingCount` = latest round's jersey count.
3. Get `cutCount` = players on previous round but not on latest round (already computed).
4. Get `missingCount` = for the level above this one (e.g., if current is A, check AA), count players who were cut from the level above but don't appear in ANY round at this level.
5. Set `isRoundOne = true` if there's only one round at this level.
6. For `isFinalTeam` cards: count how many of the user's favourites have `jersey_number` in the final round's list (`favouritesOnTeam`), and how many favourites were on the previous round but not the final round (`favouritesCutFinal`).

**Important:** The missing count at the hero level is an aggregate across ALL players (not just favourites). It counts ALL players cut from the level above who haven't appeared at this level.

Remove the `ActivityCard` type export (no longer used).

### Pages

**Modify `frontend/app/(app)/dashboard/page.tsx`:**
- Pass `heroCards` instead of `activityCards` to `DashboardClient`.

### Components

**Rewrite `frontend/components/dashboard/dashboard-client.tsx`:**

The component receives `heroCards: HeroCard[]` and `favoriteStatuses: FavoriteStatus[]`.

**Layout (top to bottom):**

1. **Hero Cards section** — one card per level, stacked vertically with 12px gap:

   **Card variant A — "Tryouts in progress" (not finalized):**
   - Gold gradient background (like Option A mockup's `.hero-pulse`): `linear-gradient(135deg, rgba(var(--dm-gold-rgb), 0.12), rgba(var(--dm-gold-rgb), 0.03))` with subtle gold border.
   - Title: "Tryouts in progress" — 18px font, color `var(--dm-umber)` (same as header "Home" text, NOT bright white). Semi-bold weight.
   - Subtitle: Level + Round prominently displayed, e.g. "AA Round 3" — bold, ~16px, slightly lighter than title.
   - Stats row: three blocks in a row on dark background pills:
     - Continuing (green number) — only if `!isRoundOne`
     - Cuts (red number) — only if `!isRoundOne`
     - Missing (amber/gold number)
     - If `isRoundOne`: show "Total Players" (white/neutral number) and "Missing" (amber number) only. No continuing or cuts.
   - Each stat block has a large number on top and an uppercase label below (IBM Plex Mono).

   **Card variant B — "Team Finalized":**
   - Same gold gradient background.
   - Title: "Team Finalized" — same 18px, `var(--dm-umber)`.
   - Subtitle: Level name, e.g. "AA" — bold, prominent.
   - Stats row: two blocks:
     - "X on roster" or "X favourites made team" (gold number) — count of user's favourites on the final roster.
     - "X cut" (red number) — count of user's favourites cut in final cuts.
   - If the user has no favourites at this level, still show the card but with aggregate numbers (total roster size, total final cuts).

2. **My Favourites section** — below the hero cards, with 20px top margin:

   **Section header:** "My Favourites (count)" — 13px, IBM Plex Mono, uppercase, `var(--dm-umber)`. The header itself is clickable (links to `/my-favourites`).

   **Status cards** — stacked vertically, one per status group:
   - Each card has a colored left border (3-4px):
     - Green for continuing
     - Red for cut
     - Amber/orange for missing
     - Gold for made_team
     - Dust for registered
   - Left side: large count number (IBM Plex Mono, ~28-32px, colored to match border).
   - Right side: status label (e.g., "Continuing", "Cut", "Missing at A") in 14px semi-bold, plus sample player names below (11px, dust color, up to 2 names + "+N").
   - **No chevron (>)** on the right side.
   - **Entire card is clickable** — navigates to `/my-favourites`.
   - Remove the "See All My Favourites >" link at the bottom.

**Removed elements:**
- The `dashboard-activity-list` / horizontal scroll activity cards
- The "Results Details >" link
- The `dashboard-divider` between sections
- The "See All My Favourites >" link

**Empty states:**
- No favourites hearted: existing empty state (Heart icon + "Heart players on the Teams page to track them here") — keep as-is.
- No rounds/results at all: hero card says "Tryouts starting soon" with just the total player count for the division (query from `tryout_players` count).

### Styles

**Remove from `frontend/app/globals.css`:**
- `.dashboard-activity-list`
- `.dashboard-activity-card` and `:hover`
- `.dashboard-activity-top`
- `.dashboard-activity-badge`
- `.dashboard-activity-round`
- `.dashboard-activity-time`
- `.dashboard-activity-stats`
- `.dashboard-activity-cuts`
- `.dashboard-activity-continuing`
- `.dashboard-activity-final`
- `.dashboard-activity-empty`
- `.dashboard-results-link`
- `.dashboard-see-all-link`
- `.dashboard-divider`

**Add to `frontend/app/globals.css`:**

Hero card styles (follow existing `@apply` convention):

- `.dashboard-hero-card` — gold gradient background, rounded-xl (16px), padding 20px, border with gold tint, margin-bottom 12px, overflow hidden, position relative.
- `.dashboard-hero-title` — font-size 18px, font-weight 600, color `var(--dm-umber)`.
- `.dashboard-hero-subtitle` — font-size 16px, font-weight 700, color slightly lighter than title (e.g., `oklch(0.75 0 0)`), margin-top 2px, IBM Plex Mono.
- `.dashboard-hero-stats` — flex row, gap 12px, margin-top 16px.
- `.dashboard-hero-stat` — flex-1, background dark pill (`oklch(0.15 0 0 / 50%)`), rounded-xl, padding 12px, text-align center.
- `.dashboard-hero-stat-value` — font-size 28px, font-weight 700, IBM Plex Mono, line-height 1.
- `.dashboard-hero-stat-value-green` — color `var(--dm-official-green)`.
- `.dashboard-hero-stat-value-red` — color `var(--dm-red)`.
- `.dashboard-hero-stat-value-gold` — color `var(--dm-gold)`.
- `.dashboard-hero-stat-value-neutral` — color `var(--dm-umber)`.
- `.dashboard-hero-stat-label` — font-size 10px, color `var(--dm-dust)`, IBM Plex Mono, uppercase, letter-spacing 0.05em, margin-top 4px.

Favourites card styles (update existing `.dashboard-status-card` or create new):

- `.dashboard-fav-card` — flex row, align-items center, gap 14px, background `var(--dm-dune)`, border `var(--dm-border)`, rounded-xl (14px), padding 14px 16px, border-left 4px solid (color varies by status), cursor pointer, text-decoration none, color inherit. Transition on background for hover.
- `.dashboard-fav-card:hover` — slightly lighter background.
- `.dashboard-fav-card-continuing` — border-left-color `var(--dm-official-green)`.
- `.dashboard-fav-card-cut` — border-left-color `var(--dm-red)`.
- `.dashboard-fav-card-missing` — border-left-color `var(--dm-orange)`, subtle orange-tinted background.
- `.dashboard-fav-card-made_team` — border-left-color `var(--dm-gold)`.
- `.dashboard-fav-card-registered` — border-left-color `var(--dm-dust)`.
- `.dashboard-fav-count` — font-size 32px, font-weight 700, IBM Plex Mono, line-height 1, min-width 44px, text-align center. Color matches border.
- `.dashboard-fav-info` — flex 1.
- `.dashboard-fav-label` — font-size 14px, font-weight 600, color `oklch(0.85 0 0)`.
- `.dashboard-fav-names` — font-size 11px, color `var(--dm-dust)`, IBM Plex Mono.

## Key Implementation Details

1. **Hero card ordering:** Cards should appear in `LEVEL_ORDER` sequence (AA, A, BB, B, C). Finalized teams first, then in-progress levels.

2. **Missing count calculation (aggregate, not just favourites):** For a given level (say A), the missing count = players who appear on AA's latest round BUT were cut from AA (not on AA's latest round anymore) AND do not appear on ANY round at A. This requires cross-level comparison. The existing `derivePlayerStatus()` does this per-player for favourites — the hero card needs the aggregate count across ALL players, which means querying `continuation_rounds` jersey numbers without filtering by favourites.

3. **Round 1 behavior:** When `isRoundOne` is true (only one round at this level), the hero card shows:
   - "Total Players" stat (count of all players on the round) instead of "Continuing"
   - "Missing" stat (players cut from level above not at this level) instead of "Cuts"
   - No "Cuts" stat since there are no cuts yet.

4. **Finalized team favourites:** For Team Finalized cards, cross-reference the final round's `jersey_numbers` with the user's `favoriteStatuses` to count how many favourites made it vs. were cut. If the user has zero favourites at that level, fall back to showing aggregate roster count and total final cuts.

5. **Reuse existing `favoriteStatuses` data** for the bottom My Favourites section — no changes needed to the favourite status calculation.

6. **The `ActivityCard` type and related code in actions.ts** should be replaced with `HeroCard`. Remove the `ActivityCard` export and any code that builds it, replace with `HeroCard` construction logic.

7. **Gold gradient background:** Use oklch-based gradient matching the app's color system: `linear-gradient(135deg, oklch(0.65 0.12 85 / 12%) 0%, oklch(0.65 0.12 85 / 3%) 100%)` with border `oklch(0.65 0.12 85 / 20%)`. Adjust to match `var(--dm-gold)` tone.

8. **Clickable favourites cards:** Each `.dashboard-fav-card` should be a `<Link href="/my-favourites">` wrapping the entire card. The section header "My Favourites (count)" is also a `<Link href="/my-favourites">`.

## Acceptance Criteria

- [ ] Hero cards appear at top of dashboard, one per active tryout level
- [ ] "Tryouts in progress" cards show level, round, continuing/cuts/missing stats
- [ ] Round 1 cards show "Total Players" + "Missing" (no continuing/cuts)
- [ ] "Team Finalized" cards show favourites on roster + favourites cut
- [ ] My Favourites section shows status cards with colored left borders, large count, label, sample names
- [ ] No chevrons on favourite cards
- [ ] No "See All My Favourites" link at bottom
- [ ] Every favourite status card is clickable and navigates to `/my-favourites`
- [ ] "My Favourites (count)" header is clickable and navigates to `/my-favourites`
- [ ] Recent Results section, "Results Details" link, and divider are removed
- [ ] Empty state (no favourites) shows heart icon + Teams page link
- [ ] Empty state (no rounds) shows "Tryouts starting soon" with player count
- [ ] Hero card title text color matches header "Home" color (`var(--dm-umber)`), not bright white
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. All tests below are **read-only** — they navigate and verify visuals without modifying data.

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role). Navigate to `/dashboard`. The user has favourites and the Nepean Wildcats U15 division has published continuation rounds.

### Test 1: Hero card appears with correct structure
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** At least one hero card is visible at the top with "Tryouts in progress" title, a level/round subtitle (e.g., "AA Round 3"), and stat blocks (continuing, cuts, missing OR total players + missing for Round 1)

### Test 2: Hero card title styling
1. Navigate to `/dashboard`
2. Take a screenshot of the hero card area
3. **Verify:** The "Tryouts in progress" title uses a muted warm color (matching "Home" header), not bright white. The card has a subtle gold gradient background.

### Test 3: Hero card stats are correct
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** The stat numbers are present — green for continuing, red for cuts, amber for missing. Numbers are large (IBM Plex Mono). Labels appear below each number in uppercase.

### Test 4: Multiple hero cards for multiple levels
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** If multiple levels have published rounds (e.g., AA and A), multiple hero cards are shown stacked vertically. Check that each shows its respective level and round info.

### Test 5: Finalized team hero card variant
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** If any level has `is_final_team = true`, a "Team Finalized" card appears showing the level name and favourite counts (on roster + cut). If no finalized teams exist, this test is skipped — verify that only "Tryouts in progress" cards are shown.

### Test 6: My Favourites section with status cards
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** Below the hero cards, a "My Favourites" section header appears with a count in parentheses. Status cards are stacked vertically with:
   - Large count numbers on the left
   - Status labels and sample player names on the right
   - Colored left borders (green/red/amber)
   - No chevrons (>) on any card

### Test 7: Favourite cards are clickable
1. Navigate to `/dashboard`
2. Click the first favourite status card (e.g., "continuing")
3. **Verify:** Navigation goes to `/my-favourites`
4. Navigate back to `/dashboard`
5. Click the "My Favourites (count)" section header
6. **Verify:** Navigation goes to `/my-favourites`

### Test 8: No removed elements present
1. Navigate to `/dashboard`
2. Take a browser snapshot
3. **Verify:** No "Recent Results" section header. No horizontal scrolling activity cards. No "Results Details >" link. No divider line between sections. No "See All My Favourites >" link at the bottom.

### Test 9: Empty favourites state
1. Log in as `testparent2@test.com` / `TestParent1234` (member with potentially no favourites)
2. Navigate to `/dashboard`
3. Take a browser snapshot
4. **Verify:** If no favourites exist, the bottom section shows a heart icon and "Heart players on the Teams page to track them here" with a link to `/teams`. Hero cards still appear at the top.

### Test 10: Mobile viewport
1. Set browser width to 393px (phone frame width)
2. Navigate to `/dashboard`
3. Take a screenshot
4. **Verify:** Hero cards and favourite cards fit within the phone frame. No horizontal overflow. Stats row wraps gracefully if needed. Text is readable.

### Test 11: Desktop viewport
1. Set browser width to 1024px
2. Navigate to `/dashboard`
3. Take a screenshot
4. **Verify:** Dashboard content is constrained to the phone-frame max-width (app shell). Hero cards don't stretch beyond the app shell width.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none) | All tests are read-only | N/A |

## Files to Touch

1. `frontend/app/(app)/dashboard/actions.ts` — replace `ActivityCard` with `HeroCard` type, update `getDashboardData()` to compute hero card data including missing counts and finalized team favourite counts
2. `frontend/app/(app)/dashboard/page.tsx` — pass `heroCards` instead of `activityCards`
3. `frontend/components/dashboard/dashboard-client.tsx` — rewrite JSX: hero cards at top, updated My Favourites section below, remove activity cards / divider / see-all link
4. `frontend/app/globals.css` — remove old `.dashboard-activity-*`, `.dashboard-divider`, `.dashboard-results-link`, `.dashboard-see-all-link` classes; add `.dashboard-hero-*` and `.dashboard-fav-*` classes

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing (un-heart players, restore names, delete test records, etc.). Confirm with the user that all test data has been cleaned up.
