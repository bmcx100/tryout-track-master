# Spec 008: Bulk Heart by Previous Team

**PRD Reference:** FR-012 (filter/interaction enhancements)
**Priority:** Should Have
**Depends on:** None (builds on existing heart mechanism from Spec 006)

## What This Feature Does

In the Previous Teams view on the Teams page, each previous team header gets a heart icon. Tapping it hearts (favorites) every player in that team at once. Tapping again un-hearts them all. This replaces the need to heart players one by one when an entire previous team is relevant to you.

## Current State

### Heart mechanism
- **Database:** `player_annotations` table, `is_favorite` boolean column, scoped per user+player (`UNIQUE (user_id, player_id)`)
- **Server action:** `toggleFavorite(playerId)` in `frontend/app/(app)/annotations/actions.ts` — toggles a single player
- **State:** `annotations` state in `TeamsPageClient` (`frontend/components/teams/teams-page-client.tsx`, line 55), passed down as props
- **Optimistic updates:** `handleToggleFavorite` in `TeamsPageClient` (lines 95–104) updates local state immediately, fires server action in background
- **UI:** Heart icon on each `PlayerRow` (`frontend/components/teams/player-row.tsx`, lines 118–128), uses `.favorite-btn` / `.favorite-btn-active` classes
- **Color:** `oklch(0.65 0.20 25)` (cinnamon/warm orange)

### Previous Teams view
- **Component:** `frontend/components/teams/previous-teams-view.tsx`
- **Grouping:** `groupByPreviousTeam()` groups players by `player.previous_team` (e.g., "U15AA", "U13A")
- **Section component:** `PreviousTeamSection` (line 101) — collapsible section per team
- **Header:** `<button className="team-header">` containing team name ("Formerly U15AA"), player count, and chevron
- **Header layout:** Left side has team name, right side has count + chevron
- **Props flow:** `PreviousTeamsView` receives `annotations` and `onToggleFavorite` from `TeamsPageClient`, passes them to `PreviousTeamSection`, which passes them to each `PlayerRow`

### Annotations server action
- `getPlayerAnnotations(associationId)` in `frontend/app/(app)/annotations/actions.ts` (line 35) — fetches all annotations for the current user in an association, returns `Record<string, { isFavorite, notes, customName }>`

## Changes Required

### Database

No database changes needed. The existing `player_annotations` table and `is_favorite` column are sufficient. Bulk heart creates/updates one annotation row per player — same as individual hearts.

### Server Actions / API Routes

**New function in `frontend/app/(app)/annotations/actions.ts`:**

```
bulkToggleFavorite(playerIds: string[], setFavorite: boolean): Promise<{ error?: string }>
```

- Takes an array of player IDs and the target state (`true` to heart all, `false` to un-heart all)
- For each player: upserts `player_annotations` with `is_favorite = setFavorite`
- Uses a single Supabase upsert call with `onConflict: "user_id,player_id"` for efficiency
- Returns error string on failure, nothing on success

### Pages

No new pages needed. The feature is entirely within the existing Teams page (`frontend/app/(app)/teams/page.tsx`).

### Components

**Modify `frontend/components/teams/previous-teams-view.tsx`:**

1. `PreviousTeamSection` — add a heart button to the team header, between the team name and the player count
2. The heart button shows the aggregate state:
   - **Filled (active):** ALL players in this team are hearted
   - **Outline (inactive):** at least one player is NOT hearted
3. On click:
   - If not all hearted → heart all (set `is_favorite = true` for every player in the group)
   - If all hearted → un-heart all (set `is_favorite = false` for every player in the group)
4. Stop propagation so tapping the heart doesn't toggle the section expand/collapse

**Modify `frontend/components/teams/teams-page-client.tsx`:**

1. Add `handleBulkToggleFavorite(playerIds: string[], setFavorite: boolean)` callback
2. Optimistically update all player annotations in state
3. Call `bulkToggleFavorite` server action in background
4. Pass callback down to `PreviousTeamsView`

**Modify `frontend/components/teams/previous-teams-view.tsx` (PreviousTeamsView component):**

1. Accept new prop: `onBulkToggleFavorite?: (playerIds: string[], setFavorite: boolean) => void`
2. Pass it through to each `PreviousTeamSection`

### Styles

**Add to `frontend/app/globals.css`:**

- `.team-heart-btn` — heart button in team header, positioned between team name and count. Sized to match the header text (use `Heart` icon at 16px). Same color scheme as `.favorite-btn` / `.favorite-btn-active`.
- `.team-heart-btn-active` — filled state using the same `oklch(0.65 0.20 25)` color

## Key Implementation Details

1. **Aggregate state calculation:** For each `PreviousTeamSection`, compute `allHearted` by checking if every player in the group has `annotations?.[player.id]?.isFavorite === true`. This drives both the icon fill state and the toggle direction.

2. **Optimistic update pattern:** Follow the existing pattern in `handleToggleFavorite` — update `annotations` state immediately, fire server action in background. For bulk, loop over all player IDs and set each one.

3. **Upsert strategy:** The server action should build an array of `{ user_id, player_id, is_favorite: setFavorite }` objects and upsert them in a single Supabase call. The `UNIQUE (user_id, player_id)` constraint on `player_annotations` makes this safe.

4. **Don't touch notes/custom_name:** When upserting for bulk heart, only set `is_favorite`. Use the upsert's column specification to avoid overwriting existing `notes` or `custom_name` values. On conflict, update ONLY `is_favorite` and `updated_at`.

5. **Position filter interaction:** The heart button should reflect the state of ALL players in the team, regardless of any active position filter. The position filter is visual-only and shouldn't affect which players get hearted.

6. **Collapsed sections:** The heart button is on the header, so it works even when the section is collapsed. The user doesn't need to expand to bulk-heart.

7. **Click propagation:** The heart button must call `e.stopPropagation()` to prevent the header's expand/collapse toggle from firing.

## Acceptance Criteria

- [ ] Each previous team header in the Previous Teams view shows a heart icon
- [ ] Tapping the heart when not all players are hearted → hearts all players in that team
- [ ] Tapping the heart when all players are hearted → un-hearts all players in that team
- [ ] Heart icon is filled when all players are hearted, outlined when not
- [ ] Individual player hearts update correctly after a bulk toggle (UI stays in sync)
- [ ] Bulk heart does not overwrite existing notes or custom names on player annotations
- [ ] Heart button works even when the section is collapsed
- [ ] Tapping the heart does NOT expand/collapse the section
- [ ] Position filter does not affect which players are bulk-hearted
- [ ] Heart color matches existing individual heart color (`oklch(0.65 0.20 25)`)
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**Setup:** Navigate to `https://tryout-track-master.vercel.app/login`, log in as `testparent@test.com` / `testpass123`. Navigate to `/teams`. Switch to "Previous Teams" view.

### Test 1: Heart button visible on every previous team header
1. Take a snapshot of the Previous Teams view
2. **Verify:** Each previous team section header (e.g., "Formerly U15AA") has a heart icon visible between the team name and the player count

### Test 2: Bulk heart all players in a team
1. Find a previous team where not all players are hearted (heart icon is outlined)
2. Click the heart icon on that team header
3. Expand the section if collapsed
4. **Verify:** The team header heart is now filled (active state)
5. **Verify:** Every individual player row in that team now shows a filled heart

### Test 3: Bulk un-heart all players in a team
1. Find a team where the header heart is filled (all hearted from Test 2)
2. Click the heart icon on that team header
3. **Verify:** The team header heart is now outlined (inactive state)
4. **Verify:** Every individual player row in that team now shows an outlined heart

### Test 4: Heart does not toggle section expand/collapse
1. Note whether a section is expanded or collapsed
2. Click the heart icon on that section's header
3. **Verify:** The section's expanded/collapsed state did NOT change

### Test 5: Partial state — some players hearted individually
1. Un-heart all players in a team via the bulk button (ensure all outlined)
2. Heart one individual player in that team by clicking the player's heart
3. **Verify:** The team header heart is outlined (not all are hearted)
4. Click the team header heart
5. **Verify:** ALL players in the team are now hearted (including the one that was already hearted)
6. **Verify:** The team header heart is now filled

### Test 6: Persistence after page reload
1. Bulk-heart a team
2. Reload the page (`/teams`)
3. Navigate to Previous Teams view
4. **Verify:** The team that was bulk-hearted still shows all players hearted
5. **Verify:** The team header heart is still filled

### Test 7: Bulk heart on collapsed section
1. Collapse a section by clicking the header (not the heart)
2. Click the heart icon on the collapsed header
3. Expand the section
4. **Verify:** All players in the section are hearted

### Test 8: Notes and custom names preserved after bulk heart
1. Open a player detail sheet and add a note to a player
2. Close the sheet
3. Bulk-heart that player's team using the header heart
4. Open the same player's detail sheet again
5. **Verify:** The note is still present and unchanged

### Test 9: Position filter does not affect bulk heart
1. Set the position filter to "D" (defensemen only)
2. Bulk-heart a previous team via the header heart
3. Set the position filter back to "All"
4. Expand the team
5. **Verify:** ALL players (F, D, G) in that team are hearted, not just defensemen

## Files to Touch

1. `frontend/app/(app)/annotations/actions.ts` — add `bulkToggleFavorite` server action
2. `frontend/components/teams/teams-page-client.tsx` — add `handleBulkToggleFavorite` callback, pass to `PreviousTeamsView`
3. `frontend/components/teams/previous-teams-view.tsx` — add heart button to `PreviousTeamSection` header, accept `onBulkToggleFavorite` prop
4. `frontend/app/globals.css` — add `.team-heart-btn` and `.team-heart-btn-active` styles

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
