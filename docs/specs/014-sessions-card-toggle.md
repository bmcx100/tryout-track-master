# Spec 014: Sessions Page — Summary Card & Continuing/Cuts Toggle

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** 003 (Continuations tracker)

## What This Feature Does

Redesigns the Sessions (Continuations) page layout so the round selector, summary stats, and continuing/cuts switch are three distinct visual layers. The round dropdown sits at the top with more rounded corners and padding. Below it, a prominent summary card displays the team level badge and key stats (continuing count, cut count, session count + date range, plus new/disappeared when non-zero) — always visible, not collapsed. Below the card, a small pill-style toggle (matching the teams page pattern but smaller) lets the user switch between viewing continuing players or cut players — only one list is visible at a time.

## Current State

### Pages & Components

- **Page:** `frontend/app/(app)/continuations/page.tsx` — Server Component that fetches divisions, players, rounds, annotations, passes to client.
- **Client wrapper:** `frontend/components/continuations/continuations-page-client.tsx` — Manages state (selectedIndex for round dropdown, selectedPlayer for detail sheet, linking/adding). Renders a header with the round `<select>`, then a `<RoundSection>`.
- **RoundSection:** `frontend/components/continuations/round-section.tsx` — Renders three collapsible sections:
  1. **Summary bar** — collapsible, shows session count + date range, then a `<ul>` with stats (players continuing, cuts, new players, session times).
  2. **Continuing section** — collapsible, header "Continuing (N)", player rows grouped by session subheaders.
  3. **Cuts section** — collapsible, header "Cuts (N)", player rows for players in previous round not in current.
- **Player row:** `frontend/components/continuations/continuation-player-row.tsx` — Renders jersey, position, heart, name, notes icon, link icon, IP badge, previous team badge.
- **View toggle (teams page pattern):** `frontend/components/teams/view-toggle.tsx` — Animated pill toggle with ref-based positioning. Uses `view-toggle`, `view-toggle-pill`, `view-toggle-btn` CSS classes.

### Styles

- Continuations CSS: `frontend/app/globals.css` starting at line ~1681 — classes prefixed `.continuations-*` and `.continuation-player-row`.
- View toggle CSS: `frontend/app/globals.css` lines ~203–227 — `.view-toggle`, `.view-toggle-pill`, `.view-toggle-btn`.

### Key Data

- `activeRound.jersey_numbers` — array of jersey numbers for continuing players.
- `previousRound.jersey_numbers` — array from prior round of same `team_level` (used to compute cuts).
- `activeRound.sessions` — array of `SessionData` objects with `session_number`, `date`, `start_time`, `end_time`, `jersey_numbers`.
- `activeRound.ip_players` — array of injured player jersey numbers.
- Cuts are computed as: `previousRound.jersey_numbers.filter(jn => !activeRound.jersey_numbers.includes(jn))`.
- New players: `activeRound.jersey_numbers.filter(jn => !previousRound.jersey_numbers.includes(jn))`.
- Disappeared: players in previous round and not in current round who were NOT cut (this concept does not currently exist in the code — "cuts" and "disappeared" are the same set currently; the summary already shows "new" players but not "disappeared" as a separate concept). In the current code, cuts ARE the disappeared players. The summary card should show "N cuts" for the cut count. If there are "new" players (not in previous round), show that count. No separate "disappeared" concept is needed.

## Changes Required

### Database

No database changes needed.

### Server Actions / API Routes

No new server actions needed. All data is already fetched.

### Pages

**`frontend/app/(app)/continuations/page.tsx`** — No changes needed. Data flow stays the same.

### Components

#### Modify: `frontend/components/continuations/continuations-page-client.tsx`

1. **Move the round dropdown** out of `.continuations-header` into its own wrapper with new classes for more rounded corners and padding.
2. **Add a new `<div>` for the summary card** between the dropdown and the player list. This card:
   - Shows the team level as a badge/heading (e.g. "U15 AA").
   - Shows prominent stats: continuing count, cut count, session count + date range.
   - Shows new player count only when > 0.
   - Is always visible (not collapsible).
3. **Add a toggle** below the summary card. New state: `activeView: "continuing" | "cuts"` (default: `"continuing"`). Use a small pill-style toggle component.
4. **Pass `activeView` to `RoundSection`** so it only renders one list.

#### Modify: `frontend/components/continuations/round-section.tsx`

1. **Remove the collapsible summary bar** (the `summaryExpanded` state, the `<button>` with chevron, the `<ul className="continuations-round-summary">`). Summary info moves to the parent card.
2. **Remove the "Continuing" and "Cuts" collapsible section headers** (the `<button className="continuations-section-label">` elements). The toggle replaces them.
3. **Accept a new prop `activeView: "continuing" | "cuts"`**. Render only the matching list:
   - `"continuing"` — render session-grouped player rows (existing logic), without the "Continuing (N)" collapsible header.
   - `"cuts"` — render cut player rows (existing logic), without the "Cuts (N)" collapsible header.
4. **Export summary computation** so the parent can display it on the card. Add and export a helper function (or compute in the parent) that returns: `{ totalContinuing, cutCount, newCount, sessionInfo }`. The parent already has access to `activeRound`, `previousRound`, and the existing `getSessionInfo` helper can be extracted or duplicated.

#### Create: `frontend/components/continuations/sessions-toggle.tsx`

A smaller variant of the teams `ViewToggle`. Same animated pill pattern but with:
- Labels: "Continuing" and "Cuts"
- Smaller text and padding than the teams toggle.
- Props: `activeView: "continuing" | "cuts"`, `onViewChange: (view) => void`, `continuingCount: number`, `cutCount: number`.
- Display counts in the labels: "Continuing (28)" / "Cuts (4)".

### Styles

Add to `frontend/app/globals.css`:

**Round dropdown (updated):**
- `.continuations-round-select` — increase `border-radius` to `12px`, increase padding to `8px 14px`.

**Summary card:**
- `.sessions-summary-card` — rounded card (`border-radius: 14px`) with `var(--dm-dune)` background, `var(--dm-border)` border, padding `14px 16px`, margin `0 16px 0`.
- `.sessions-summary-level` — team level badge at top of card. Bold, `var(--dm-gold)` color, `font-family: var(--font-ibm-plex-mono)`, `font-size: 14px`.
- `.sessions-summary-stats` — stats area below badge. Use `font-family: var(--font-ibm-plex-mono)`, `font-size: 13px`.
- `.sessions-summary-stat` — individual stat item. `color: var(--dm-umber)`.
- `.sessions-summary-stat strong` — count number. `color: var(--dm-gold)`.
- `.sessions-summary-session-info` — session count + date range. `color: var(--dm-dust)`, `font-size: 12px`.

**Sessions toggle (smaller variant of view-toggle):**
- `.sessions-toggle` — same layout as `.view-toggle` but with `mx-4 my-2` and smaller overall size.
- `.sessions-toggle-pill` — same animation as `.view-toggle-pill`.
- `.sessions-toggle-btn` — same as `.view-toggle-btn` but `py-1.5 text-xs`.
- `.sessions-toggle-btn.active` — same dark text on active pill.

## Key Implementation Details

1. **Extracting summary stats to the parent:** The summary stats (continuing count, cut count, new player count, session info string) are currently computed inside `RoundSection`. Move these computations into `ContinuationsPageClient` (or extract them into a shared helper) so the summary card can display them. The data needed is:
   - `totalContinuing = activeRound.jersey_numbers.length`
   - `cuts = previousRound ? previousRound.jersey_numbers.filter(jn => !activeRound.jersey_numbers.includes(jn)) : []`
   - `cutCount = cuts.length`
   - `newPlayers = previousRound ? activeRound.jersey_numbers.filter(jn => !previousRound.jersey_numbers.includes(jn)) : []`
   - `newCount = newPlayers.length`
   - `sessionInfo = getSessionInfo(activeRound.sessions)` — extract the `getSessionInfo` and `formatDate` helpers from `round-section.tsx` or duplicate them.

2. **Toggle default:** Default to `"continuing"` view. When the user switches rounds via the dropdown, reset the toggle to `"continuing"`.

3. **Session subheaders inside continuing view:** The session subheaders (Session 1, Session 2, etc.) and their per-session collapsible behavior should remain as-is within the continuing view. Only the top-level "Continuing" and "Cuts" collapsible headers are replaced by the toggle.

4. **Empty cuts state:** When there are 0 cuts (e.g. first round), the "Cuts" toggle button should show "Cuts (0)". When selected, show "No cuts yet" message (existing `.continuations-empty-cuts` class).

5. **The round dropdown** currently uses a native `<select>`. Keep it as a `<select>` but style it with more border-radius and padding. Move it above the summary card in the DOM.

6. **Pattern to follow for the toggle:** Copy the ref-based pill animation from `frontend/components/teams/view-toggle.tsx`. The only changes are: different labels, smaller sizing, counts in labels, different CSS class prefix (`sessions-toggle-*`).

7. **IP players display:** The current summary shows IP (injured player) count inline with continuing count. On the summary card, just show the total continuing count. IP detail can be seen in the player list itself.

## Acceptance Criteria

- [ ] Round dropdown has visibly more border-radius (~12px) and padding (~8px 14px) than before.
- [ ] Summary card appears below the dropdown, always visible (not collapsible).
- [ ] Summary card shows: team level badge (e.g. "U15 AA"), continuing count, cut count, session count + date range.
- [ ] Summary card shows "N new" only when new players exist (count > 0).
- [ ] Toggle appears below the summary card with "Continuing (N)" and "Cuts (N)" labels.
- [ ] Toggle has animated sliding pill, matching the teams page style but smaller.
- [ ] Only one player list is visible at a time (continuing OR cuts, never both).
- [ ] Switching rounds via dropdown resets toggle to "Continuing".
- [ ] Session subheaders within the continuing view still work (collapsible per session).
- [ ] "No cuts yet" message shows when cuts view is selected with 0 cuts.
- [ ] Player interactions (long-press, favorite, notes) still work in both views.
- [ ] Build passes (`npm run build`).
- [ ] No lint errors (`npm run lint`).

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. You MUST follow these rules to avoid corrupting live data:

1. **Prefer read-only tests.** Verify by navigating and taking snapshots — do not modify data unless the test absolutely requires it.
2. **When a test MUST write data**, log every mutation in a "Test Mutations" list at the end of this section.
3. **Revert all test mutations after testing.**
4. **Confirm with the user.**
5. **Never delete real player records or change real player statuses during testing.**

**Setup:** Log in as `testparent@test.com` / `testpass123`. Navigate to `/continuations`. Ensure the division is set to U15 (should be default).

### Test 1: Round dropdown styling
1. Navigate to `/continuations`.
2. Take a snapshot of the page.
3. **Verify:** The round dropdown is visible at the top, with visibly rounded corners and comfortable padding. It should not look like the old tight/square select.

### Test 2: Summary card is visible and not collapsible
1. Navigate to `/continuations`.
2. Take a snapshot.
3. **Verify:** Below the dropdown, a summary card is visible showing:
   - Team level (e.g. "U15 AA") as a prominent label.
   - Continuing count (e.g. "28 continuing").
   - Cut count (e.g. "4 cuts").
   - Session info (e.g. "3 sessions · Sat, Apr 18 – Mon, Apr 20").
4. **Verify:** There is no chevron or expand/collapse button on the summary card. It is always fully visible.

### Test 3: Toggle exists below card with correct labels
1. Navigate to `/continuations`.
2. Take a snapshot.
3. **Verify:** Below the summary card, a pill-style toggle shows "Continuing (N)" and "Cuts (N)" with actual counts. "Continuing" is active by default with the pill highlight.

### Test 4: Toggle switches between views
1. Navigate to `/continuations`.
2. Click the "Cuts" toggle button.
3. Take a snapshot.
4. **Verify:** The pill animates to the "Cuts" side. The player list now shows cut players (dimmed, strikethrough jerseys). The continuing players are NOT visible.
5. Click the "Continuing" toggle button.
6. Take a snapshot.
7. **Verify:** The pill animates back. Continuing players are shown. Cut players are NOT visible.

### Test 5: Switching rounds resets toggle
1. Navigate to `/continuations`.
2. Click the "Cuts" toggle to switch to cuts view.
3. Change the round dropdown to a different round.
4. Take a snapshot.
5. **Verify:** The toggle has reset to "Continuing" (active). The continuing player list is shown for the new round.

### Test 6: New player count shown when non-zero
1. Navigate to `/continuations`.
2. Select a round that is NOT the first round (so there is a previous round to compare against).
3. Take a snapshot of the summary card.
4. **Verify:** If there are new players (appeared in this round but not the previous), a "N new" line appears on the card. If there are no new players, that line does not appear.

### Test 7: Zero cuts state
1. Navigate to `/continuations`.
2. Select the earliest round (Round 1, which has no previous round).
3. Click the "Cuts" toggle.
4. Take a snapshot.
5. **Verify:** The toggle shows "Cuts (0)". The player list area shows "No cuts yet" message.

### Test 8: Session subheaders still work in continuing view
1. Navigate to `/continuations`.
2. Ensure "Continuing" toggle is active.
3. Take a snapshot.
4. **Verify:** If the round has multiple sessions, session subheaders are visible (e.g. "Session 1 · 5:30pm–6:30pm").
5. Click a session subheader to collapse it.
6. Take a snapshot.
7. **Verify:** The session's player rows collapse. Other sessions remain visible.

### Test 9: Player interactions still work
1. Navigate to `/continuations`.
2. Long-press on a known player row.
3. **Verify:** The player detail sheet opens with jersey, name, position, notes, etc.
4. Close the detail sheet.
5. Switch to "Cuts" view via the toggle.
6. Long-press on a cut player row.
7. **Verify:** The detail sheet opens for the cut player.

### Test 10: Single-round edge case
1. If an association/division has only one round (no dropdown), navigate to `/continuations`.
2. Take a snapshot.
3. **Verify:** No dropdown is shown (just the level title). Summary card still displays correctly. Toggle still works.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none — all tests are read-only) | — | — |

## Files to Touch

1. `frontend/components/continuations/continuations-page-client.tsx` — Move dropdown, add summary card, add toggle state, pass activeView to RoundSection.
2. `frontend/components/continuations/round-section.tsx` — Remove collapsible summary bar and section headers, accept `activeView` prop, render only active view.
3. `frontend/components/continuations/sessions-toggle.tsx` — **CREATE** — Small pill toggle for Continuing/Cuts.
4. `frontend/app/globals.css` — Update `.continuations-round-select` styling, add `.sessions-summary-card`, `.sessions-summary-*`, `.sessions-toggle-*` classes.

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
