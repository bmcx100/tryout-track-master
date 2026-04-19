# Spec 003: Continuations Tracker

**PRD Reference:** Custom feature (not in original PRD)
**Priority:** Must Have
**Depends on:** None

## What This Feature Does

Parents view tryout round results for each team level — who is still continuing and who has been cut. An admin enters round data by pasting website postings into Claude Code, which parses jersey numbers and inserts them into the database. The system matches jersey numbers to known players and displays their name, position, previous team, favorite status, and notes. Parents can favorite players and add notes. When a final team is announced, those players are locked as official on the Predictions tab in Teams.

A new `/continuations` page replaces the "More" tab in the bottom navigation. A dashboard card links to it.

## Current State

### What exists today

- **131 U15 players** in `tryout_players` for the Nepean Wildcats association (`a1000000-0000-0000-0000-000000000001`)
- **20 teams** across AA/A/BB/B/C for U11/U13/U15/U18
- **Bottom nav** at `frontend/components/layout/bottom-nav.tsx` has 3 tabs: Home, Teams, More. The "More" tab routes to `/settings`.
- **Dashboard** at `frontend/app/(app)/dashboard/page.tsx` has one link card for Teams.
- **Prediction board** at `frontend/components/teams/prediction-board.tsx` already handles official rosters — players with `team_id` + status `made_team` are shown locked with a checkmark and collapsed by default.
- **Player row** at `frontend/components/teams/player-row.tsx` shows jersey, position, name, previous team.
- **Long-press menu** at `frontend/components/teams/long-press-menu.tsx` shows player info with actions (Add to Friends, View Details, Submit Correction).
- **No continuations/rounds data model** exists.
- **No favorites or notes system** exists.

### Key patterns to follow

- Server component pages fetch data, pass to client components (see `frontend/app/(app)/teams/page.tsx`)
- Server actions in colocated `actions.ts` files (see `frontend/app/(app)/teams/actions.ts`)
- CSS classes use `@apply` in `frontend/app/globals.css` — no inline Tailwind beyond a single class
- Color system uses OKLCH variables (`--dm-gold`, `--dm-umber`, `--dm-dust`, `--dm-dune`, `--dm-parchment`, `--dm-border`, etc.)
- Collapsible sections pattern in `frontend/components/teams/team-section.tsx`
- Dashboard card pattern: `.dashboard-link-card` in `frontend/app/globals.css`
- Bottom sheet modal pattern: `.long-press-overlay` + `.long-press-sheet` in `frontend/app/globals.css`

## Changes Required

### Database

Two new tables and one migration file.

**Migration file:** `backend/supabase/migrations/20260420000002_create_continuations.sql`

**Table 1: `continuation_rounds`** — stores each round of tryouts for a team level.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `association_id` | UUID FK → associations | Multi-tenant isolation |
| `division` | TEXT NOT NULL | e.g., "U15" |
| `team_level` | TEXT NOT NULL | e.g., "AA", "A", "BB", "B", "C" |
| `round_number` | INTEGER NOT NULL | 1, 2, 3... |
| `is_final_team` | BOOLEAN NOT NULL DEFAULT false | True when this round is the final roster announcement |
| `jersey_numbers` | TEXT[] NOT NULL | All jersey numbers across all sessions in this round |
| `ip_players` | TEXT[] NOT NULL DEFAULT '{}' | Jersey numbers flagged as Injured Player |
| `sessions` | JSONB NOT NULL DEFAULT '[]' | Array of session objects (see below) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**Unique constraint:** `(association_id, division, team_level, round_number)`

**Sessions JSONB structure:**
```json
[
  {
    "session_number": 1,
    "date": "2026-04-19",
    "start_time": "16:15",
    "end_time": "17:45",
    "jersey_numbers": ["50", "80", "121", "180", "..."]
  },
  {
    "session_number": 2,
    "date": "2026-04-19",
    "start_time": "17:45",
    "end_time": "19:15",
    "jersey_numbers": ["160", "162", "166", "..."]
  }
]
```

**RLS policies:**
- SELECT: `user_belongs_to_association(association_id)` — all association members can read
- INSERT/UPDATE/DELETE: `user_is_admin(association_id)` — only admins can write (Claude Code uses service role key, bypassing RLS)

**Table 2: `player_annotations`** — per-user favorites and notes on players.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → auth.users | The parent who made the annotation |
| `player_id` | UUID FK → tryout_players | The annotated player |
| `is_favorite` | BOOLEAN NOT NULL DEFAULT false | Whether this player is favorited |
| `notes` | TEXT | Free-text notes (nullable) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**Unique constraint:** `(user_id, player_id)`

**RLS policies:**
- ALL: `auth.uid() = user_id` — users can only read/write their own annotations

Add an `updated_at` trigger (same pattern as `player_predictions` migration).

### Server Actions / API Routes

**File:** `frontend/app/(app)/continuations/actions.ts`

1. **`getLatestRounds(associationId: string, division: string)`**
   - For each distinct `team_level` in the division, fetch the latest round (highest `round_number`)
   - Also fetch the previous round (for computing cuts)
   - Return array of `{ teamLevel, latestRound, previousRound | null }`
   - Sorted by team tier: AA first, then A, BB, B, C

2. **`getAllRoundsForTeam(associationId: string, division: string, teamLevel: string)`**
   - Fetch all rounds for a specific team level, ordered by `round_number` DESC
   - Used by the history modal

3. **`toggleFavorite(playerId: string)`**
   - Upsert into `player_annotations`: if no row exists, create with `is_favorite = true`. If exists, toggle `is_favorite`.
   - Return the new `is_favorite` value

4. **`savePlayerNote(playerId: string, note: string)`**
   - Upsert into `player_annotations`: set `notes` to the provided text (empty string clears)
   - Return success

5. **`getPlayerAnnotations(associationId: string)`**
   - Fetch all annotations for the current user where the player belongs to the given association
   - Return as a map: `Record<string, { isFavorite: boolean, notes: string | null }>` keyed by player_id

6. **`lockFinalTeam(roundId: string)`**
   - Fetch the round (must have `is_final_team = true`)
   - Match jersey numbers to `tryout_players` by `association_id` + `division` + `jersey_number`
   - Find the team by `division` + `name` matching `team_level` (e.g., division "U15", name "AA")
   - Update matched players: set `team_id` to the team's id, set `status` to `made_team`
   - This makes them appear as official/locked on the Predictions tab

### Pages

**New page:** `frontend/app/(app)/continuations/page.tsx`

Server component that:
1. Calls `requireAssociation()` for auth
2. Fetches all players for the association and division (for jersey number → player lookup)
3. Fetches latest rounds via `getLatestRounds()`
4. Fetches player annotations via `getPlayerAnnotations()`
5. Passes data to `ContinuationsPageClient`

### Components

**1. `frontend/components/continuations/continuations-page-client.tsx`**

Main client component for the continuations page.

**Props:**
- `players: TryoutPlayer[]` — all players in the division (for jersey lookup)
- `rounds: { teamLevel: string, latestRound: ContinuationRound, previousRound: ContinuationRound | null }[]`
- `annotations: Record<string, { isFavorite: boolean, notes: string | null }>`
- `associationId: string`
- `division: string`

**Behavior:**
- Builds a jersey-number-to-player lookup map from the players array
- Renders a `RoundSection` for each team level that has rounds
- If no rounds exist yet, shows an empty state message: "No tryout results posted yet"
- Handles optimistic updates for favorite toggles

**2. `frontend/components/continuations/round-section.tsx`**

Displays the latest round for one team level with continuing and cut lists.

**Props:**
- `teamLevel: string` (e.g., "AA")
- `division: string` (e.g., "U15")
- `latestRound: ContinuationRound`
- `previousRound: ContinuationRound | null`
- `playerMap: Record<string, TryoutPlayer>` (jersey → player)
- `annotations: Record<string, { isFavorite: boolean, notes: string | null }>`
- `onToggleFavorite: (playerId: string) => void`
- `onOpenHistory: (teamLevel: string) => void`

**Layout:**
```
[U15 AA — Round 1]          ← tappable header, opens history modal
  2 sessions · Sun Apr 19

▾ Continuing (45)            ← collapsible, default expanded
  ♡ #50   F  John Smith      U13 AA
  ♡ #80   D  Jane Doe        U13 A    [IP]
  ...

▾ Cuts (0)                   ← collapsible, default expanded
  No cuts yet
```

**How cuts are computed:**
- If `previousRound` is null → no cuts (first round)
- Otherwise: cuts = jersey numbers in `previousRound.jersey_numbers` that are NOT in `latestRound.jersey_numbers`

**How continuing list is ordered:**
- Favorites first (sorted by jersey number within favorites)
- Then non-favorites sorted by jersey number

**Session info line:** Show session count and the date. Format dates as "Sun Apr 19". If sessions span multiple dates, show the range.

**IP badge:** Show a small "IP" badge next to players whose jersey number is in `latestRound.ip_players`.

**Unknown players:** If a jersey number has no match in `playerMap`, show the jersey number with "Unknown" as the name and no position/previous team. This handles players not yet in the database.

**3. `frontend/components/continuations/round-history-modal.tsx`**

Bottom-sheet modal showing all historical rounds for a team level.

**Props:**
- `teamLevel: string`
- `division: string`
- `associationId: string`
- `playerMap: Record<string, TryoutPlayer>`
- `isOpen: boolean`
- `onClose: () => void`

**Behavior:**
- When opened, fetches all rounds via `getAllRoundsForTeam()` server action
- Shows a list of rounds, most recent first
- Each round is expandable to show its sessions, continuing players, and cuts
- The current (latest) round is highlighted
- Final team rounds are labeled "Final Team" instead of "Round N"

**Layout:**
```
────────────────────────
  U15 AA History        ✕
────────────────────────

▾ Round 3 — Apr 25      ← expandable
  Session 1: 4:15–5:45pm
  Continuing: 25
  Cuts: 8

▸ Round 2 — Apr 22      ← collapsed
▸ Round 1 — Apr 19      ← collapsed
```

When expanded, shows the full jersey number lists with player names (same format as the main page).

Uses the same bottom-sheet pattern as the long-press menu (`.long-press-overlay` + `.long-press-sheet`) but taller — approximately 80% of viewport height.

**4. `frontend/components/continuations/continuation-player-row.tsx`**

Player row for the continuations view. Similar to the existing player row but with a favorite toggle instead of a drag handle, and an IP badge.

**Props:**
- `jerseyNumber: string`
- `player: TryoutPlayer | null` (null = unknown player)
- `isFavorite: boolean`
- `hasNotes: boolean`
- `isInjured: boolean` (IP flag)
- `isCut: boolean` (for visual distinction in the cuts list)
- `onToggleFavorite: () => void`

**Layout:**
```
[♡] [#50] [F] [John Smith] [U13 AA] [IP]
```

- **Favorite icon:** Heart outline (unfavorited) or filled heart (favorited). Tappable to toggle. Use lucide `Heart` icon.
- **Jersey:** Mono font, same style as `.player-jersey`
- **Position:** Badge, same style as `.player-position`. Omit if player is unknown.
- **Name:** Truncated, same style as `.player-name`. Show "Unknown" if no player match.
- **Previous team:** Mono font, same style as `.player-prev-team`. Omit if player is unknown.
- **IP badge:** Small badge with text "IP" in a muted gold/amber style. Only shown if `isInjured` is true.
- **Notes indicator:** Small dot or icon near the name if `hasNotes` is true. Subtle — just indicates notes exist.
- **Cut styling:** When `isCut` is true, reduce opacity to ~0.5 and add a strikethrough on the jersey number to visually distinguish cuts.

### Styles

Add these CSS classes to `frontend/app/globals.css`:

- `.continuations-header` — tappable round header ("U15 AA — Round 1") with gold text and a chevron or history icon indicating it's interactive
- `.continuations-session-info` — muted text line showing session count and date
- `.continuations-section-label` — "Continuing (45)" / "Cuts (7)" subsection headers, collapsible
- `.continuation-player-row` — similar to `.player-row` but with favorite heart replacing drag handle
- `.continuation-player-row-cut` — reduced opacity variant for cut players
- `.ip-badge` — small inline badge for injured players
- `.notes-indicator` — small dot indicator for players with notes
- `.favorite-btn` — heart icon button, filled state for favorited
- `.round-history-modal` — taller bottom sheet variant (~80vh)
- `.round-history-item` — expandable round item in the history modal
- `.round-history-item-active` — highlighted style for the current round

### Navigation Changes

**Bottom nav (`frontend/components/layout/bottom-nav.tsx`):**
- Replace the "More" tab with a "Results" tab
- Route: `/continuations`
- Icon: `ListChecks` from lucide-react (or `Activity` — implementer can choose whichever reads better at small size)

**Dashboard (`frontend/app/(app)/dashboard/page.tsx`):**
- Add a second dashboard link card below the Teams card
- Icon: Same as the bottom nav icon
- Title: "Tryout Results"
- Description: "See who's continuing and who's been cut from each&nbsp;team&nbsp;level"
- Links to `/continuations`

## Key Implementation Details

### Jersey number matching

Build a lookup map from the `tryout_players` query: `Record<string, TryoutPlayer>` keyed by `jersey_number`. Match is on `jersey_number` within the same `association_id` and `division`. If no match, the player is "Unknown" — display the jersey number but indicate the name is unknown.

### Cut computation

Cuts are computed client-side by diffing two arrays:
```
cuts = previousRound.jersey_numbers.filter(jn => !latestRound.jersey_numbers.includes(jn))
```

This is a simple array diff — no performance concern with <200 players.

### Final team locking

When `lockFinalTeam(roundId)` is called:
1. Fetch the round record
2. Match `jersey_numbers` to `tryout_players` rows by `association_id`, `division`, `jersey_number`
3. Look up the team by `association_id`, `division`, and `name = team_level` (e.g., name "AA" for team_level "AA")
4. Update each matched player: `team_id = team.id`, `status = 'made_team'`
5. The prediction board already renders these players as locked/official — no UI changes needed there

### Optimistic favorite toggle

When a user taps the heart:
1. Immediately update the local state (flip the heart)
2. Call `toggleFavorite()` server action in the background
3. If the server action fails, revert the local state

### Data entry via Claude Code

For now, round data is entered by Claude Code running SQL against Supabase. The workflow:

1. User pastes website text into Claude Code chat
2. Claude Code parses jersey numbers and session times
3. Claude Code runs an INSERT into `continuation_rounds` using the Supabase service role key or direct SQL
4. The `/continuations` page shows the new data on next load

Example INSERT for the sample data provided:
```sql
INSERT INTO continuation_rounds (association_id, division, team_level, round_number, jersey_numbers, ip_players, sessions)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'U15',
  'AA',
  1,
  ARRAY['50','80','121','180','263','277','500','501','542','552','559','645','655','660','666','672','790','854','880','883','888','957','160','162','166','178','215','228','232','292','503','571','617','641','659','673','676','709','793','797','836','884','967','997','461'],
  ARRAY['461'],
  '[
    {"session_number":1,"date":"2026-04-19","start_time":"16:15","end_time":"17:45","jersey_numbers":["50","80","121","180","263","277","500","501","542","552","559","645","655","660","666","672","790","854","880","883","888","957"]},
    {"session_number":2,"date":"2026-04-19","start_time":"17:45","end_time":"19:15","jersey_numbers":["160","162","166","178","215","228","232","292","503","571","617","641","659","673","676","709","793","797","836","884","967","997","461"]}
  ]'::jsonb
);
```

### Types

Add to `frontend/types/index.ts`:

A `ContinuationRound` type derived from the database table type, and a `PlayerAnnotation` type. Regenerate `frontend/types/database.ts` after applying the migration.

### Handling new players at lower team levels

When AA tryouts end and A tryouts begin, the A tryout posting will include:
- Players cut from AA (already in the database)
- New players who start at A level (may already be in the database from the initial import, or may be unknown)

This is handled naturally — the first round of A tryouts is just a new set of `continuation_rounds` rows with `team_level = 'A'`. Jersey numbers are matched the same way. Unknown players show as "Unknown".

## Acceptance Criteria

- [ ] New `/continuations` page displays latest round for each team level with continuing and cut lists
- [ ] Jersey numbers are matched to player names, positions, and previous teams from the database
- [ ] Unknown players (no database match) show jersey number with "Unknown" label
- [ ] IP players display an "IP" badge
- [ ] Cut players are visually distinct (reduced opacity, strikethrough jersey)
- [ ] Tapping the round header (e.g., "U15 AA — Round 1") opens a history modal with all rounds
- [ ] History modal shows expandable rounds with session details, continuing, and cuts
- [ ] Favorite heart toggle works with optimistic UI update
- [ ] Notes indicator shows when a player has notes
- [ ] Bottom nav "More" tab is replaced with "Results" linking to `/continuations`
- [ ] Dashboard has a "Tryout Results" card linking to `/continuations`
- [ ] When a final team round is inserted and `lockFinalTeam()` is called, matched players get `team_id` set and `status = 'made_team'`, and they appear as locked/official on the Predictions tab
- [ ] Favorites sort to the top of the continuing list
- [ ] First round shows "No cuts yet" in the cuts section
- [ ] Empty state shows "No tryout results posted yet" when no rounds exist
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

Step-by-step browser tests to verify every variation of this feature. Each test uses the Playwright MCP browser tools.

**Setup:** Before running tests, ensure the sample Round 1 data (from the Data Entry section above) has been inserted into `continuation_rounds`. Log in as a member of the Nepean Wildcats association. Navigate to the app.

### Test 1: Bottom nav shows Results tab
1. Navigate to `/dashboard`
2. Take a snapshot of the bottom nav
3. **Verify:** Three tabs visible — "Home", "Teams", "Results". No "More" tab. "Results" tab uses a list/check icon.

### Test 2: Dashboard shows Tryout Results card
1. Navigate to `/dashboard`
2. Take a snapshot
3. **Verify:** Two cards visible — "Teams" and "Tryout Results". The Tryout Results card has the description about continuing and cuts.

### Test 3: Dashboard card navigates to continuations
1. Navigate to `/dashboard`
2. Click the "Tryout Results" card
3. **Verify:** URL is `/continuations`. Page title is "Continuations" (or similar).

### Test 4: Continuations page shows Round 1 data
1. Navigate to `/continuations`
2. Take a snapshot
3. **Verify:**
   - Section header shows "U15 AA — Round 1"
   - Session info shows "2 sessions" and the date (Apr 19)
   - "Continuing" section shows 45 players
   - "Cuts" section shows "No cuts yet" (first round has no previous round to compare)

### Test 5: Player rows show matched info
1. Navigate to `/continuations`
2. Take a snapshot of the continuing list
3. **Verify:** Player rows show jersey number, position badge (F/D/G), name, and previous team for known players. At least several players have all four fields populated.

### Test 6: IP player has badge
1. Navigate to `/continuations`
2. Find player #461 in the list
3. **Verify:** Player #461 has an "IP" badge displayed next to their row.

### Test 7: Unknown player shown correctly
1. (Requires a jersey number in the round that doesn't match any tryout_player)
2. If all 45 numbers match existing players, this test can be skipped or set up by temporarily removing a player
3. **Verify:** Unknown players show jersey number with "Unknown" as name, no position badge, no previous team.

### Test 8: Favorite toggle works
1. Navigate to `/continuations`
2. Find any player row and note the heart icon state (outline = unfavorited)
3. Click the heart icon
4. **Verify:** Heart becomes filled (favorited)
5. Reload the page
6. **Verify:** The same player still has a filled heart (persisted to database)

### Test 9: Favorites sort to top
1. Navigate to `/continuations`
2. Favorite 2-3 players that are not near the top of the list
3. Reload the page
4. **Verify:** Favorited players appear at the top of the continuing list, before non-favorited players

### Test 10: Round header opens history modal
1. Navigate to `/continuations`
2. Click the "U15 AA — Round 1" header
3. **Verify:** A bottom-sheet modal opens showing "U15 AA History" with Round 1 listed. The modal covers approximately 80% of the viewport.

### Test 11: History modal shows round details
1. Open the history modal (click round header)
2. Expand Round 1
3. **Verify:** Shows session details (Session 1: 4:15–5:45pm, Session 2: 5:45–7:15pm), continuing count (45), cuts count (0).

### Test 12: History modal closes
1. Open the history modal
2. Click the close button (✕) or tap the overlay
3. **Verify:** Modal closes, page returns to normal state.

### Test 13: Empty state when no rounds exist
1. (Requires testing with no continuation_rounds data for the association/division)
2. Navigate to `/continuations`
3. **Verify:** Shows "No tryout results posted yet" message.

### Test 14: Cuts shown after Round 2 is inserted
1. Insert a Round 2 for U15 AA with fewer jersey numbers (remove some from Round 1's list)
2. Navigate to `/continuations`
3. **Verify:**
   - Header shows "U15 AA — Round 2"
   - "Continuing" section shows the Round 2 players
   - "Cuts" section shows the players from Round 1 who are NOT in Round 2
   - Cut players have reduced opacity and strikethrough jersey number

### Test 15: Final team locks predictions
1. Insert a final team round (`is_final_team = true`) for U15 AA with a small roster
2. Call `lockFinalTeam()` with that round's ID
3. Navigate to `/teams`
4. **Verify:** The players from the final team appear in the U15 AA section as official (locked with checkmark, collapsed by default).

### Test 16: Multiple team levels shown
1. Insert Round 1 for U15 A (different team_level, same division)
2. Navigate to `/continuations`
3. **Verify:** Two sections visible — "U15 AA" (latest round) and "U15 A — Round 1". AA appears first (higher tier).

### Test 17: Bottom nav active state
1. Navigate to `/continuations`
2. Take a snapshot of the bottom nav
3. **Verify:** "Results" tab is highlighted as active. "Home" and "Teams" are not.

### Test 18: Mobile viewport
1. Set viewport to 393×852 (iPhone 14 Pro)
2. Navigate to `/continuations`
3. **Verify:** Layout is fully contained within the phone frame. No horizontal overflow. Player rows don't wrap awkwardly.

## Files to Touch

1. `backend/supabase/migrations/20260420000002_create_continuations.sql` — CREATE TABLE for `continuation_rounds` and `player_annotations`, RLS policies, triggers
2. `frontend/types/database.ts` — regenerate after migration (`supabase gen types`)
3. `frontend/types/index.ts` — add `ContinuationRound` and `PlayerAnnotation` type aliases
4. `frontend/app/(app)/continuations/page.tsx` — new server component page
5. `frontend/app/(app)/continuations/actions.ts` — server actions for data fetching, favorites, notes, final team locking
6. `frontend/components/continuations/continuations-page-client.tsx` — main client component
7. `frontend/components/continuations/round-section.tsx` — section for one team level's latest round
8. `frontend/components/continuations/continuation-player-row.tsx` — player row with favorite and IP badge
9. `frontend/components/continuations/round-history-modal.tsx` — bottom-sheet modal for historical rounds
10. `frontend/components/layout/bottom-nav.tsx` — replace "More" tab with "Results"
11. `frontend/app/(app)/dashboard/page.tsx` — add Tryout Results dashboard card
12. `frontend/app/globals.css` — new CSS classes for continuations components

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Apply migration:** Run `cd backend && supabase db push` to create the new tables.
2. **Regenerate types:** Run `cd backend && supabase gen types typescript --local > ../frontend/types/database.ts`
3. **Build:** Run `cd frontend && npm run build` — fix any errors.
4. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
5. **Insert sample data:** Insert the Round 1 sample data (from the Data Entry section) using direct SQL via the Supabase dashboard or CLI.
6. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
7. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
8. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
