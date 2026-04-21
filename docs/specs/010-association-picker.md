# Spec 010: Association Picker in Division Picker Modal

**PRD Reference:** FR-039
**Priority:** Must Have
**Depends on:** 004 (Division switcher)

## What This Feature Does

The division switcher bottom sheet always shows an "Association" section at the top, listing every joinable association in the system. Users can tap any association to switch to it — the app silently auto-joins if they're not already a member, resets the active division to that association's default, and reloads the page with the new association's data. This lets parents browse any association's tryout data without a separate join flow.

## Current State

### Division switcher component
- `frontend/components/layout/division-switcher.tsx` — Bottom sheet with division options. Lines 72 and 93 gate the association section behind `associations.length > 1`, so it never renders when only one association has `join_enabled = true`.

### Association server actions
- `frontend/app/(app)/association/actions.ts` — Two actions:
  - `getAllAssociations()` — returns all associations where `join_enabled = true`, ordered by name
  - `setActiveAssociation(associationId)` — auto-joins via `user_associations` insert if needed, clears active tracked groups, sets default division for the new association

### Auth helper
- `frontend/lib/auth.ts` — `requireAssociation()` reads the active association from `user_tracked_groups` (where `is_active = true`), falls back to first membership. Auto-joins the first available association if user has no memberships at all (lines 34-63).

### Database
- `associations` table — has `join_enabled` boolean (default `true`). RLS allows SELECT for any authenticated user on rows where `join_enabled = true`.
- `user_associations` table — membership records with `role` (`app_role` enum: `admin`, `group_admin`, `member`). RLS allows self-insert (`user_id = auth.uid()`).
- `user_tracked_groups` table — stores the user's active division per association. INSERT policy requires `user_belongs_to_association(association_id)`.
- Ottawa Ice association (`9ba699fa-0b0c-454b-9d2b-a5489378dd56`) was created manually in production. The existing migration `backend/supabase/migrations/20260421000001_ottawa_ice_u15_players.sql` only inserts players and teams — it does NOT create the association row.

### Every page that uses the division switcher
The `DivisionSwitcher` component is rendered by every `(app)` page. Each page's server component calls `getAllAssociations()` and passes the result as the `associations` prop. Pages that do this:
- `frontend/app/(app)/dashboard/page.tsx`
- `frontend/app/(app)/teams/page.tsx`
- `frontend/app/(app)/continuations/page.tsx`
- `frontend/app/(app)/my-players/page.tsx`
- `frontend/app/(app)/settings/page.tsx`

## Changes Required

### Database

**New migration: `backend/supabase/migrations/20260421000002_ensure_ottawa_ice_association.sql`**

Ensure the Ottawa Ice (OGHA) association exists with `join_enabled = true`. Use `INSERT ... ON CONFLICT DO NOTHING` so it's safe to run if the association already exists from manual creation. If the association already exists but `join_enabled` is false, update it to true.

Fields:
- `id`: `9ba699fa-0b0c-454b-9d2b-a5489378dd56`
- `name`: `Ottawa Ice`
- `abbreviation`: `OGHA`
- `join_code`: `OGHA2026`
- `join_enabled`: `true`

### Server Actions / API Routes

No changes needed — `getAllAssociations()` and `setActiveAssociation()` already work correctly.

### Pages

No page-level changes — every page already passes `associations` to `DivisionSwitcher`.

### Components

**Modified: `frontend/components/layout/division-switcher.tsx`**

1. Remove the `showAssociations` variable and the `associations.length > 1` gate (line 72).
2. Always render the "Select Association" section (lines 93-113).
3. When only 1 association exists, the section still renders with that single association shown as active (radio checked). This gives visual context about which association the user is in.

### Styles

No new CSS classes needed — the existing `.assoc-option-abbr`, `.division-option`, `.division-option-active`, `.division-option-radio`, `.division-option-radio-checked`, and `.division-sheet-divider` classes already style the association section.

## Key Implementation Details

1. **The only code change is in `division-switcher.tsx`.** Remove the conditional and always render the association section. Everything else (auto-join, division reset, data fetching) already works.

2. **The migration is a data fix**, not a schema change. It ensures both associations exist so the picker has something to show.

3. **Auto-join flow when switching:** `setActiveAssociation()` checks `user_associations` for an existing row; if missing, it inserts one with `role: "member"`. Then it clears active tracked groups, finds the division with the most players in the new association, and upserts a `user_tracked_groups` row. The page then refreshes with `router.refresh()`.

4. **RLS chain on switch:** The auto-join insert into `user_associations` must happen BEFORE the `user_tracked_groups` upsert, because the tracked groups INSERT policy requires `user_belongs_to_association()`. The current code in `setActiveAssociation()` already does this in the correct order.

5. **No changes to `requireAssociation()`** — it already handles users with active tracked groups pointing to different associations, and falls back correctly.

## Acceptance Criteria

- [ ] Division switcher bottom sheet always shows "Select Association" section, even with 1 association
- [ ] All joinable associations (where `join_enabled = true`) appear in the association section
- [ ] Active association has a checked radio indicator
- [ ] Tapping a different association switches context — page reloads with that association's divisions and data
- [ ] Division resets to the association's default (most players) after switching
- [ ] User is silently auto-joined (as `member` role) when switching to a new association
- [ ] Ottawa Ice association appears in the picker
- [ ] No existing functionality is broken — Teams, Continuations, Dashboard, My Players, Settings all work after switching
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. You MUST follow these rules:

1. **Prefer read-only tests.** Verify by navigating and taking snapshots — do not modify data unless the test absolutely requires it.
2. **When a test MUST write data**, log every mutation in the "Test Mutations Log" at the end of this section.
3. **Revert all test mutations after testing.** After all tests pass, undo every write operation listed in "Test Mutations Log".
4. **Confirm with the user.** Before finishing, present the list of any remaining data changes and ask the user to verify everything was restored.
5. **Never delete real player records or change real player statuses during testing.**
6. **After switching to another association during tests, ALWAYS switch back to the original association (Nepean Wildcats / NW) before ending the test session.** This restores the user's active context.

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, currently in Nepean Wildcats). Dev server running at `http://localhost:3000`. Active division should be U15 by default.

### Test 1: Association section always visible
1. Navigate to `http://localhost:3000/dashboard`
2. Tap the division badge (e.g., "NW-U15") to open the bottom sheet
3. Take a snapshot of the bottom sheet
4. **Verify:** A "Select Association" section appears ABOVE the "Select Division" section. At least one association is listed. Nepean Wildcats (NW) has a checked radio indicator.

### Test 2: Multiple associations listed
1. Open the division switcher bottom sheet
2. **Verify:** Both "Nepean Wildcats" (NW) and "Ottawa Ice" (OGHA) appear in the association section. NW is checked (active).

### Test 3: Switch to Ottawa Ice
1. Open the division switcher bottom sheet
2. Tap "Ottawa Ice" (OGHA)
3. Wait for the page to reload
4. **Verify:** The division badge in the header now shows "OGHA-U15" (or whatever the default division is for Ottawa Ice). The page shows data for Ottawa Ice, not Nepean Wildcats. **Log this switch in Test Mutations Log.**

### Test 4: Division updates after association switch
1. After switching to Ottawa Ice (from Test 3), tap the division badge to open the sheet
2. **Verify:** The "Select Association" section shows Ottawa Ice (OGHA) as checked. The "Select Division" section shows divisions available for Ottawa Ice (should include U15 at minimum).

### Test 5: Teams page works with new association
1. While on Ottawa Ice, navigate to `http://localhost:3000/teams`
2. Take a snapshot
3. **Verify:** The page loads without errors. Player data shown belongs to Ottawa Ice (different players than Nepean Wildcats). The header shows "OGHA-U15".

### Test 6: Continuations page works with new association
1. While on Ottawa Ice, navigate to `http://localhost:3000/continuations`
2. Take a snapshot
3. **Verify:** The page loads without errors. The header shows "OGHA-U15". Content reflects Ottawa Ice data (may be empty if no rounds have been published — that's fine, just verify no crash).

### Test 7: My Players page works with new association
1. While on Ottawa Ice, navigate to `http://localhost:3000/my-players`
2. Take a snapshot
3. **Verify:** The page loads without errors. It may show "No players" if the user hasn't hearted any Ottawa Ice players — that's expected. No crash.

### Test 8: Settings page works with new association
1. While on Ottawa Ice, navigate to `http://localhost:3000/settings`
2. Take a snapshot
3. **Verify:** The page loads without errors. Header shows "OGHA-U15".

### Test 9: Switch back to Nepean Wildcats
1. Open the division switcher bottom sheet
2. Tap "Nepean Wildcats" (NW)
3. Wait for the page to reload
4. **Verify:** The division badge shows "NW-U15". All pages (Teams, Continuations, Dashboard) return to showing Nepean Wildcats data. **Log this switch in Test Mutations Log.**

### Test 10: Verify original data is intact
1. After switching back to NW, navigate to `http://localhost:3000/teams`
2. Take a snapshot
3. **Verify:** The same player data from before the test (Nepean Wildcats U15 players) appears. No data was lost or corrupted by the association switching.

### Test 11: Admin user sees association picker
1. Log out and log in as `testadmin@test.com` / `TestAdmin1234` (group_admin role)
2. Navigate to `http://localhost:3000/dashboard`
3. Open the division switcher bottom sheet
4. **Verify:** The "Select Association" section appears with both associations listed.
5. **After test:** Switch back to Nepean Wildcats if a different association was selected.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| Test 3 | Switched testparent to Ottawa Ice (OGHA). Auto-joined user_associations if not already a member. Set user_tracked_groups active to OGHA. | Switch back to NW in Test 9 |
| Test 9 | Switched testparent back to Nepean Wildcats (NW). Set user_tracked_groups active to NW. | No revert needed — this IS the revert |
| Test 11 | May switch testadmin to different association | Switch back to NW before ending test |

**Note on auto-join side effect:** When testparent switches to Ottawa Ice, a `user_associations` row is created (role: `member`). This row persists after switching back. This is expected and harmless — it means the user is now a member of both associations. If this is not desired, the implementing agent should confirm with the user whether to delete the extra `user_associations` row via SQL after testing.

**After all tests pass, verify that both test accounts (testparent, testadmin) are back on Nepean Wildcats as their active association. Confirm with the user that all data is clean.**

## Files to Touch

1. `backend/supabase/migrations/20260421000002_ensure_ottawa_ice_association.sql` — **CREATE** (ensure Ottawa Ice association exists)
2. `frontend/components/layout/division-switcher.tsx` — **MODIFY** (remove `associations.length > 1` gate)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
