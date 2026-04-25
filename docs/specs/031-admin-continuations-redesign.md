# Spec 031: Admin Continuations Redesign

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** None (all prerequisite specs 003, 005, 007, 017, 018 are complete)

## What This Feature Does

Replaces the current `/settings/scrape` page with a unified admin Continuations management page at `/admin/continuations`. Admins can scrape new rounds, view all published rounds for the active division, edit jersey numbers on any round (bulk text area), delete rounds (with automatic `made_team` reversion for final team rounds), and manage an estimated player count per round. The parent-facing `/continuations` page gains estimated-cut display when the previous round has no jersey list but has an estimated player count.

## Current State

### Admin scraper page
- **Route:** `frontend/app/(app)/settings/scrape/page.tsx` — server component that calls `requireAdmin()`, fetches drafts and URL, renders `ScrapePageClient`
- **Client component:** `frontend/components/settings/scrape-page-client.tsx` (466 LOC) — handles scrape, preview, manual entry modal, draft confirm/discard, size warning
- **Settings link:** `frontend/components/settings/settings-page-client.tsx` line 81 — "Scrape Continuations" row linking to `/settings/scrape`

### Scraper actions
- **`frontend/app/(app)/continuations/scraper-actions.ts`** — `scrapeContinuationsPage()`, `saveDraftRound()`, `confirmDraft()`, `discardDraft()`, `getDraftRounds()`, `getContinuationsUrl()`, `getNextRoundNumber()`

### Continuations actions
- **`frontend/app/(app)/continuations/actions.ts`** — `getAllPublishedRounds()`, `getAllRoundsForTeam()`, `lockFinalTeam()`, plus annotation/order wrappers

### Parent-facing continuations page
- **Route:** `frontend/app/(app)/continuations/page.tsx` — fetches published rounds, players, annotations
- **Client:** `frontend/components/continuations/continuations-page-client.tsx` (389 LOC) — round selector dropdown, sessions toggle (continuing/cuts), position filter, round section rendering
- **Round section:** `frontend/components/continuations/round-section.tsx` (553 LOC) — builds player lists for continuing and cuts views, drag support, session subheaders

### Database
- **`continuation_rounds` table** — `id`, `association_id`, `division`, `team_level`, `round_number`, `is_final_team`, `jersey_numbers` (text[]), `ip_players` (text[]), `sessions` (jsonb), `status` (draft/published), `source_url`, `scraped_at`, `session_info`, `created_at`
- **`continuations_urls` table** — `id`, `association_id`, `division`, `url`
- **`continuation_orders` table** — `id`, `user_id`, `round_id`, `player_order` (text[])

### Admin route group
- **`frontend/app/admin/layout.tsx`** — existing admin layout with role check
- Currently only contains `frontend/app/admin/import/` for CSV import

## Changes Required

### Database

**New migration: `add_estimated_players_to_continuation_rounds.sql`**

Add an `estimated_players` integer column (nullable) to `continuation_rounds`:

```sql
ALTER TABLE continuation_rounds
  ADD COLUMN estimated_players integer;
```

No default — existing rounds will have `NULL` (meaning "not set"). The jersey count is the authoritative count when jersey numbers exist; `estimated_players` is only meaningful for rounds with empty jersey lists (e.g., Round 1 placeholder) or as an optional override.

### Server Actions / API Routes

**New file: `frontend/app/admin/continuations/actions.ts`**

1. **`getAllRounds(associationId: string, division: string): Promise<ContinuationRound[]>`**
   - Returns ALL rounds (both draft and published) for the division, ordered by `team_level`, then `round_number` descending
   - Admin-only (verify role)

2. **`updateRound(roundId: string, updates: { jersey_numbers?: string[], ip_players?: string[], session_info?: string, team_level?: string, round_number?: number, is_final_team?: boolean, estimated_players?: number | null }): Promise<{ error?: string }>`**
   - Admin-only
   - Updates the specified fields on a published or draft round
   - If `jersey_numbers` changes, clear any stale values from `ip_players` that are no longer in the jersey list

3. **`deleteRound(roundId: string): Promise<{ error?: string, revertedCount?: number }>`**
   - Admin-only with confirmation (client-side dialog)
   - If the round is `is_final_team === true`:
     - Find all players whose `jersey_number` is in the round's `jersey_numbers` AND whose current `status === 'made_team'` AND `team_id` matches the team for this `division + team_level`
     - Revert those players: set `status = 'trying_out'`, `team_id = NULL`
     - Return the count of reverted players
   - Delete the round from `continuation_rounds`
   - Also delete any `continuation_orders` rows referencing this round

4. **`createEmptyRound(associationId: string, division: string, teamLevel: string, roundNumber: number, sessionInfo?: string): Promise<{ roundId: string, error?: string }>`**
   - Admin-only
   - Creates a round with empty `jersey_numbers`, `status: 'published'`, no `source_url`
   - Used for Round 1 placeholder scenarios where there's nothing to scrape

**Existing actions to keep (imported from current locations):**
- `scrapeContinuationsPage()`, `saveDraftRound()`, `confirmDraft()`, `discardDraft()`, `getContinuationsUrl()`, `getNextRoundNumber()` — all remain in `scraper-actions.ts`, imported by the new admin page

### Pages

**New page: `frontend/app/admin/continuations/page.tsx`**
- Server component: `requireAdmin()`, fetch active division, all rounds, source URL
- Compute `latestTeamLevel`: look at the most recent published round for the active division (by `created_at` descending) and extract its `team_level`. Pass this to the client as `defaultTeamLevel`. Falls back to `"AA"` if no rounds exist.
- Renders `AdminContinuationsClient`

**Remove: `frontend/app/(app)/settings/scrape/page.tsx`** — delete this file and directory

**Modify: `frontend/components/settings/settings-page-client.tsx`**
- Change the "Scrape Continuations" link from `/settings/scrape` to `/admin/continuations`
- Update label to "Manage Continuations"

### Components

**New file: `frontend/components/admin/admin-continuations-client.tsx`**

Main client component for the admin continuations management page. Sections:

#### Top Bar
- Back arrow → `/settings`
- "Verify source page" link (external, same as current)
- Page title: "Continuations"

#### Scrape Section
- "Scrape New Round" button (or auto-scrape on first load if no drafts, same as current behavior)
- When scraping: loading spinner
- When preview ready: summary card (type, team level dropdown, round number input, player count, IP count, report date, session info text input, final team checkbox, estimated players input)
- **Team level auto-default:** The team level dropdown initializes to `defaultTeamLevel` (the most recent published round's team level), NOT the scraper's extracted team level. The scraper may detect a different level from the page text — if so, show it as a secondary hint (e.g., "Detected: AA") but still default to the latest level. This prevents accidentally publishing a round under the wrong team level when the association hasn't updated their page headers yet. The admin can always override via the dropdown.
- Jersey list preview: **collapsible** (collapsed by default showing just count, expandable with max-height scroll)
- Confirm / Discard buttons
- "Edit manually" link opens text area modal (same as current)
- Size warning dialog for final team (same as current)
- "Create Empty Round" button — visible when no URL is configured or when admin wants to create a placeholder round manually. Shows a small form: team level dropdown (also defaults to `defaultTeamLevel`), round number, session info text input. Creates via `createEmptyRound()`.

#### Published Rounds List
- Grouped by team level (e.g., "AA", "A"), each group sorted by round number descending
- Each round is a **collapsible card** (collapsed by default):
  - **Header row (always visible):** `[team_level] Round [N]` (or "Final Team"), player count badge, session info text, chevron
  - **Expanded content:**
    - Metadata: source URL link, scraped date, estimated players field (editable inline number input)
    - Jersey numbers list in a **scrollable container** (`max-height: 300px`, `overflow-y: auto`). Each jersey shown as a simple row with the number.
    - "Edit Jerseys" button → opens text area modal pre-filled with current jerseys (one per line), Apply/Cancel
    - Session info (editable text input)
    - "Final Team" checkbox (editable)
    - "Save Changes" button — only enabled when changes exist (compared to original)
    - "Delete Round" button (danger style) → opens confirmation dialog

#### Delete Confirmation Dialog
- Text: "Delete [division] [team_level] Round [N]?"
- If `is_final_team`: additional warning: "This is a final team round. [X] players will be reverted from 'made_team' to 'trying_out'." (count fetched on dialog open or pre-computed)
- Confirm / Cancel buttons

#### Empty State
- When no rounds exist for the division: "No continuations yet. Scrape or create a round to get started."

### Parent-Facing Cuts Display (Estimated Cuts)

**Modify: `frontend/components/continuations/round-section.tsx`**

In the cuts view (`activeView === "cuts"`), when `cutPlayers.length === 0` (no computed cuts because previous round has no jersey list), check if `previousRound.estimated_players` exists:
- If yes: show "~[estimated_players - activeRound.jersey_numbers.length] estimated cuts" instead of "No cuts yet"
- If no: show "Cut count unavailable" (when previous round is a placeholder with no estimate)
- If `previousRound` is null (this is the first round): show "No cuts yet" (unchanged)

**Modify: `frontend/components/continuations/continuations-page-client.tsx`**

Update the `cutCount` computation to account for estimated cuts:
- When `previousRound` exists but `previousRound.jersey_numbers.length === 0` and `previousRound.estimated_players` is set:
  - `cutCount = previousRound.estimated_players - activeRound.jersey_numbers.length`
  - Mark as estimated (pass an `isEstimatedCuts` flag to `SessionsToggle`)
- The `SessionsToggle` shows "~X" instead of "X" on the cuts pill when estimated

**Modify: `frontend/components/continuations/sessions-toggle.tsx`**

Add optional `isEstimatedCuts` prop. When true, prefix the cut count with "~".

### Styles

Add to `globals.css`:

- `.admin-continuations-page` — page container
- `.admin-round-card` — collapsible card for each round
- `.admin-round-card-header` — clickable header row with chevron
- `.admin-round-card-body` — expanded content area
- `.admin-jersey-scroll` — scrollable jersey list container: `max-height: 300px; overflow-y: auto`
- `.admin-jersey-collapsed` — collapsed state showing just count
- `.admin-round-actions` — button row (Save / Delete)
- `.admin-delete-warning` — warning text in delete dialog for final team rounds
- `.admin-estimated-input` — small number input for estimated players
- `.continuations-estimated-cuts` — estimated cuts display on parent page
- Reuse existing `.scrape-*` classes where possible for the scrape section (modal, preview, etc.)

## Key Implementation Details

1. **Admin route group:** The page lives under `frontend/app/admin/continuations/` which inherits the admin layout at `frontend/app/admin/layout.tsx`. This layout already checks for `group_admin` or `admin` role.

2. **Division awareness:** The page uses the active division (same pattern as current scrape page — calls `getActiveDivision()`). All rounds shown are for the active division only.

3. **Jersey edit flow:** The text area modal is the same UX as the current "Edit manually" modal in `scrape-page-client.tsx`. Parse function `parseJerseyNumbers()` handles comma or newline separated input with deduplication. Move this utility to a shared location or keep it in the new component.

4. **Delete + revert flow:** When deleting a final team round, the `deleteRound` server action must:
   - Query players in the round's jersey list who have `status = 'made_team'` and `team_id` matching the division+team_level team
   - Set `status = 'trying_out'`, `team_id = NULL` for those players
   - Then delete the round and associated orders
   - This should all happen in a single server action (no client-side multi-step)

5. **Estimated players column:** The `estimated_players` field is nullable. When a round has jersey numbers, the primary count is `jersey_numbers.length`. The estimated field is optional and only practically useful for rounds with empty jersey lists (Round 1 placeholders). The admin can also use it on regular rounds to note "~19 on the ice" when the scrape shows 17 continuing.

6. **Settings link update:** The "Scrape Continuations" row in settings changes to "Manage Continuations" and points to `/admin/continuations`. The icon can stay the same (Scan).

7. **RLS:** The new server actions use the standard authenticated Supabase client. Existing RLS policies on `continuation_rounds` already allow group_admin/admin write access. The `deleteRound` action also needs to update `tryout_players` — existing RLS policies allow group_admin/admin to update players in their association.

8. **ContinuationRound type:** Update the `ContinuationRound` type in `frontend/types/` to include the new `estimated_players?: number | null` field. If types are auto-generated from Supabase, regenerate after migration.

## Acceptance Criteria

- [ ] `/admin/continuations` page loads and shows all rounds for the active division, grouped by team level
- [ ] Scrape flow works identically to current (auto-scrape, preview, confirm, manual entry)
- [ ] Team level dropdown defaults to the most recent published round's team level, not the scraper's detected level
- [ ] "Create Empty Round" creates a placeholder round with no jersey numbers
- [ ] "Create Empty Round" form defaults team level to the most recent published round's team level
- [ ] Each round card is collapsible (collapsed by default)
- [ ] Expanded card shows jersey numbers in a scrollable container (max 300px height)
- [ ] "Edit Jerseys" opens text area modal, Apply updates the round's jersey list
- [ ] Session info, final team checkbox, and estimated players are editable with an explicit Save button
- [ ] "Delete Round" shows confirmation dialog
- [ ] Deleting a final team round reverts affected players from `made_team` to `trying_out`
- [ ] Parent-facing `/continuations` page shows estimated cuts ("~X estimated cuts") when previous round has estimated_players but no jersey list
- [ ] Sessions toggle shows "~X" for estimated cut counts
- [ ] `/settings/scrape` route is removed
- [ ] Settings page links to `/admin/continuations` with label "Manage Continuations"
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow safety rules strictly. Use the TEST/SANDBOX association (`a2000000-0000-0000-0000-000000000002`) for any write operations.

**Setup:** Log in as `testadmin@test.com` / `TestAdmin1234`. Navigate to the app. The admin account has access to NGHA (Nepean Wildcats). For write tests, switch to the TEST sandbox association if possible, or use NGHA U15 data (which has existing rounds) for read-only verification.

### Test 1: Page loads with published rounds
1. Navigate to `/admin/continuations`
2. Take a snapshot
3. **Verify:** Page title is "Continuations". Published rounds are listed, grouped by team level. Each round shows as a collapsed card with team level, round number, and player count.

### Test 2: Round card expand/collapse
1. On `/admin/continuations`, click a round card header
2. Take a snapshot
3. **Verify:** Card expands showing jersey numbers in a scrollable container, session info, estimated players field, Edit Jerseys button, Save Changes button (disabled), Delete Round button
4. Click the header again
5. **Verify:** Card collapses back to header-only view

### Test 3: Jersey list scrollable when long
1. Expand a round that has > 15 players
2. Take a snapshot of the jersey list area
3. **Verify:** Jersey list container has a visible scrollbar or is scrollable, not pushing the page layout

### Test 4: Edit jerseys via text area
1. Expand a round card
2. Click "Edit Jerseys"
3. **Verify:** Text area modal opens, pre-filled with current jersey numbers (one per line)
4. Note the current jerseys for revert purposes
5. Add a test jersey number (e.g., "999") to the text area
6. Click Apply
7. **Verify:** Jersey list now shows the added number, Save Changes button is enabled
8. Click "Save Changes"
9. **Verify:** Changes saved (page doesn't show unsaved state)
10. **Revert:** Edit jerseys again, remove "999", Apply, Save

### Test 5: Edit session info and estimated players
1. Expand a round card
2. Change session info text to "Test session info"
3. Enter "25" in estimated players field
4. **Verify:** Save Changes button becomes enabled
5. Click Save Changes
6. **Verify:** Values persist after page reload
7. **Revert:** Clear session info and estimated players, Save

### Test 6: Scrape new round
1. On `/admin/continuations`, click "Scrape New Round"
2. **Verify:** Loading spinner appears, then preview card with scraped data (type, team level, jerseys, etc.)
3. Click "Discard"
4. **Verify:** Preview clears, back to round list view

### Test 7: Create empty round (placeholder)
1. Click "Create Empty Round"
2. **Verify:** Form appears with team level dropdown, round number, session info
3. Fill in: team level = "A", session info = "A-M / N-Z test"
4. Click Create
5. **Verify:** New round appears in the list with 0 players
6. Expand the new round
7. Enter estimated players = "45"
8. Save
9. **Verify:** Estimated players shows 45
10. **Revert:** Delete this round (Test 8 can use it)

### Test 8: Delete a non-final-team round
1. Expand the test round created in Test 7 (or another non-final round)
2. Click "Delete Round"
3. **Verify:** Confirmation dialog appears: "Delete [division] [team_level] Round [N]?" with no made_team warning
4. Click Confirm
5. **Verify:** Round is removed from the list

### Test 9: Delete final team round (made_team reversion)
- **Skip if no safe final team round exists in sandbox.** Only run this test if a final team round can be safely created and deleted in the TEST association.
1. Create a final team round in sandbox (scrape or manual + set final team checkbox)
2. Confirm/publish it
3. Click Delete Round on that round
4. **Verify:** Dialog shows warning about made_team reversion with player count
5. Confirm deletion
6. **Verify:** Round deleted, affected players reverted to trying_out

### Test 10: Estimated cuts on parent-facing page
1. Ensure a round exists where the previous round has `estimated_players` set but empty `jersey_numbers`
2. Navigate to `/continuations` (parent view)
3. Select the round that follows the placeholder
4. Switch to "Cuts" view
5. **Verify:** Shows "~X estimated cuts" (where X = estimated_players - continuing count)

### Test 11: Settings page link updated
1. Navigate to `/settings`
2. Take a snapshot
3. **Verify:** Admin section shows "Manage Continuations" (not "Scrape Continuations") linking to `/admin/continuations`

### Test 12: Team level auto-defaults to most recent round
1. Navigate to `/admin/continuations`
2. Note the team level of the most recent published round (e.g., "A" if A-level rounds were last published)
3. Click "Scrape New Round" (or let it auto-scrape)
4. When preview appears, check the team level dropdown
5. **Verify:** Dropdown defaults to the most recent round's team level, not necessarily what the scraper detected. If the scraper detected a different level, a "Detected: [X]" hint is shown.
6. Discard the scrape
7. Click "Create Empty Round"
8. **Verify:** Team level dropdown also defaults to the most recent round's team level

### Test 13: Old route removed
1. Navigate to `/settings/scrape`
2. **Verify:** 404 page or redirect (route no longer exists)

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 4 | Added jersey "999" to a round | Remove "999" via Edit Jerseys, Save |
| Test 5 | Changed session info and estimated players | Clear both fields, Save |
| Test 7 | Created empty placeholder round | Delete via Test 8 |
| Test 8 | Deleted the placeholder round from Test 7 | N/A (was test data) |
| Test 9 | Created and deleted final team round in sandbox | N/A (self-cleaning) |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

### Create
1. `backend/supabase/migrations/[timestamp]_add_estimated_players_to_continuation_rounds.sql`
2. `frontend/app/admin/continuations/page.tsx`
3. `frontend/app/admin/continuations/actions.ts`
4. `frontend/components/admin/admin-continuations-client.tsx`

### Modify
5. `frontend/components/settings/settings-page-client.tsx` — change link from `/settings/scrape` to `/admin/continuations`, update label
6. `frontend/components/continuations/round-section.tsx` — estimated cuts display in cuts view
7. `frontend/components/continuations/continuations-page-client.tsx` — estimated cut count computation
8. `frontend/components/continuations/sessions-toggle.tsx` — `isEstimatedCuts` prop for "~X" display
9. `frontend/types/database.ts` or `frontend/types/index.ts` — add `estimated_players` to `ContinuationRound` type (or regenerate)
10. `frontend/app/globals.css` — new admin continuations styles

### Delete
11. `frontend/app/(app)/settings/scrape/page.tsx` — remove file
12. `frontend/app/(app)/settings/scrape/` — remove directory

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
