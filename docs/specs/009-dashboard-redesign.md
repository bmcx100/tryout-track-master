# Spec 009: Dashboard Redesign

**PRD Reference:** FR-039 (activity feed), FR-025 (player tracking)
**Priority:** Must Have
**Depends on:** 003 (Continuations tracker), 006 (Player management — parent)

## Revision History

- **v1 (2026-04-21):** Original spec — implemented and committed as `5329622`. Replaced nav menu dashboard with activity cards + full player list.
- **v2 (2026-04-21):** Redesign the My Players section into a summary with status cards. Replace the full player-by-player list with grouped status cards (continuing, cut, missing) showing counts and 1–2 sample names. Links to `/my-players` for full detail. Design approved via interactive mockup session.

**This spec describes ONLY the v2 changes.** The v1 implementation is already live. A fresh session should read this spec and modify the existing committed code.

---

## What This Feature Does (v2)

The dashboard's "My Players" section (which currently shows every hearted player in a flat list) is replaced with a compact "My Favourites" summary. Instead of listing every player, it groups them by status (continuing, cut, missing) as colour-coded cards with counts and 1–2 sample names. A "See All My Favourites ›" link navigates to `/my-players` for the full list. This keeps the dashboard focused on at-a-glance value.

## Current State (post-v1 implementation)

### Files that exist now (committed)
- `frontend/app/(app)/dashboard/page.tsx` — Server component. Calls `getDashboardData()`, passes `activityCards` and `favoriteStatuses` to `DashboardClient`.
- `frontend/app/(app)/dashboard/actions.ts` — Server action with `getDashboardData()` returning `ActivityCard[]` and `FavoriteStatus[]`. Includes `derivePlayerStatus()` helper.
- `frontend/components/dashboard/dashboard-client.tsx` — Client component rendering activity cards + full player list. **This file is the primary target of v2 changes.**
- `frontend/app/globals.css` — Dashboard styles under `/* -- Dashboard Redesign -- */` comment block (lines ~1351–1514).

### Data already available from `getDashboardData()`
The server action already returns everything needed for the summary. No changes needed to actions.ts.

`FavoriteStatus` fields per player:
- `playerId`, `playerName`, `jerseyNumber`, `position`, `division`
- `statusText` — e.g., "Continuing R3 (AA)", "Cut R3 (AA)", "Cut R3 (AA) · Not at A"
- `statusType` — "continuing" | "cut" | "made_team" | "missing" | "registered"
- `originalName` — original DB name when custom name is set

`ActivityCard` fields per team level:
- `teamLevel`, `roundNumber`, `continuingCount`, `cutCount`, `publishedAt`, `isFinalTeam`

## Approved Design

**Mockup file:** `frontend/public/mockups/011-dashboard-summary.html` — open in browser to see the approved design.

### Design Rules (apply to entire dashboard)

1. **Gold (`--dm-gold`) is ONLY for clickable/interactive elements.** Never use gold for badges, jersey numbers, or stat counts.
2. **Section headings use title case**, not uppercase. Font: Inter (body font), 13px, semi-bold, `--dm-umber` colour.
3. **Canadian spelling**: "Favourites" not "Favorites".

### Recent Results section (minor tweaks)

- Section header: "Recent Results" (title case, not uppercase)
- Activity cards: **add left margin** matching the favourites status cards (`margin-left: 10px`)
- AA badge: neutral background (`oklch(1 0 0 / 8%)`), text colour `--dm-umber` — **NOT gold**
- Cut/continuing stat numbers: use status colours (red `--dm-red` / green `--dm-official-green`), not gold
- **Add "Results Details ›"** link in gold, **centered** below the activity cards (same alignment as "See All My Favourites ›")
- "Results Details ›" navigates to `/continuations`

### My Favourites section (replaces full player list)

**Header:** "My Favourites (N)" where N is total hearted player count. Same font as heading (13px, semi-bold, `--dm-umber`). Count in parentheses, same style — no badge, no heart icon. "›" arrow on the far right.

**Status cards** — one card per status group, shown in this order:
1. **Continuing** (green left border, `--dm-official-green`)
   - Heading: "3 continuing" — 13px mono, semi-bold, green
   - Body: 1–2 player names like `#7 Lee, #15 Davis +1` — 12px mono, `--dm-dust`
   - "+N" shown when more than 2 players in this group
2. **Cut** (red left border, `--dm-red`)
   - Heading: "1 cut" — 13px mono, semi-bold, red
   - Body: player names only, NO round/level info (already obvious from Recent Results)
3. **Missing** (orange left border, `--dm-orange`, warm tinted background `oklch(0.72 0.15 55 / 6%)`)
   - Heading: "⚠ 1 missing at A" — the level is part of the heading text
   - Body: player names
   - **Only shown when missing count > 0**
4. **Made team** (gold left border, `--dm-gold`) — if any players have `statusType === "made_team"`
   - Heading: "1 made team"
   - Body: player names with team name
5. **Registered/fallback** — only show if players have no rounds data
   - Heading: "N registered" — muted colour (`--dm-dust`)

**Card styling (all status cards):**
- Background: `--dm-dune`
- Border: `1px solid --dm-border`
- Border-radius: 10px
- Padding: 10px 14px
- **Left margin: 10px** (matching activity cards)
- Left border: 3px solid (status colour)
- Margin-bottom: 8px between cards

**Jersey numbers in card bodies:** Use `--dm-umber` (NOT gold — they're not links here).

**"See All My Favourites ›"** — centered, gold, 12px mono. Navigates to `/my-players`.

### Empty state (no changes)

Keep the current empty state: centered Heart icon + "Heart players on the Teams page to track them here." with "Teams" as a gold link to `/teams`.

### What to do with multiple missing levels

If players are missing at different levels (e.g., 1 missing at A, 1 missing at BB), show separate missing cards per level OR group them as "2 missing" with individual "Not at X" in the body. Implementer's choice — whichever is cleaner.

## Changes Required

### Database
No changes.

### Server Actions / API Routes
No changes needed — `getDashboardData()` already returns all data. The `FavoriteStatus` type already has `statusType` and `statusText` fields.

The action may need a small addition: return **summary counts** grouped by statusType so the client doesn't have to re-derive them. Consider adding to the return type:

```
statusSummary: {
  continuing: { count: number, sampleNames: string[] }
  cut: { count: number, sampleNames: string[] }
  missing: { count: number, sampleNames: string[], levels: string[] }
  made_team: { count: number, sampleNames: string[] }
  registered: { count: number, sampleNames: string[] }
}
```

Alternatively, derive this in the client component from the existing `favoriteStatuses` array — implementer's choice.

### Pages
No changes to `page.tsx` — it already passes `activityCards` and `favoriteStatuses` to `DashboardClient`.

### Components

**Modified: `frontend/components/dashboard/dashboard-client.tsx`**

Replace the full player list (current lines ~61–99) with the status card summary described above. The activity section (lines ~24–58) stays but gets minor tweaks (margin, badge colour, centered "Results Details ›" link).

### Styles

**Modified: `frontend/app/globals.css`**

Update existing dashboard styles. Key changes:
- `.dashboard-section-header` — change from uppercase to title case, update font
- `.dashboard-activity-card` — add `margin-left: 10px`
- `.dashboard-activity-badge` — change from gold to neutral
- Remove `.dashboard-fav-row`, `.dashboard-fav-jersey`, `.dashboard-fav-position`, `.dashboard-fav-name`, `.dashboard-fav-spacer`, `.dashboard-fav-status`, `.dashboard-fav-status-*`, `.dashboard-fav-alert` (all replaced by status cards)
- Add new classes:
  - `.dashboard-status-card` — base card style with left border
  - `.dashboard-status-card-continuing`, `.dashboard-status-card-cut`, `.dashboard-status-card-missing`, `.dashboard-status-card-made`, `.dashboard-status-card-registered` — colour variants
  - `.dashboard-status-heading` — status count text (13px mono bold)
  - `.dashboard-status-names` — player name list (12px mono muted)
  - `.dashboard-results-link` — centered gold link for "Results Details ›"
- Update `.dashboard-section-header` to use title case, body font, 13px
- Update `.dashboard-section-count` — remove gold badge, use plain parenthetical text

## Key Implementation Details

1. **Group `favoriteStatuses` by `statusType`** to build the summary cards. For each group, pick the first 2 players as sample names. If more than 2, append "+N".

2. **Missing level extraction:** Parse the level from `statusText` — it contains "Not at {level}" after the "·" separator. Or check the `statusText` for the pattern. The heading should read "N missing at {level}".

3. **The "Results Details ›" link** and "See All My Favourites ›" link should both be centered `<Link>` components (not buttons).

4. **Empty states:**
   - If `favoriteStatuses` is empty → show existing heart empty state
   - If a status group has 0 players → don't render that card (especially missing)
   - If `activityCards` is empty → keep existing "No results in the last 5 days" text

5. **The `/my-players` page is NOT changed in this spec.** A future spec will enhance it. For now, "See All My Favourites ›" links to the existing `/my-players` page as-is.

## Acceptance Criteria

- [ ] "Recent Results" heading is title case (not uppercase)
- [ ] Activity cards have left margin matching status cards
- [ ] AA badge is neutral coloured, not gold
- [ ] "Results Details ›" link appears centered below activity cards, navigates to `/continuations`
- [ ] Section heading reads "My Favourites (N)" with count in parentheses, same font style
- [ ] Continuing status card shows count + 1–2 player names with green left border
- [ ] Cut status card shows count + player names with red left border (no round info)
- [ ] Missing status card shows "⚠ N missing at {level}" with orange left border and warm background
- [ ] Missing card only renders when missing count > 0
- [ ] "See All My Favourites ›" link centered in gold, navigates to `/my-players`
- [ ] No gold used on non-clickable elements (badges, jersey numbers, stats)
- [ ] Empty state unchanged (heart icon + prompt to heart on Teams page)
- [ ] Full player list is gone — no individual player rows on dashboard
- [ ] Build passes (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Playwright Test Plan

**CRITICAL — Live Data Safety:**
Tests run against the real database with real user data. Follow the standard rules (read-only preferred, log mutations, revert after).

**Setup:** Log in as `testparent@test.com` / `testpass123` (member role, Nepean Wildcats). Dev server at `http://localhost:3000`. Active division U15. User should already have hearted players.

### Test 1: Recent Results styling
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot
3. **Verify:** "Recent Results" heading is title case. Activity card has left margin. AA badge is NOT gold (should be neutral/muted). "Results Details ›" link appears centered below cards.

### Test 2: Results Details link
1. Click "Results Details ›"
2. **Verify:** Navigates to `/continuations`
3. Navigate back to `/dashboard`

### Test 3: My Favourites summary renders
1. Navigate to `http://localhost:3000/dashboard`
2. Take a snapshot
3. **Verify:** "My Favourites (N)" heading with count in parentheses. No individual player rows. Status cards visible with coloured left borders.

### Test 4: Continuing status card
1. **Verify:** A green-bordered card shows "N continuing" with 1–2 player names. Jersey numbers shown but NOT in gold.

### Test 5: Cut status card
1. **Verify:** A red-bordered card shows "N cut" with player names. No round or level info in the card.

### Test 6: Missing status card (if applicable)
1. **Verify:** If any hearted players are missing, an orange-bordered card shows "⚠ N missing at {level}" with a warm background tint. If no missing players, this card should NOT appear.

### Test 7: See All My Favourites link
1. Click "See All My Favourites ›"
2. **Verify:** Navigates to `/my-players`
3. Navigate back to `/dashboard`

### Test 8: Empty state
1. Log in as `testparent2@test.com` / `TestParent1234` (no hearted players)
2. Navigate to `/dashboard`
3. **Verify:** Heart icon and "Heart players on the Teams page" prompt. "Teams" is a link to `/teams`. No status cards visible.

### Test 9: No gold on non-interactive elements
1. Navigate to `/dashboard` as `testparent@test.com`
2. Take a snapshot
3. **Verify:** Gold colour only appears on "Results Details ›" and "See All My Favourites ›" links. AA badge, jersey numbers, and stat counts are neutral colours.

### Test 10: Division switch
1. Open division switcher, select a different division
2. **Verify:** Dashboard reloads. Favourites summary updates to reflect players in the new division.

### Test Mutations Log

| Test | What Changed | How to Revert |
|------|-------------|---------------|
| (none expected — all tests are read-only) | | |

## Files to Touch

1. `frontend/components/dashboard/dashboard-client.tsx` — **MODIFY** (replace full player list with status card summary, tweak activity section)
2. `frontend/app/globals.css` — **MODIFY** (update dashboard styles: remove player row classes, add status card classes, fix heading/badge styles)

Optionally:
3. `frontend/app/(app)/dashboard/actions.ts` — **MODIFY** (add `statusSummary` to return type if preferred over client-side grouping)

## Implementation Checklist

After implementing the changes above, you MUST complete these steps in order before claiming the work is done:

1. **Build:** Run `cd frontend && npm run build` — fix any errors.
2. **Lint:** Run `cd frontend && npm run lint` — fix any errors.
3. **Start dev server:** Run `cd frontend && npm run dev` to start the local dev server on port 3000.
4. **Run every Playwright test above.** Open the browser, follow each test's steps exactly, and verify each expected result using browser snapshots. If a test fails, fix the code and re-run it.
5. **Do not skip any test.** Every test in the Playwright Test Plan must pass before this spec is considered complete.
6. **Revert all test mutations.** Check the Test Mutations Log and undo every data change made during testing. Confirm with the user that all test data has been cleaned up.
