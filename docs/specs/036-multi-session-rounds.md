# Spec 036: Multi-Session Rounds

**PRD Reference:** FR-039
**Priority:** Should Have
**Depends on:** 031 (Admin continuations redesign)

## What This Feature Does

When an association posts a continuation round with split sessions (e.g., "Split 1 6:00pm" and "Split 2 7:00pm"), the admin toggles a "Multi-Session" switch on the scraper page **before** scraping. The scraper then attempts to split the scraped jersey numbers into separate sessions based on HTML structure (multiple number blocks). The admin sees editable per-session textareas in the draft preview — they can correct which jerseys belong to which session before confirming. Parents see each session as a collapsible section on the Sessions page (this already works).

**Key design principle:** The existing single-session scrape flow is never changed. The multi-session toggle is entirely opt-in. When the toggle is off, everything works exactly as it does today.

## Current State

### What works today
- The `continuation_rounds` table already has a `sessions` JSONB column that stores an array of `{ session_number, date, start_time, end_time, jersey_numbers }` objects.
- The parent-facing `round-section.tsx` already renders per-session collapsible sections when `sessions` data is populated (`round-section.tsx:540-565`). Each session shows "Session N · start–end" with a player count and its own player list.
- The `round-history-modal.tsx` already reads session data and displays dates.
- The `continuations-page-client.tsx` computes `sessionInfo` from sessions and displays a summary card.

### What is broken / missing
- **The scraper only captures the first block of jersey numbers.** `extractJerseyNumbers()` in `scraper-actions.ts:76-128` uses `html.match()` (non-global) for Method 2 (BR-separated), so it finds only the first `<div>` block and returns early. On the live NGHA U15 page, this means Split 1 is captured but Split 2 is lost.
- **No multi-session toggle.** There is no way for the admin to tell the scraper that the page contains split sessions.
- **The `ScrapeResult` type has no multi-block output.** Sessions are constructed only in `saveDraftRound()` from the `reportingDate`, resulting in at most `[{ date: "..." }]` with no `session_number`, `start_time`, `end_time`, or per-session `jersey_numbers`.
- **No per-session preview or editing.** The admin draft preview shows a single flat jersey list.
- **No session indicator on published rounds.** Published round cards show `session_info` text but not structured session data.

### Key files

| File | Role |
|------|------|
| `frontend/app/(app)/continuations/scraper-actions.ts` | Scraper extraction logic, `ScrapeResult` type, `saveDraftRound()` |
| `frontend/components/admin/admin-continuations-client.tsx` | Admin scrape UI: draft preview card, published round cards |
| `frontend/components/continuations/round-section.tsx` | Parent-facing session rendering (already works) |
| `frontend/components/continuations/continuations-page-client.tsx` | Parent page, session summary card |
| `frontend/components/continuations/round-history-modal.tsx` | Round history modal, session date display |
| `frontend/app/(app)/admin/continuations/actions.ts` | `updateRound()`, `createEmptyRound()` server actions |
| `frontend/app/globals.css` | Styles for scraper UI and round cards |

### Live page HTML structure (NGHA U15)

The page at `https://www.gowildcats.ca/content/u15-continuations` uses this structure for split sessions:

```html
<div>The following are the splits for the U15BB tryouts.</div>
<div><strong>Split 1 6:00pm</strong><br>107<br>153<br>164<br>...</div>
<div>&nbsp;</div>
<div><strong>Split 2 7:00pm</strong><br>48<br>121<br>152<br>...</div>
```

Key patterns: a `<strong>` tag containing the split label and time, followed by `<br>`-separated jersey numbers within the same `<div>`. Sessions are separated by empty `<div>&nbsp;</div>` spacers. Each block has at least 12+ jersey numbers.

## Changes Required

### Database

No database changes needed. The `sessions` JSONB column already exists and the `SessionData` shape (`session_number`, `date`, `start_time`, `end_time`, `jersey_numbers`) is already used by the parent-facing components.

### Server Actions / API Routes

#### `scraper-actions.ts` changes

**1. Add `blocks` field to `ScrapeResult` type:**

Add a `blocks` array to `ScrapeResult` with shape `{ jerseyNumbers: string[], ipPlayers: string[], label: string }[]`. Each block represents a distinct group of jersey numbers found on the page. When the page has a single block, this array has one entry (same as today's flat result). When multiple blocks exist, each block becomes a session candidate.

The existing `jerseyNumbers` and `ipPlayers` fields remain and always contain the union of all blocks (backwards compatible).

**2. Modify `extractJerseyNumbers` to return ALL blocks (not just first):**

Change Method 2 from `html.match()` (returns first match only) to a global regex loop (`matchAll` or repeated `exec`) so ALL `<div>/<p>` blocks with BR-separated numbers are captured. Return an array of blocks instead of a single flat list.

For each block, also attempt to extract a label from any preceding `<strong>`, `<b>`, `<h2>`, `<h3>` tag within the same `<div>` (e.g., "Split 1 6:00pm"). Store this as the block's `label` field.

The function's return type changes to:
`{ blocks: { jerseyNumbers: string[], ipPlayers: string[], label: string }[] }`

The caller (`scrapeContinuationsPage`) unions all block jersey numbers and IP players into the top-level `ScrapeResult.jerseyNumbers` and `ScrapeResult.ipPlayers` fields for backwards compatibility.

**3. No changes to `scrapeContinuationsPage` flow:**

The function still calls `extractJerseyNumbers`, still classifies the page, still extracts team level and reporting date. The only change is that it now populates `ScrapeResult.blocks` from the extraction result.

**4. Update `saveDraftRound`:**

Add a new optional parameter `sessions` (array of `{ session_number, jersey_numbers, label }` objects). When provided, build the `sessions` JSONB array with proper `session_number`, `start_time` (empty string), `end_time` (empty string), `date` (from `reportingDate` or empty), and `jersey_numbers`. The round-level `jersey_numbers` is the union of all session jersey numbers. The round-level `ip_players` is the union of all session IP players.

When `sessions` is not provided (toggle off), behavior is unchanged.

#### `admin/continuations/actions.ts` changes

**Update `updateRound`** to accept an optional `sessions` field so that editing a published round can update its session data. Add `sessions?: unknown` to the `updates` type.

### Pages

No new pages. The admin continuations page at `/admin/continuations` (rendered by `admin-continuations-client.tsx`) is modified in-place.

### Components

#### `admin-continuations-client.tsx` modifications

**1. Multi-Session toggle — before scrape:**

Add a "Multi-Session" toggle switch next to the "Scrape New Round" button. This is a simple on/off switch (like the existing "Final Team" checkbox pattern). Default is off. The toggle state is stored in component state (`multiSession: boolean`).

When the toggle is on, the "Scrape New Round" button label remains the same — the toggle is just a flag that changes what happens after the scrape returns.

**2. Draft preview — multi-session mode (toggle ON):**

When multi-session is on and the scrape returns, replace the single collapsible jersey list with a **split panel** showing editable sessions:

- Start with 2 sessions by default.
- Show an "Add Session" button to add a 3rd session (maximum 3 total).
- Each session panel has:
  - A header: "Session 1", "Session 2", "Session 3"
  - An editable textarea showing the jersey numbers for that session (one per line or comma-separated), using the existing `parseJerseyNumbers()` function for parsing
  - A player count below the textarea: "N players"
- The scraper's `blocks` array is used to pre-populate the session textareas:
  - If `blocks` has 2+ entries with at least 12 jersey numbers each, assign the first block to Session 1, the second to Session 2, etc.
  - If `blocks` has only 1 entry (or entries with <12 numbers that are likely noise), put all numbers in Session 1 and leave Session 2 empty for the admin to fill manually.
- The admin can freely cut/paste jersey numbers between session textareas to correct any mis-splits.
- A "Total" line below the sessions shows the combined unique player count.
- The rest of the draft card (Type, Team Level, Round, IP, Report Date, Session Info, Final Team, Est. Players) stays exactly the same.

**3. Draft preview — single-session mode (toggle OFF):**

No changes at all. Identical to today's behavior: single collapsible jersey list.

**4. Confirm flow — multi-session mode:**

When confirming a draft with multi-session on, pass the session data (parsed from each textarea) to `saveDraftRound` via the new `sessions` parameter. Each session gets:
- `session_number`: 1, 2, or 3
- `jersey_numbers`: parsed from that session's textarea
- `label`: "Session 1", "Session 2", etc.

**5. Published round cards — session indicator:**

In the published round card header, when the round has `sessions` with 2+ entries (each having non-empty `jersey_numbers`), show a small badge: "2 sessions" (or "3 sessions") next to the player count badge. This is informational only.

**6. Published round editing — session awareness:**

When editing a published multi-session round, the existing flat jersey list edit applies to the round-level `jersey_numbers`. The sessions badge remains visible but individual session editing is not supported on published rounds (admin would delete and re-scrape with the toggle on to rebuild sessions).

### Styles

Add to `globals.css`:

- `.scrape-multi-session-toggle` — toggle switch row, positioned next to the Scrape New Round button. Follow the existing `.scrape-final-team-row` / `.scrape-final-team-label` checkbox pattern.
- `.scrape-session-panels` — flex container for the session panels (vertical stack on mobile)
- `.scrape-session-panel` — individual session panel (header + textarea + count)
- `.scrape-session-panel-header` — "Session 1" / "Session 2" label
- `.scrape-session-textarea` — editable textarea for jersey numbers (reuse `.scrape-manual-textarea` sizing and styles)
- `.scrape-session-count` — player count below each textarea
- `.scrape-session-total` — combined total line below all panels
- `.scrape-add-session-btn` — "Add Session" button (subtle, secondary style)
- `.admin-round-sessions-badge` — small badge on published round cards showing session count

Follow existing patterns from `.scrape-summary-row`, `.scrape-manual-textarea`, and `.admin-round-card-count`.

## Key Implementation Details

### The toggle is the only control path

The multi-session toggle is the single entry point for all session-related behavior. When the toggle is off:
- The scraper works exactly as today (single flat jersey list)
- `saveDraftRound` creates no session data
- The draft preview shows the existing collapsible jersey list
- No session badges appear anywhere

When the toggle is on:
- The scraper still works the same way (it always returns `blocks` now), but the UI interprets the blocks as session candidates
- The draft preview shows the split panel with editable textareas
- `saveDraftRound` receives session data and persists it

### Block detection uses existing extraction, just made global

The only change to the scraper's extraction logic is making Method 2 find ALL matching blocks instead of just the first. No new detection heuristics, no session header parsing required by the scraper. The scraper simply returns all blocks of numbers it finds. The admin UI decides how to distribute them across sessions.

If a block's `<div>` contains a `<strong>` or `<b>` tag before the numbers, capture its text as the block's `label` (e.g., "Split 1 6:00pm"). This label is shown in the admin UI as a hint but the admin has full control to redistribute numbers.

### Minimum block threshold: 12 numbers

When populating session textareas from blocks, only treat a block as a real session candidate if it has at least 12 jersey numbers. Blocks with fewer numbers are likely headers, footers, or noise (e.g., a phone number in the page footer). Combine small blocks into the first session or ignore them.

### Session data flows to the existing parent UI unchanged

The `sessions` JSONB format written by `saveDraftRound` matches what `round-section.tsx` already expects: `{ session_number, date, start_time, end_time, jersey_numbers }`. The parent UI will render collapsible session sections automatically. No parent-facing code changes needed.

### Manual jersey edit coexistence

The existing "Edit manually" link continues to work. When multi-session is on, clicking "Edit manually" opens the modal with ALL jersey numbers (union of all sessions). After applying, the numbers are redistributed across the session textareas — Session 1 keeps its existing numbers that still appear in the edited list, Session 2 keeps its existing numbers, and any new numbers go to Session 1. Removed numbers are removed from whichever session had them.

### The `everyone_continues` page type

When multi-session is on and the page is `everyone_continues`, the copied jersey numbers from the previous round should all go into Session 1. The admin can then redistribute into Session 2 manually. No attempt to preserve the previous round's session structure — that would be fragile and the admin has full control.

## Acceptance Criteria

- [ ] A "Multi-Session" toggle appears next to the "Scrape New Round" button (default off)
- [ ] With toggle OFF, scraping works exactly as before (no regressions)
- [ ] With toggle ON, scraping the NGHA U15 page shows a split panel with two session textareas pre-populated from the two blocks found on the page
- [ ] Session 1 textarea shows ~35 jersey numbers, Session 2 shows ~30
- [ ] The admin can cut/paste numbers between session textareas
- [ ] An "Add Session" button adds a 3rd empty session panel (max 3)
- [ ] Confirming saves sessions to the `sessions` JSONB column with `session_number` and `jersey_numbers` populated
- [ ] The parent-facing Sessions page renders the round with collapsible per-session sections
- [ ] Published round cards show a "2 sessions" badge when the round has session data
- [ ] Method 2 (BR-separated) now captures ALL number blocks, not just the first
- [ ] Blocks with fewer than 12 numbers are not treated as separate sessions
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Testing Association:**
All write tests MUST use the **Test / Sandbox association** (`a2000000-0000-0000-0000-000000000002`). NEVER run write operations against NGHA or any live association during testing. Read-only tests (navigate, snapshot, verify UI) may use a live association.

**Setup:**
- Login as admin (`testadmin@test.com` / `TestAdmin1234`)
- Switch to Test / Sandbox association
- Navigate to the admin continuations page for U15 division
- Ensure a continuations URL is configured (use the NGHA U15 URL: `https://www.gowildcats.ca/content/u15-continuations`)

### Test 1: Toggle OFF — scrape works as before (regression)

1. Navigate to `/admin/continuations` for U15 in the Test/Sandbox association
2. Verify the "Multi-Session" toggle exists and is OFF by default
3. Click "Scrape New Round" (toggle stays off)
4. Wait for scrape to complete
5. Take a screenshot of the draft preview
6. **Verify:** The draft card shows the standard single collapsible jersey list (no session panels)
7. **Verify:** Player count shows a number (the first block only, as today — this is the known limitation that multi-session fixes)
8. Discard the draft

### Test 2: Toggle ON — scrape shows split session panels

1. Turn on the "Multi-Session" toggle
2. Click "Scrape New Round"
3. Wait for scrape to complete
4. Take a screenshot of the draft preview
5. **Verify:** Two session panels appear: "Session 1" and "Session 2"
6. **Verify:** Session 1 textarea has ~35 jersey numbers (from Split 1 on the page)
7. **Verify:** Session 2 textarea has ~30 jersey numbers (from Split 2 on the page)
8. **Verify:** A total line shows ~65 players

### Test 3: Edit session textareas

1. From the draft in Test 2, copy a jersey number from Session 1's textarea
2. Delete it from Session 1's textarea
3. Paste it into Session 2's textarea
4. **Verify:** Session 1 count decreases by 1, Session 2 count increases by 1
5. **Verify:** Total stays the same

### Test 4: Add a 3rd session

1. From the draft in Test 3, click "Add Session"
2. **Verify:** A third session panel appears: "Session 3" with an empty textarea
3. Move a few jersey numbers from Session 2 into Session 3
4. **Verify:** Session 3 count reflects the moved numbers
5. **Verify:** Total remains unchanged

### Test 5: Confirm multi-session draft and verify persistence

1. From the draft in Test 4, click "Confirm"
2. Wait for the round to appear in the published rounds list
3. Take a screenshot of the published round card
4. **Verify:** The published round card shows a "3 sessions" badge next to the player count
5. **Verify:** The round card shows session info text

### Test 6: Parent-facing session rendering

1. Navigate to the Sessions page (`/continuations`) as a parent user
2. Switch to the Test/Sandbox association
3. Find the round just published
4. Take a screenshot
5. **Verify:** The round shows three collapsible session sections: "Session 1", "Session 2", "Session 3"
6. **Verify:** Each session section shows its own player list with the correct count
7. **Verify:** Clicking a session header collapses/expands that session's player list

### Test 7: Empty round has no session artifacts

1. Navigate back to admin, toggle OFF multi-session
2. Click "Create Empty Round"
3. Fill in team level and round number
4. Confirm
5. **Verify:** The published round card has no sessions badge
6. Delete the empty round

### Test 8: Single-block page with toggle ON

1. Turn on multi-session toggle
2. Configure a continuations URL that has a single flat list of jersey numbers (no splits) — or if unavailable, use the NGHA U15 URL and this test verifies the fallback behavior
3. If the page only has one block of 12+ numbers: **Verify** all numbers go into Session 1 and Session 2 is empty
4. If the page has two blocks: **Verify** they are split correctly (same as Test 2)
5. Discard the draft

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 5 | Published a multi-session round in Test/Sandbox | Delete the round via admin UI |
| Test 7 | Created and deleted an empty round | Already deleted in test |

**After all tests pass, delete the multi-session round from Test 5 and confirm with the user that all test data is clean.**

## Files to Touch

1. `frontend/app/(app)/continuations/scraper-actions.ts` — Add `blocks` to `ScrapeResult`, modify `extractJerseyNumbers()` Method 2 to be global and return blocks with labels, add `sessions` parameter to `saveDraftRound()`
2. `frontend/components/admin/admin-continuations-client.tsx` — Multi-session toggle state, session panels UI (textareas, add session, counts), session data passed to confirm flow, session badge on published cards
3. `frontend/app/(app)/admin/continuations/actions.ts` — Add `sessions` to `updateRound()` accepted fields
4. `frontend/app/globals.css` — New styles for multi-session toggle, session panels, textareas, badges

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
