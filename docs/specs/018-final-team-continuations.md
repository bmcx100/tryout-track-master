# Spec 018: Scraper Robustness & Final Team in Continuations

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** None

## What This Feature Does

Two related changes:

**Part A — Scraper robustness:** Fixes jersey number extraction to handle all HTML formats seen on NGHA pages (including `<p>` tags with `<br>`-separated numbers). Improves page type auto-detection to recognize "making the team" and "selected for" phrasings as final team announcements. These fixes apply to all scrape operations, not just final teams.

**Part B — Final team flow:** When an admin scrapes and confirms a round marked as "Final Team", the system automatically sets roster players to `made_team` with a `team_id`. The dashboard hero card shows full player rows with a Final Roster / Final Cuts toggle. The sessions page toggle labels update for final team rounds. A bug where the "missing" count appears on non-round-1 hero cards is also fixed.

## Current State

### Infrastructure that already exists
- **`is_final_team` column** on `continuation_rounds` (boolean, default false) — `backend/supabase/migrations/20260420000002_create_continuations.sql`
- **`classifyPage()`** returns `"final_team"` when text contains "final team" or "final roster" — `frontend/app/(app)/continuations/scraper-actions.ts:24-39`
- **`extractJerseyNumbers()`** has 3 methods: table cells, br-separated in `<div>`, single-number `<p>` tags — `scraper-actions.ts:64-116`
- **`saveDraftRound()`** sets `is_final_team: scrapeResult.pageType === "final_team"` — `scraper-actions.ts:288`
- **`lockFinalTeam()`** sets `status: "made_team"` + `team_id` on matching players — `frontend/app/(app)/continuations/actions.ts:271-315`. This function is correct as-is — no changes needed.
- **`confirmDraft()`** only publishes the round — does NOT call `lockFinalTeam()` — `scraper-actions.ts:298-309`
- **Dashboard hero card Variant B** renders "Final Team" title with Roster/Cut counts — `frontend/components/dashboard/dashboard-client.tsx:68-89`
- **`getRoundLabel()`** returns "Final Team" instead of "Round X" when `is_final_team` is true — `frontend/components/continuations/continuations-page-client.tsx:238-241`
- **Prediction board** separates `made_team` + `team_id` players into locked "official" teams — `frontend/components/teams/prediction-board.tsx:75-89`
- **`SessionsToggle`** component with sliding pill animation — `frontend/components/continuations/sessions-toggle.tsx`
- **`ContinuationPlayerRow`** component with jersey, position, heart, name, previous team, IP badge, drag support — `frontend/components/continuations/continuation-player-row.tsx`
- **`HeroCard` type** has `isFinalTeam`, `favouritesOnTeam`, `favouritesCutFinal` fields — `frontend/app/(app)/dashboard/actions.ts:7-20`

### What's missing

**Scraper bugs:**
1. Jersey extraction fails for `<p>50<br>80<br>...</p>` format (U15 currently uses this) — Method 2 only matches `<div>` tags, not `<p>` tags
2. `classifyPage()` misses all current NGHA final team pages — they use "making the...team" (U13, U15) and "selected for" (U18), never "final team" or "final roster"

**Final team gaps:**
3. No admin UI toggle to manually mark a round as "Final Team"
4. `confirmDraft()` does not call `lockFinalTeam()` when `is_final_team` is true
5. Dashboard hero card shows counts only — needs full player rows with a toggle
6. Sessions toggle still says "Continuing" / "Cuts" for final team rounds
7. Bug: "Missing" count appears on hero cards for all rounds — should only appear on round 1

### Tested HTML formats from NGHA (as of 2026-04-23)

| Division | HTML Format | Example | Current Extraction |
|----------|-----------|---------|-------------------|
| U13 | Table cells | `<td width="64" height="21">35</td>` | **Works** (Method 1) |
| U15 | Single `<p>` with `<br>` separators | `<p>50<br>80<br>162<br>...</p>` | **Fails** (no method handles this) |
| U18 | `<p>` inside `<td>` | `<td width="48"><p>191</p></td>` | **Works** (Method 3) |

All three divisions currently show final team announcements. None use the phrases "final team" or "final roster" — `classifyPage()` fails for all three.

## Changes Required

### Database

No database changes needed.

### Server Actions / API Routes

**1. Fix `extractJerseyNumbers()` — handle `<p>` with br-separated numbers**
File: `frontend/app/(app)/continuations/scraper-actions.ts`

Modify Method 2's regex to match both `<div>` and `<p>` tags containing br-separated numbers. Also tolerate trailing `&nbsp;` inside the block.

Current Method 2 regex (line 87):
```
/<div[^>]*>((?:\s*\d{1,4}\s*(?:IP)?\s*<br\s*\/?>?\s*)+\d{1,4}\s*(?:IP)?)\s*<\/div>/i
```

New Method 2 regex (matches `<div>` or `<p>`):
```
/<(?:div|p)[^>]*>((?:\s*\d{1,4}\s*(?:IP)?\s*(?:&nbsp;)?\s*<br\s*\/?>?\s*)+\d{1,4}\s*(?:IP)?(?:\s*(?:&nbsp;)?)*)\s*<\/(?:div|p)>/i
```

The rest of Method 2's logic (iterating matches with `numRegex`) stays the same.

**2. Improve `classifyPage()` — detect NGHA final team phrasings**
File: `frontend/app/(app)/continuations/scraper-actions.ts`

Add detection for these patterns (all case-insensitive):
- "making the" + "team" (e.g., "making the 2026-27 U15AA team")
- "selected for" + team/wildcats/association name (e.g., "selected for the U18AA Nepean Wildcats")
- "congratulations" or "congratulate" combined with a team-level pattern like U13AA/U15A/U18BB

Add these checks after the existing "final team" / "final roster" check but before the default `return "continuation"`. The auto-detection sets the default for the admin toggle — the admin can always override it.

**3. `lockFinalTeam()` — no changes needed**
File: `frontend/app/(app)/continuations/actions.ts`

Keep the current behavior exactly as-is: find players matching final round jersey numbers, set `status: "made_team"` + `team_id`. Do NOT add cut logic. Rationale: no code currently reads `tryout_players.status === "cut"` — all cut/continuing display is derived from continuation rounds data at display time. Setting `made_team` is needed because the prediction board uses it to show locked official teams.

**4. Auto-call `lockFinalTeam()` from `confirmDraft()`**
File: `frontend/app/(app)/continuations/scraper-actions.ts`

After updating the round status to "published", fetch the round to check `is_final_team`. If true, call `lockFinalTeam(roundId)`. Return any error from the lock operation. No extra confirmation dialog — the confirm button does everything.

```
export async function confirmDraft(roundId: string): Promise<{ error?: string }> {
  // ... existing publish logic ...

  // After successful publish, check if this is a final team round
  const { data: round } = await supabase
    .from("continuation_rounds")
    .select("is_final_team")
    .eq("id", roundId)
    .single()

  if (round?.is_final_team) {
    const lockResult = await lockFinalTeam(roundId)
    if (lockResult.error) return { error: lockResult.error }
  }

  return {}
}
```

**5. Add `isFinalTeamOverride` parameter to `saveDraftRound()`**
File: `frontend/app/(app)/continuations/scraper-actions.ts`

Add `isFinalTeamOverride?: boolean` parameter. When provided, use it for the `is_final_team` insert value instead of `scrapeResult.pageType === "final_team"`.

**6. Enhance `getDashboardData()` for final team player rows**
File: `frontend/app/(app)/dashboard/actions.ts`

Add optional fields to the `HeroCard` type:
```
rosterPlayers?: { jerseyNumber: string, name: string, position: string, isFavorite: boolean, previousTeam: string | null }[]
cutPlayers?: { jerseyNumber: string, name: string, position: string, isFavorite: boolean, previousTeam: string | null }[]
```

When building a hero card where `isFinalTeam` is true:
- Fetch all `tryout_players` for the division with their annotations
- `rosterPlayers` = players whose jersey numbers are on the final round, sorted F -> D -> G
- `cutPlayers` = players whose jersey numbers were on any earlier round at this team level but NOT on the final round, sorted F -> D -> G
- Include `isFavorite` from the user's `player_annotations`

### Pages

No new pages needed.

### Components

**1. Admin toggle in scraper preview**
File: `frontend/components/settings/scrape-page-client.tsx`

Add a "Final Team" checkbox row in the scrape preview summary card, after the Session Info row. Behavior:
- State: `const [isFinalTeam, setIsFinalTeam] = useState(result?.pageType === "final_team")`
- Update state when `result` changes (via `useEffect`)
- Pass `isFinalTeam` to `saveDraftRound()` as `isFinalTeamOverride`
- Visual: checkbox + "Final Team" label, same row styling as other summary rows

**2. Dashboard hero card — toggle + full player rows for final teams**
File: `frontend/components/dashboard/dashboard-client.tsx`

When `card.isFinalTeam` is true, render an expanded hero card:
- Title: "Final Team - {division}{teamLevel}" (existing)
- Below title: a `SessionsToggle`-style toggle with "Final Roster (N)" / "Final Cuts (N)"
- Below toggle: full `ContinuationPlayerRow` components (no drag, no `sortableId`) sorted F -> D -> G
- Toggle switches between roster and cut player lists
- The hero card is NOT clickable (no link wrapper)

Reuse `ContinuationPlayerRow` directly — pass `sortableId={undefined}` to disable drag, `isCut={true}` for cuts view. The component already handles all display: jersey, position, heart, name, previous team.

Since `DashboardClient` is a client component, it can manage the toggle state internally with `useState`.

The `handleToggleFavorite` callback needs to be wired up — import `toggleFavorite` from continuations actions and optimistically update local state, same pattern as `ContinuationsPageClient`.

**3. Sessions toggle — dynamic labels for final team**
File: `frontend/components/continuations/sessions-toggle.tsx`

Accept a new optional prop `isFinalTeam?: boolean`. When true, change the `VIEWS` labels:
- "Continuing" -> "Final Roster"
- "Cuts" -> "Final Cuts"

**4. Pass `isFinalTeam` to SessionsToggle**
File: `frontend/components/continuations/continuations-page-client.tsx`

Pass `isFinalTeam={activeRound.is_final_team}` to the `SessionsToggle` component at line 296.

**5. Missing count — only on round 1**
File: `frontend/components/dashboard/dashboard-client.tsx`

In `renderHeroCard()`, the non-round-1 branch (lines 113-132) currently shows a "Missing" stat. Remove the Missing stat from this branch. Missing should only appear when `card.isRoundOne` is true.

Current code at lines 112-132 (the `else` branch after `card.isRoundOne`):
```tsx
) : (
  <>
    <div className="dashboard-hero-stat">
      ... Continuing ...
    </div>
    <div className="dashboard-hero-stat">
      ... Cuts ...
    </div>
    <div className="dashboard-hero-stat">           // DELETE this block
      ... Missing ...                                // DELETE this block
    </div>                                           // DELETE this block
  </>
)
```

Remove the 6-line "Missing" stat `<div>` block from the non-round-1 branch (lines 126-131).

### Styles

File: `frontend/app/globals.css`

Add styles for:
- `.scrape-final-team-row` — checkbox/label row in scraper preview summary card
- `.dashboard-hero-final-toggle` — wrapper for the toggle inside the final team hero card
- `.dashboard-hero-final-players` — container for the player rows list inside hero card

## Key Implementation Details

### Scraper format resilience
The NGHA content editors paste jersey numbers in varying HTML formats across divisions and rounds. The three extraction methods should be treated as a priority chain — Method 1 (table cells) is tried first, then Method 2 (br-separated in block elements), then Method 3 (individual `<p>` tags). Method 2 is the one being fixed to also match `<p>` tags, since the NGHA started using `<p>50<br>80<br>...</p>` for U15.

If a future format appears that none of the methods handle, the scraper will return 0 jersey numbers and the preview will show "0 players" — prompting the admin to investigate rather than silently saving bad data.

### Flow: AA finalizes, then A tryouts begin
1. U15 AA tryouts run (Rounds 1-3)
2. Admin scrapes final AA roster -> Final Team toggle auto-checked or manually checked -> Confirm
3. `confirmDraft()` publishes the round AND calls `lockFinalTeam()` -> roster players get `status: "made_team"` + `team_id`
4. Dashboard shows "Final Team - U15AA" hero card with toggle between roster/cuts player lists
5. U15 A tryouts begin -> dashboard shows "U15 A - Round 1" alongside the AA final card
6. Players cut from AA tryouts are NOT updated in `tryout_players.status` — their cut status is derived from continuation rounds data at display time

### Why no `status: "cut"` in the database
The app derives continuing/cut status from `continuation_rounds` jersey number lists, not from `tryout_players.status`. The `derivePlayerStatus()` function in `dashboard/actions.ts` and the cuts computation in `continuations-page-client.tsx` both work this way. Setting `status: "cut"` would be redundant and could cause confusion for players who are cut from AA but still trying out for A.

The only status that MUST be in the database is `made_team` + `team_id`, because the prediction board needs it to show locked official team rosters.

### Dashboard hero card player rows
The final team hero card reuses `ContinuationPlayerRow` without drag support. Each row shows: jersey number, position badge (F/D/G), heart button, player name (with custom name if set), previous team. Rows are sorted by position group (F -> D -> G), then by blended team rank within each group — same `sortByPositionThenTeam` logic used on the Sessions page.

The toggle reuses the `SessionsToggle` component (or a similar toggle pattern) to switch between "Final Roster" and "Final Cuts" views.

Favorite toggling on the dashboard hero card needs to work — tapping a heart updates the annotation, same as on the Sessions page. Use optimistic local state updates.

### Missing count definition
"Missing" = players who appeared in any round of the level above (e.g., U15 AA) but do NOT appear in round 1 of this level (e.g., U15 A). Only displayed on hero cards when `isRoundOne` is true. The calculation in `dashboard/actions.ts:108-136` is correct — the fix is display-only.

### Prediction board — no changes needed
Players with `status === "made_team" && team_id` already appear in the locked "official" team section. `lockFinalTeam()` already sets these fields. No prediction board code changes needed.

## Acceptance Criteria

- [ ] Scraper extracts jersey numbers from `<p>50<br>80<br>...</p>` format (U15 style)
- [ ] Scraper extracts jersey numbers from `<td>35</td>` format (U13 style, existing)
- [ ] Scraper extracts jersey numbers from `<td><p>191</p></td>` format (U18 style, existing)
- [ ] `classifyPage()` detects "making the...team" as `final_team`
- [ ] `classifyPage()` detects "selected for the...team-level" as `final_team`
- [ ] Admin can toggle "Final Team" checkbox in scraper preview, defaulting to auto-detected value
- [ ] When a final team round is confirmed, `lockFinalTeam()` runs automatically — no extra dialog
- [ ] Roster players get `status: "made_team"` and `team_id` set in the database
- [ ] No players get `status: "cut"` set — cut display is derived from rounds data
- [ ] Dashboard final team hero card shows a toggle between "Final Roster" and "Final Cuts"
- [ ] Both toggle views show full player rows (jersey, position, heart, name, previous team) sorted F -> D -> G
- [ ] Heart button works on dashboard final team player rows (toggles favorite)
- [ ] Dashboard hero card "Missing" count only appears on round 1, not on later rounds
- [ ] Sessions page dropdown shows "Final Team" instead of "Round X" for final team rounds (already works)
- [ ] Sessions toggle shows "Final Roster (N)" / "Final Cuts (N)" for final team rounds
- [ ] Players who made team appear locked in the prediction board (already works)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow all safety rules — prefer read-only tests, log mutations, revert after testing.

**Setup:**
- Admin login: `testadmin@test.com` / `TestAdmin1234`
- Parent login: `testparent@test.com` / `testpass123`
- Division: U15 (has active continuation data)
- The NGHA U15 page currently shows a final team announcement

### Test 1: Scraper extracts U15 jersey numbers correctly
1. Login as admin
2. Navigate to `/settings/scrape`
3. Click "Scrape Now"
4. **Verify:** The preview shows 17 players (not 0)
5. **Verify:** Jersey numbers include 50, 80, 162, 171, 178, 180, 277, 461, 542, 552, 655, 659, 666, 709, 797, 884, 888
6. **Verify:** Team level auto-detected as "AA"
7. Discard the preview (do NOT confirm)

### Test 2: Final Team toggle appears and defaults correctly
1. (Continuing from Test 1 preview, or scrape again)
2. **Verify:** A "Final Team" checkbox/toggle appears in the summary card
3. **Verify:** The checkbox is pre-checked (auto-detected from "making the...team" phrasing)
4. **Verify:** Admin can uncheck and re-check the toggle
5. Discard the preview

### Test 3: Dashboard hero card — missing count only on round 1
1. Login as parent
2. Navigate to `/dashboard`
3. **Verify:** Hero cards for round 1 show "Missing" stat (if applicable)
4. **Verify:** Hero cards for rounds 2+ do NOT show "Missing" stat

### Test 4: Sessions toggle labels for final team round
1. Navigate to `/continuations`
2. Select a round that has `is_final_team: true` from the dropdown (if one exists after testing)
3. **Verify:** Toggle shows "Final Roster (N)" and "Final Cuts (N)"
4. Select a non-final round
5. **Verify:** Toggle shows "Continuing (N)" and "Cuts (N)"

### Test 5: Dashboard final team hero card with toggle and player rows
1. Navigate to `/dashboard` (requires a finalized team round to exist)
2. **Verify:** Final team hero card shows "Final Team - {division}{level}" title
3. **Verify:** A toggle shows "Final Roster (N)" / "Final Cuts (N)"
4. **Verify:** Default view shows roster player rows with jersey, position, heart, name, previous team
5. **Verify:** Players are sorted F -> D -> G
6. Tap "Final Cuts" toggle
7. **Verify:** Cut player rows display with same layout
8. **Verify:** Heart button is functional (test one toggle, then revert)

### Test 6: Prediction board shows official team
1. Navigate to `/teams` (requires `lockFinalTeam()` to have run)
2. **Verify:** Finalized team appears as an "official" section
3. **Verify:** Official team players cannot be dragged

### Test 7: Non-final rounds display normally
1. Navigate to `/dashboard`
2. **Verify:** Non-final hero cards show "{division} {level} - Round {N}" with Continuing/Cuts stats
3. Navigate to `/continuations`
4. **Verify:** Non-final rounds show "Continuing" / "Cuts" toggle labels

### Test 8: Build and lint
1. Run `cd frontend && npm run build`
2. **Verify:** Build passes
3. Run `cd frontend && npm run lint`
4. **Verify:** No lint errors

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 5 (if heart toggled) | Favorited a player on dashboard | Un-heart via long-press on Sessions page |

**Note:** Tests 1-2 use the scraper preview but discard without confirming — no data changes. Tests 3-7 are read-only verifications. Test 5 may involve a heart toggle — revert immediately. Do NOT confirm a final team round during testing without coordinating with the user.

## Files to Touch

1. `frontend/app/(app)/continuations/scraper-actions.ts` — fix Method 2 regex for `<p>` + br, improve `classifyPage()`, add `isFinalTeamOverride` param to `saveDraftRound()`, auto-call `lockFinalTeam()` in `confirmDraft()`
2. `frontend/components/settings/scrape-page-client.tsx` — add Final Team toggle checkbox
3. `frontend/components/continuations/sessions-toggle.tsx` — accept `isFinalTeam` prop, change labels
4. `frontend/components/continuations/continuations-page-client.tsx` — pass `is_final_team` to `SessionsToggle`
5. `frontend/app/(app)/dashboard/actions.ts` — add player data to `HeroCard` type for final teams
6. `frontend/components/dashboard/dashboard-client.tsx` — final team toggle + player rows, remove missing from non-round-1, wire up favorite toggling
7. `frontend/app/globals.css` — new styles for final team toggle, dashboard hero player list

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
