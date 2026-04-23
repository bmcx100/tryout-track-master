# Spec 018: Scraper Manual Fallback & Final Team Size Validation

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** 017 (Scraper Robustness & Final Team)

> **Note:** This spec extends the work done in spec 017. It adds two features to the existing scraper and final team flow.

## What This Feature Does

Two additions to the scraper and final team system:

**Part A — Scraper manual fallback:** When the scraper finds zero jersey numbers on a page (new HTML format, broken page, etc.), the admin sees a warning and a link to open a modal where they can paste jersey numbers manually. After pasting and confirming, the numbers appear in the normal scraper preview — same summary card and jersey list — and the admin can proceed with the standard confirm flow.

**Part B — Final team size validation:** When the "Final Team" checkbox is checked in the scraper preview, a team size indicator shows how many players are on the roster compared to the typical team size (16-17). If the count is outside 14-19 players, a warning appears. Clicking "Confirm" with an active warning requires an extra "Are you sure?" confirmation step before proceeding.

## Current State

### Infrastructure that already exists
- **Scraper page client:** `frontend/components/settings/scrape-page-client.tsx` — full scraper UI with scrape, preview, confirm, discard states
- **Scrape result type:** `ScrapeResult` in `frontend/app/(app)/continuations/scraper-actions.ts:6-15` — includes `jerseyNumbers: string[]`, `pageType`, `teamLevel`, etc.
- **Jersey number extraction:** `extractJerseyNumbers()` in `scraper-actions.ts:76-128` — 3 methods (table cells, br-separated blocks, p-tags)
- **Preview state:** When `result` is set and `!draftId`, shows summary card + jersey list (lines 194-337 of scrape-page-client.tsx)
- **Jersey list display:** `result.jerseyNumbers.length > 0` gates the vertical jersey list (lines 297-311)
- **Final Team checkbox:** Already in summary card (lines 282-294) with `isFinalTeam` state
- **`saveDraftRound()`:** Accepts `isFinalTeamOverride` parameter, saves to `continuation_rounds`
- **`confirmDraft()`:** Publishes round, calls `lockFinalTeam()` when `is_final_team` is true
- **Existing styles:** `.scrape-*` classes in `frontend/app/globals.css` (lines ~2429-2650)

### What's missing
1. No handling when scraper returns 0 jersey numbers — the preview shows "0 players" with an empty list, no way to manually enter numbers
2. No team size indicator or validation when "Final Team" is checked
3. No confirmation dialog for unusual team sizes

## Changes Required

### Database

No database changes needed.

### Server Actions / API Routes

No server action changes needed. The `saveDraftRound()` function already accepts arbitrary `jerseyNumbers` from the `ScrapeResult` object — manually entered numbers will flow through the same path.

### Pages

No new pages needed.

### Components

**1. Manual jersey entry modal**
File: `frontend/components/settings/scrape-page-client.tsx`

Add a new inline modal (no separate file needed — keep it in the same component since it's tightly coupled to scraper state). Implementation:

- New state: `const [showManualEntry, setShowManualEntry] = useState(false)` and `const [manualText, setManualText] = useState("")`
- When `result` exists and `result.jerseyNumbers.length === 0`, show a warning block instead of the empty jersey list:
  - Warning icon + "No players found on this page"
  - Link/button: "Enter jersey numbers manually" → sets `showManualEntry` to true
- The modal:
  - Overlay + centered card (reuse existing scrape card styling patterns)
  - Title: "Enter Jersey Numbers"
  - Instruction text: "Paste jersey numbers, one per line or comma-separated"
  - `<textarea>` with placeholder "e.g.\n12\n34\n56" (about 8 rows tall)
  - Two buttons: "Apply" (primary) and "Cancel"
  - "Apply" parses the text: split on newlines and commas, trim whitespace, filter to valid numbers (1-4 digits), deduplicate
  - On apply: update `result` state by creating a new `ScrapeResult` with the parsed jersey numbers (keep all other fields from the original result, set `pageType` to `"continuation"` if it was `"no_data"`)
  - Close modal, now the preview shows the manually entered numbers in the standard jersey list

**2. Warning display for 0 players**
File: `frontend/components/settings/scrape-page-client.tsx`

Replace the section between the summary card and the jersey list (lines ~296-311). When `result.jerseyNumbers.length === 0`:
- Show a warning block with an alert triangle icon (use `TriangleAlert` from lucide-react)
- Text: "No players found on this page"
- Below: a clickable link styled as a button: "Enter jersey numbers manually"
- This replaces the empty jersey list — the jersey list only renders when `jerseyNumbers.length > 0`

**3. Final team size indicator**
File: `frontend/components/settings/scrape-page-client.tsx`

When `isFinalTeam` is checked, add a size context line below the Final Team checkbox row in the summary card:
- Text: "{N} players (typical team: 16-17)"
- If `N < 14` or `N > 19`: style the text with warning color (amber/orange) and add a note: "Unusual team size"
- If `N` is 0: show "No players — enter jersey numbers first" in error color

**4. Confirm with warning — extra step**
File: `frontend/components/settings/scrape-page-client.tsx`

Modify `handleConfirm`:
- New state: `const [showSizeWarning, setShowSizeWarning] = useState(false)`
- When the user clicks "Confirm" and `isFinalTeam` is true and the player count is outside 14-19:
  - Instead of proceeding, show a confirmation dialog: "This final team has {N} players. Typical team size is 16-17. Are you sure?"
  - Two buttons: "Yes, confirm" (proceeds with normal confirm flow) and "Cancel" (dismisses dialog)
  - If player count is in the 14-19 range OR `isFinalTeam` is false, skip the dialog and confirm immediately
- Use the same overlay + card pattern as the manual entry modal

### Styles

File: `frontend/app/globals.css`

Add styles for:
- `.scrape-no-players-warning` — warning block when 0 players found (yellow/amber background, icon + text layout)
- `.scrape-manual-entry-link` — clickable link to open the manual entry modal
- `.scrape-modal-overlay` — semi-transparent backdrop (reuse pattern from other modals in the app)
- `.scrape-modal-card` — centered modal card
- `.scrape-modal-title` — modal heading
- `.scrape-modal-text` — instruction text
- `.scrape-manual-textarea` — textarea for pasting jersey numbers
- `.scrape-modal-actions` — button row in modal
- `.scrape-team-size-note` — team size indicator below Final Team checkbox
- `.scrape-team-size-warning` — warning variant of team size note (amber color)
- `.scrape-size-confirm-text` — text in the size warning confirmation dialog

## Key Implementation Details

### Parsing manual jersey numbers
The textarea accepts flexible input. Parse as follows:
1. Split input on newlines (`\n`) AND commas (`,`)
2. Trim whitespace from each token
3. Filter to tokens that match `/^\d{1,4}$/` (1-4 digit numbers only)
4. Deduplicate (keep first occurrence)
5. Result is `string[]` of jersey numbers

Example inputs that should all work:
- `12\n34\n56` (one per line)
- `12, 34, 56` (comma-separated)
- `12\n34, 56\n78` (mixed)
- `12\n\n34\n` (blank lines ignored)

### Updating result state with manual numbers
When the admin applies manual numbers, create a new `ScrapeResult` object:
```
{
  ...existingResult,
  jerseyNumbers: parsedNumbers,
  ipPlayers: [],  // no IP detection for manual entry
  pageType: existingResult.pageType === "no_data" ? "continuation" : existingResult.pageType,
}
```
Call `setResult(newResult)` — the preview will re-render with the new numbers in the standard jersey list.

### Team size validation thresholds
- **Normal range:** 14-19 players (inclusive) — no warning
- **Warning range:** <14 or >19 — show amber warning + require extra confirmation
- These thresholds are hardcoded constants (not configurable). Typical Ontario minor hockey teams are 16-17 players. The range of 14-19 accounts for small/large rosters without being so wide as to be useless.

### Manual entry is always available for Final Team
The "Enter jersey numbers manually" link should also appear as a secondary action when the scraper DID find numbers but the admin wants to override them. Add a small "Edit manually" link below the jersey list that opens the same modal, pre-populated with the current jersey numbers (one per line).

### No changes to server actions
All manual entry happens client-side by modifying the `ScrapeResult` state before it's passed to `saveDraftRound()`. The server action sees the same data structure regardless of whether numbers came from scraping or manual entry.

## Acceptance Criteria

- [ ] When scraper finds 0 players, a warning shows "No players found on this page"
- [ ] The warning includes a link to enter jersey numbers manually
- [ ] The manual entry modal accepts jersey numbers via textarea (newlines or commas)
- [ ] After applying manual numbers, the standard scraper preview shows them in the jersey list
- [ ] The confirm flow works normally with manually entered numbers
- [ ] An "Edit manually" link appears below the jersey list when numbers exist, allowing override
- [ ] When "Final Team" is checked, a team size indicator shows "{N} players (typical team: 16-17)"
- [ ] When player count is outside 14-19, the size indicator shows an amber warning
- [ ] Clicking "Confirm" with an active size warning shows a confirmation dialog
- [ ] The confirmation dialog can be dismissed (Cancel) or confirmed (Yes, confirm)
- [ ] Normal team sizes (14-19) skip the extra confirmation dialog
- [ ] Non-final-team rounds skip the size validation entirely
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow all safety rules — prefer read-only tests, log mutations, revert after testing.

**Setup:**
- Admin login: `testadmin@test.com` / `TestAdmin1234`
- Division: U15 (has active continuation data and a configured scrape URL)
- Navigate to `/settings/scrape`

### Test 1: Scraper finds players — standard flow still works
1. Login as admin
2. Navigate to `/settings/scrape`
3. Click "Scrape Now"
4. **Verify:** Preview shows jersey numbers in the list (count > 0)
5. **Verify:** No "No players found" warning appears
6. **Verify:** "Edit manually" link appears below the jersey list
7. Discard the preview

### Test 2: Manual entry modal opens and parses numbers
1. Scrape the page (or re-use Test 1 preview)
2. Click "Edit manually" below the jersey list
3. **Verify:** Modal opens with textarea pre-populated with current jersey numbers
4. Clear textarea and type: "10, 20, 30"
5. Click "Apply"
6. **Verify:** Modal closes
7. **Verify:** Preview now shows exactly 3 players: 10, 20, 30 in the jersey list
8. **Verify:** Summary card shows "3 players"
9. Discard the preview (do NOT confirm)

### Test 3: Manual entry with mixed formats
1. Click "Scrape Now"
2. If numbers found, click "Edit manually". If 0 found, click "Enter jersey numbers manually"
3. Clear textarea and type: "100\n200, 300\n\n400"
4. Click "Apply"
5. **Verify:** Preview shows 4 players: 100, 200, 300, 400
6. Discard the preview

### Test 4: Manual entry — invalid input filtered
1. Open manual entry modal (via Edit manually or Enter manually)
2. Type: "abc, 12, , 99999, 34, 12"
3. Click "Apply"
4. **Verify:** Only "12" and "34" appear (abc filtered, 99999 filtered as >4 digits, duplicate 12 removed)
5. **Verify:** Summary shows "2 players"
6. Discard the preview

### Test 5: Manual entry — empty input
1. Open manual entry modal
2. Leave textarea empty (or type only whitespace)
3. Click "Apply"
4. **Verify:** Preview shows 0 players and the "No players found" warning reappears
5. Discard the preview

### Test 6: Final team size indicator — normal range
1. Click "Scrape Now" (should find ~17 players for U15 AA)
2. Check the "Final Team" checkbox (if not already checked)
3. **Verify:** Below the checkbox, text shows "17 players (typical team: 16-17)" (or whatever count is found)
4. **Verify:** No amber warning color (count is within 14-19)
5. Discard the preview

### Test 7: Final team size indicator — unusual size warning
1. Click "Scrape Now"
2. Click "Edit manually"
3. Enter only 5 jersey numbers: "1, 2, 3, 4, 5"
4. Click "Apply"
5. Check "Final Team" checkbox
6. **Verify:** Size indicator shows "5 players (typical team: 16-17)" in amber/warning color
7. **Verify:** Text says "Unusual team size"
8. Discard the preview

### Test 8: Size warning confirmation dialog
1. Set up a state with Final Team checked and <14 players (use manual entry with 5 numbers)
2. Click "Confirm"
3. **Verify:** A confirmation dialog appears: "This final team has 5 players. Typical team size is 16-17. Are you sure?"
4. Click "Cancel"
5. **Verify:** Dialog dismisses, preview is still shown, no data saved
6. Discard the preview

### Test 9: Normal-size final team skips confirmation dialog
1. Click "Scrape Now" (should find ~17 players)
2. Check "Final Team"
3. **Verify:** Size indicator shows green/normal styling (count is 14-19)
4. Discard the preview (do NOT confirm — we don't want to lock a final team during testing)

### Test 10: Non-final-team rounds skip size validation
1. Click "Scrape Now"
2. Uncheck "Final Team" (if checked)
3. **Verify:** No team size indicator appears below the checkbox
4. Discard the preview

### Test 11: Build and lint
1. Run `cd frontend && npm run build`
2. **Verify:** Build passes
3. Run `cd frontend && npm run lint`
4. **Verify:** No lint errors

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none) | All tests discard previews — no data saved | N/A |

**Note:** All tests use the scraper preview and discard without confirming. No database mutations occur. Tests 2-5 modify client-side state only. No cleanup needed.

## Files to Touch

1. `frontend/components/settings/scrape-page-client.tsx` — manual entry modal, 0-player warning, team size indicator, confirmation dialog, "Edit manually" link
2. `frontend/app/globals.css` — styles for warning block, modal, team size indicator, confirmation dialog

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
