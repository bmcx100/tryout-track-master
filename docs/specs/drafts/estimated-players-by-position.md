# Draft: Estimated Players by Position

**Status:** Draft — collecting notes
**Created:** 2026-04-25
**Last updated:** 2026-04-25

## Notes

### What it does
- Break the single `estimated_players` integer into per-position fields: **F, D, G, and Total (All)**
- Total acts as a fallback — admin can enter just a total when position breakdown is unknown
- If F+D+G are entered, Total auto-calculates (or can be overridden?)

### Admin UI (continuations page)
- Replace the single "Est. Players" spinbutton with 4 separate fields: All, F, D, G
- Entered per-round in the admin continuations round card editor
- User wants the option to enter just a total (All) when positions are unknown

### Dashboard display
- **Round 1 hero card**: Show estimated players as "Registered" count — currently uses `estimated_players` for this. With per-position data, could show breakdown (e.g., "45 Registered: 25F / 14D / 6G") or just total
- **Round 2+ hero card**: Estimated players used to calculate "Cuts" in the continuation scrape. When Round 2 has fewer players than the estimate, the difference = cuts

### Cuts calculation
- Currently in `getDashboardData()` (dashboard/actions.ts), cuts are calculated as: players on previous round but not on latest round
- The `estimated_players` field is used somewhere in the scraper or dashboard to supplement cut counts when actual roster comparison isn't possible (e.g., Round 1 → Round 2 where Round 1 had estimated-only data)
- With per-position estimates, cuts could theoretically be shown per-position on the dashboard

### Database
- Current column: `continuation_rounds.estimated_players` (single integer, nullable)
- Needs migration to add: `estimated_players_f`, `estimated_players_d`, `estimated_players_g`
- Rename existing `estimated_players` → `estimated_players_total` (or keep as-is and treat as "All")
- Migrate any existing values to Total (user says there shouldn't be any current data)

### Where it's consumed
- **Admin entry**: `frontend/components/admin/admin-continuations-client.tsx` — round card editor
- **Dashboard**: `frontend/app/(app)/dashboard/actions.ts` — `getDashboardData()` uses estimated_players for hero card stats
- **Scraper**: `frontend/app/(app)/continuations/scraper-actions.ts` — may reference estimated_players during scrape/import

## Open Questions

1. **Dashboard Round 1 display**: Show per-position breakdown (e.g., "25F / 14D / 6G") or just total with tooltip? Or separate stat boxes?
2. **Cuts per position**: When we have per-position estimates, should the Round 2+ hero card show "5F cut, 3D cut, 1G cut" or just a single total cut count?
3. **Auto-calculate total**: If admin enters F=25, D=14, G=6, should Total auto-fill to 45? Or should Total be independent (allows mismatch for "unknown position" players)?
4. **Scraper interaction**: Does the scraper currently set `estimated_players`? If so, can it detect position from the scraped data to populate per-position fields?
5. **Parent-facing sessions page**: Should parents see the per-position estimates anywhere, or is this admin/dashboard only?
