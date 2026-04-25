# Draft: Close Level + Dashboard/Favourites Multi-Level Fix

**Status:** Draft — collecting notes
**Created:** 2026-04-25
**Last updated:** 2026-04-25
**Spec number (tentative):** 033
**Depends on:** 031 (Admin Continuations Redesign)

## IMPORTANT: Pre-Spec Review

**Before converting this draft to a full spec, you MUST:**
1. Review spec 031 (Admin Continuations Redesign) and any implementation changes that have landed since this draft was written
2. Check the current state of the admin continuations page — its layout, components, and data flow may have changed significantly
3. Verify the `continuation_rounds` schema and any new columns/tables added by spec 031
4. Adjust this spec's "Current State" and "Changes Required" sections to reflect the actual codebase at the time of writing

---

## Notes

### Problem
- The current `deriveFavouriteStatuses()` in `dashboard/actions.ts` picks ONE "primary level" (most recent `created_at`) and only categorizes favourites from that level
- When AA rounds exist and an A round is scraped, A becomes the primary level
- Favourites still continuing at AA disappear from the favourites section
- Hero cards are fine (one per level), but the favourite derivation is broken for multi-level scenarios

### Key Design Decisions

**Levels are sequential, not concurrent:**
- AA finishes before A starts. A finishes before BB starts. Etc.
- Only exception: B and C can run simultaneously (existing logic handles this)
- We need a mechanism to mark a level as "done" so the system knows to move on

**"Close Level" button — manual admin action:**
- Lives on the **Continuations admin page** (spec 031)
- Admin explicitly closes a level when they're ready to move to the next
- **Reversible** — admin can reopen a closed level if they made a mistake
- Final Team hero card persists UNTIL admin closes the level (not auto-closed on Final Team publish)

**Dashboard hero cards when a level is closed:**
- Closed levels' hero cards disappear
- Non-closed levels' hero cards show normally
- Final Team cards stay visible until manually closed

**Favourite statuses across levels:**
- Only derive from the active (non-closed) level
- **Exception: "Made Team" persists** — if AA was finalized and closed, "Made Team (AA)" favourites still show in the favourites section across all subsequent levels
- Cuts from closed levels do NOT persist
- "Continuing" from closed levels does NOT persist (those players made the team — they are "Made Team" at that level)

**Favourite card labels include team level:**
- Separate cards per level where applicable: "Continuing (A)", "Made Team (AA)"
- Made Team from finalized+closed levels shows as persistent cards

### Data Model

**Option A — New column on `continuation_rounds`:**
- Add `is_level_closed boolean DEFAULT false` to the latest round at a level
- Pro: No new table. Query: "find latest round per level, check is_level_closed"
- Con: The flag is on a round but semantically applies to a level. Moving it if a new round is added is awkward.

**Option B — New table `continuation_level_status`:**
```
continuation_level_status (
  id uuid PK,
  association_id uuid FK,
  division text,
  team_level text,
  is_closed boolean DEFAULT false,
  closed_at timestamptz,
  closed_by uuid FK → auth.users,
  UNIQUE (association_id, division, team_level)
)
```
- Pro: Clean separation. Level status is independent of rounds. Easy to query.
- Con: Another table to maintain.

**Recommendation:** Option B — cleaner, avoids confusion between round-level and level-level concepts.

### UI: Close Level Button

- On the Continuations admin page (spec 031), each level section gets a "Close Level" / "Reopen Level" toggle button
- When closed: level section collapses or shows a "Closed" badge
- When reopened: level section expands back to normal

### Favourite Derivation Changes (`deriveFavouriteStatuses`)

Current logic:
1. Find primary level (most recent `created_at`)
2. Derive all statuses from that one level
3. B/C combo exception

New logic:
1. Find the ONE active level = the non-closed level with the most recent round (B/C combo exception stays)
2. Derive continuing/cut/missing/registered statuses from that active level only
3. ALSO: scan all CLOSED levels that have `is_final_team = true` → include their "Made Team" favourites
4. Made Team from DB status override still takes priority (existing behavior)

### Hero Card Changes

Current logic: show one card per level that has published rounds.

New logic:
1. Show cards only for non-closed levels
2. Exception: none — when closed, card disappears entirely
3. The Final Team card persists until the admin clicks Close Level

### Scraper — No Changes

- Team level dropdown still resets on each page visit (auto-detect from page text, default AA)
- No persistence of last-used team level

## Open Questions

1. **What does "Close Level" look like on the admin continuations page?** Need to see spec 031's final design before deciding placement. Likely a button in each level's section header.
2. **Should there be a confirmation dialog?** "Close AA level? The hero card will be removed from the dashboard." — probably yes for close, probably not for reopen.
3. **RLS on new table?** `continuation_level_status` needs RLS policies — admins can read/write, parents can read (to know which levels are active). Or the status could be fetched server-side only.
4. **Audit logging?** Should close/reopen actions be logged in `audit_log`?
5. **What happens if admin closes a level that has NO final team round?** The "continuing" players at that level just vanish from favourites. Is that OK, or should we warn?
