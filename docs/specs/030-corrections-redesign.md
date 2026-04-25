# Spec 030: Corrections Redesign — Collapsible Cards, Parent View, Stale Data Warnings

**PRD Reference:** FR-025–027
**Priority:** Should Have
**Depends on:** 006 (Player management — parent)

## What This Feature Does

Redesigns the corrections experience for both admins and parents. Admins see collapsible cards grouped by player with clear old→new diffs, a stale-data warning when the player's current value no longer matches the correction's `old_value`, and a pending/resolved toggle. Parents get a "My Corrections" section on the settings page showing the status of their submitted corrections. The admin Edit button opens the player detail modal with suggested changes clearly labeled.

## Current State

### Database
- `corrections` table stores per-field correction records with `field_name`, `old_value`, `new_value`, `status`, `created_at`, `reviewed_by`, `reviewed_at`
- Auto-apply trigger (`apply_approved_correction`) updates `tryout_players` when a correction is approved
- RLS: parents see own corrections, admins see all for their association

### Server Actions
- `frontend/app/(app)/corrections/actions.ts`:
  - `submitCorrection()` — parent submits
  - `getPendingCorrections()` — fetches pending with player join (jersey, name, division, position) + submitter emails
  - `getPendingCorrectionsCount()` — badge count
  - `reviewCorrection()` — admin approve/reject with field-specific validation
  - `suggestPlayer()` / `reviewSuggestedPlayer()` — add-player flow

### Pages & Components
- `frontend/app/(app)/settings/corrections/page.tsx` — admin corrections page, fetches pending only
- `frontend/components/settings/corrections-list.tsx` — flat list of correction rows + `AddPlayerReview` sub-component
- `frontend/app/(app)/settings/page.tsx` + `settings-page-client.tsx` — settings page with corrections card (admin only, shows badge count)
- `frontend/components/teams/long-press-menu.tsx` — player detail sheet where parents submit corrections

### CSS
- `frontend/app/globals.css` — `.corrections-*` classes (lines ~3261–3370, 3806–3850)

## Changes Required

### Database

No schema changes. The existing `corrections` table already has all needed fields (`status`, `reviewed_by`, `reviewed_at`, `created_at`).

### Server Actions / API Routes

**Modify `frontend/app/(app)/corrections/actions.ts`:**

1. **`getPendingCorrections(associationId)`** — rename to `getCorrections(associationId, status: "pending" | "resolved")`:
   - When `status === "pending"`: current behavior (fetch pending corrections)
   - When `status === "resolved"`: fetch corrections where `status IN ('approved', 'rejected')`
   - **Add `current_value` field**: For each correction, also fetch the current value of the corrected field from `tryout_players` (name, jersey_number, position, previous_team, or team name via join). Return it as `current_value` in `CorrectionRow`.
   - **Add `reviewed_by_email`**: For resolved corrections, batch-fetch reviewer emails the same way submitter emails are fetched.
   - Order pending by `created_at DESC`, resolved by `reviewed_at DESC`
   - Limit resolved to 50 most recent (avoid loading years of history)

2. **`getMyCorrections(associationId)`** — new function for parent view:
   - Fetch all corrections where `user_id = auth.uid()` for the given association
   - Join to `tryout_players` for player name/jersey/division
   - Return with `status`, `created_at`, `reviewed_at`
   - Order by `created_at DESC`
   - Limit to 50 most recent

3. **`getMyCorrectionsCount(associationId)`** — new function:
   - Returns count of pending corrections for the current user in the association
   - Used for badge on parent settings card

### Pages

**Modify `frontend/app/(app)/settings/corrections/page.tsx`:**
- Fetch both pending and resolved corrections (two calls or one with both)
- Pass both lists to the redesigned client component
- Keep `requireAdmin()` guard

**Modify `frontend/app/(app)/settings/page.tsx`:**
- For non-admin users (parents): also call `getMyCorrectionsCount()` and pass to client
- For admins: keep existing `getPendingCorrectionsCount()` call

**Create `frontend/app/(app)/settings/my-corrections/page.tsx`:**
- New parent-accessible page at `/settings/my-corrections`
- Uses `requireAssociation()` (not `requireAdmin()` — any member can view)
- Fetches `getMyCorrections(associationId)`
- Renders `MyCorrectionslist` component

### Components

**Redesign `frontend/components/settings/corrections-list.tsx`:**

Replace the flat list with collapsible cards grouped by player.

**Props:**
```
type CorrectionsListProps = {
  pendingCorrections: CorrectionRow[]
  resolvedCorrections: CorrectionRow[]
}
```

**Layout — top level:**
- Toggle at the top: two tab-style buttons — "Pending (N)" and "Resolved (N)"
- Default to Pending tab
- Below the toggle, render grouped cards for the active tab

**Grouping:**
- Group corrections by `player_id`
- Each group becomes one collapsible card
- Within a card, corrections are ordered by `created_at` (newest first)

**Collapsed card (pending):**
- Left: player name + jersey number (e.g., "#42 Smith")
- Right: submitter email (truncated before @) + submission date/time (most recent correction's `created_at`, formatted as "Apr 23, 4:15 PM")
- If multiple corrections in the group, show a small count badge (e.g., "2 changes")
- Chevron icon to indicate expandable

**Expanded card (pending):**
- Each correction field shown as a row:
  - Left side: field label (uppercase, e.g., "NAME") + old value
  - Right side: arrow → new value in green
  - If `old_value !== current_value` (stale data): show a warning icon + "Current value: [current_value]" in amber/orange below the row. This tells the admin the player's data has changed since the correction was submitted.
- Submitter email (full) + exact date/time for each correction
- Three action buttons at bottom: **Approve** (green) | **Edit** (gold) | **Reject** (red)
  - Approve: approves ALL corrections in the card for that player at once
  - Edit: opens the player detail sheet (`long-press-menu.tsx`) in admin mode, pre-populated with the suggested new values. Suggested values should be visually distinguished (e.g., gold border or label saying "Suggested" next to pre-filled fields). Admin can modify before saving.
  - Reject: rejects ALL corrections in the card for that player at once
- For `add_player` corrections: keep the existing `AddPlayerReview` behavior but wrap it in the same collapsible card style

**Collapsed card (resolved):**
- Left: player name + jersey
- Right: status badge — "Approved" (green) or "Rejected" (red) + date
- Click to expand

**Expanded card (resolved):**
- Same field-level diff view as pending (old → new)
- Reviewed by: reviewer email + review date/time
- Submitted by: submitter email + submission date/time
- No action buttons (read-only)

**Create `frontend/components/settings/my-corrections-list.tsx`:**

Parent view of their own corrections.

**Props:**
```
type MyCorrectionsListProps = {
  corrections: MyCorrectionsRow[]
}
```

**Layout:**
- Simple list of collapsible cards (no toggle — shows all statuses)
- Each card grouped by player (same as admin)

**Collapsed card:**
- Player name + jersey
- Status badge: "Pending" (gold), "Approved" (green), "Rejected" (red)
- Submission date/time

**Expanded card:**
- Field-level diff (old → new) for each correction
- Status + date
- No action buttons (parent can only view)

**Empty state:** "You haven't submitted any corrections yet."

**Modify `frontend/app/(app)/settings/settings-page-client.tsx`:**
- For parents (non-admin): add a "My Corrections" card linking to `/settings/my-corrections`
  - Show pending count badge if > 0 (same style as admin badge)
  - Use `FileCheck` icon to match admin corrections card

### Styles

**Add to `frontend/app/globals.css`:**

New classes needed (all following existing `.corrections-*` naming):

- `.corrections-toggle` — tab-style toggle container at top of corrections page
- `.corrections-toggle-btn` — individual tab button
- `.corrections-toggle-btn--active` — active tab state
- `.corrections-card` — collapsible card container (replaces `.corrections-row`)
- `.corrections-card-header` — collapsed view (clickable)
- `.corrections-card-body` — expanded content (animated reveal)
- `.corrections-card--expanded` — expanded state modifier
- `.corrections-change-count` — small badge for "N changes"
- `.corrections-diff-row` — single field change row in expanded view
- `.corrections-diff-old` — old value (left side)
- `.corrections-diff-arrow` — arrow separator
- `.corrections-diff-new` — new value (right side, green)
- `.corrections-stale-warning` — amber warning row for stale data
- `.corrections-status-badge` — approved/rejected/pending badge
- `.corrections-status-badge--approved` — green variant
- `.corrections-status-badge--rejected` — red variant
- `.corrections-status-badge--pending` — gold variant
- `.corrections-reviewer` — "Reviewed by" line in resolved cards
- `.corrections-edit` — Edit button (gold, same as existing `.corrections-review-btn`)
- `.my-corrections-card` — parent view card (simpler variant)

**Animation:** Use `max-height` transition or `grid-template-rows: 0fr → 1fr` for smooth expand/collapse. Follow the pattern used elsewhere in the app for collapsible sections.

## Key Implementation Details

1. **Grouping corrections by player**: In the client component, group the `CorrectionRow[]` array by `player_id` using a `Map` or `reduce`. Each group becomes one card. Sort groups by the most recent `created_at` within the group (newest group first).

2. **Stale data detection**: The `current_value` field returned from the server action is compared against `old_value` in the component. If they differ, render the `.corrections-stale-warning` row. This is purely informational — admins can still approve or reject.

3. **Getting `current_value`**: In `getCorrections()`, after fetching corrections with the player join, map each correction's `field_name` to the corresponding current player field:
   - `name` → `player.name`
   - `jersey_number` → `player.jersey_number`
   - `position` → `player.position`
   - `previous_team` → `player.previous_team`
   - `team` → requires joining `teams` table to get team name from `player.team_id`

4. **Bulk approve/reject**: When the admin clicks Approve or Reject on a grouped card, call `reviewCorrection()` for each correction in the group sequentially. Show a loading state on the card. If any individual review fails, stop and show the error on that specific field row.

5. **Edit button flow**: Clicking Edit opens the existing `long-press-menu.tsx` (player detail sheet) in admin mode. Before opening:
   - Fetch the full player record
   - Pre-populate the editable fields with the `new_value` from each correction in the group
   - Pass a prop to indicate these are suggested values (so the component can show a visual indicator like a "Suggested" label or gold border on pre-filled fields)
   - When the admin saves in the detail sheet, the player is updated directly (admin mode). Then auto-reject or auto-approve the corrections in the group (since the admin has manually handled the values). Recommend auto-approving them to keep the audit trail clean.

6. **Parent settings card**: Only show the "My Corrections" card if the user is NOT an admin (admins use the admin corrections page). Check the user's role from `requireAssociation()` return value.

7. **Resolved corrections limit**: Cap at 50 to avoid loading large datasets. If there are more, show a "Showing 50 most recent" note at the bottom of the resolved tab.

8. **`add_player` corrections in grouped cards**: An `add_player` correction will always be the only correction for that `player_id` (since the player didn't exist before). Render it with the existing `AddPlayerReview` UI but wrapped in the collapsible card style.

## Acceptance Criteria

- [ ] Admin corrections page has Pending/Resolved toggle
- [ ] Pending corrections are grouped by player into collapsible cards
- [ ] Collapsed card shows player name/jersey, submitter, date/time, change count
- [ ] Expanded card shows field-level diffs (old → new in green)
- [ ] Stale data warning appears when `old_value` does not match current player value
- [ ] Approve button approves all corrections in the card
- [ ] Edit button opens player detail sheet with suggested values pre-populated and labeled
- [ ] Reject button rejects all corrections in the card
- [ ] Resolved tab shows approved/rejected corrections in collapsible cards with reviewer info
- [ ] Parents see "My Corrections" card on settings page with pending count badge
- [ ] Parent "My Corrections" page shows all their corrections with status badges
- [ ] Date/time displayed on all corrections for ordering clarity
- [ ] `add_player` corrections render correctly in the card layout
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Screenshot Directory:**
All screenshots taken during testing MUST be saved to `docs/specs/temp-testing-screenshots/`. Never save screenshots to the repo root or any other location.

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow all live data safety rules from the spec template.

**Setup:**
- Admin account: `testadmin@test.com` / `TestAdmin1234`
- Parent account: `testparent@test.com` / `testpass123`
- Association: Nepean Wildcats (`a1000000-0000-0000-0000-000000000001`)
- Start dev server: `cd frontend && npm run dev`

### Test 1: Admin — Pending toggle is default
1. Log in as admin (`testadmin@test.com`)
2. Navigate to `/settings/corrections`
3. **Verify:** Pending tab is active by default. Page title and toggle are visible.

### Test 2: Admin — Collapsible card structure (pending)
1. On the corrections page (pending tab)
2. If there are pending corrections, verify card layout
3. **Verify:** Each card shows player name/jersey, submitter (truncated), date/time, and change count if > 1. Cards are collapsed by default.

### Test 3: Admin — Expand a pending card
1. Click on a collapsed pending correction card
2. **Verify:** Card expands to show field-level diffs. Each field shows label, old value on left, arrow, new value in green on right. Approve/Edit/Reject buttons visible at bottom. Submitter email (full) and exact date/time shown.

### Test 4: Admin — Collapse an expanded card
1. Click on an expanded card's header
2. **Verify:** Card collapses back to summary view.

### Test 5: Admin — Stale data warning
1. If a correction exists where the player's current value differs from `old_value`, expand that card
2. **Verify:** Warning appears below the affected field row in amber, showing "Current value: [value]". Warning icon is visible.
3. If no naturally stale corrections exist, skip this test (do NOT modify real data to create one).

### Test 6: Admin — Switch to Resolved tab
1. Click the "Resolved" toggle button
2. **Verify:** Tab switches, resolved corrections display. Each card shows status badge (Approved in green or Rejected in red) + review date.

### Test 7: Admin — Expand a resolved card
1. Click on a resolved correction card
2. **Verify:** Shows field-level diffs (read-only), reviewer email, review date/time, submitter email, submission date/time. No action buttons.

### Test 8: Admin — Empty state
1. If either tab has no corrections, verify empty state
2. **Verify:** Appropriate message displayed ("No pending corrections" or "No resolved corrections").

### Test 9: Admin — Approve a correction
1. Switch to Pending tab, expand a card
2. Click Approve
3. **Verify:** Card is removed from pending list. Loading state shows during processing. Correction count badge updates.
4. Switch to Resolved tab and verify the correction now appears there as "Approved".

### Test 10: Admin — Reject a correction
1. Expand a pending card, click Reject
2. **Verify:** Card is removed from pending list. Appears in Resolved tab as "Rejected".

### Test 11: Admin — Edit button opens player detail
1. Expand a pending card, click Edit
2. **Verify:** Player detail sheet opens in admin mode. Editable fields are pre-populated with the suggested new values. Suggested values are visually distinguished (label or border).

### Test 12: Parent — My Corrections card on settings
1. Log out, log in as parent (`testparent@test.com`)
2. Navigate to `/settings`
3. **Verify:** "My Corrections" card is visible. If there are pending corrections, a count badge is shown.

### Test 13: Parent — My Corrections page
1. Click the "My Corrections" card
2. Navigate to `/settings/my-corrections`
3. **Verify:** Page loads with correction cards. Each shows player name/jersey, status badge (Pending/Approved/Rejected), submission date/time.

### Test 14: Parent — Expand a correction card
1. Click a correction card on the My Corrections page
2. **Verify:** Expands to show field-level diffs (old → new). No action buttons. Status and date visible.

### Test 15: Parent — Empty state
1. If the parent has no corrections, verify empty state
2. **Verify:** "You haven't submitted any corrections yet." message displayed.

### Test 16: Parent — Submit a correction and see it appear
1. Navigate to Teams page, open a player detail sheet
2. Edit the player's name (e.g., add "Test" prefix)
3. Save, submit the correction when prompted
4. Navigate to `/settings/my-corrections`
5. **Verify:** The just-submitted correction appears at the top with "Pending" status and current date/time.
6. **Revert:** Open the same player's detail sheet, restore the original name, skip the correction popup.

### Test 17: Mobile viewport
1. Resize browser to 393px width
2. Navigate to `/settings/corrections` (admin) or `/settings/my-corrections` (parent)
3. **Verify:** Cards fit within the phone frame. No horizontal overflow. Toggle buttons are full-width.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 9 | Approved a pending correction | Cannot revert approval — only run if a test correction exists or submit one first and note the player/field |
| Test 10 | Rejected a pending correction | Cannot revert rejection — same caveat as Test 9 |
| Test 16 | Submitted a test correction + modified custom name | Restore original name in detail sheet, skip correction popup. The submitted correction will remain in DB as pending — admin can reject it in Test 10. |

**After all tests pass, revert every mutation above and confirm with the user that the data is clean.**

## Files to Touch

1. `frontend/app/(app)/corrections/actions.ts` — modify `getPendingCorrections` → `getCorrections`, add `getMyCorrections`, `getMyCorrectionsCount`, add `current_value` to return type
2. `frontend/app/(app)/settings/corrections/page.tsx` — fetch pending + resolved, pass both to client
3. `frontend/components/settings/corrections-list.tsx` — full redesign: collapsible cards, grouping, toggle, stale warning, bulk actions
4. `frontend/app/(app)/settings/page.tsx` — add `getMyCorrectionsCount` for parents
5. `frontend/app/(app)/settings/settings-page-client.tsx` — add "My Corrections" card for parents
6. `frontend/app/(app)/settings/my-corrections/page.tsx` — **CREATE** parent corrections page
7. `frontend/components/settings/my-corrections-list.tsx` — **CREATE** parent corrections list component
8. `frontend/app/globals.css` — new `.corrections-*` card/toggle/diff/warning classes

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
