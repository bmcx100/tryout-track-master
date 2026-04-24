# Draft: Player Detail / Edit Form Redesign

**Status:** Draft — collecting notes
**Created:** 2026-04-24
**Last updated:** 2026-04-24

## Notes

### Layout & UX
- Must fit on a single page (no scrolling)
- Fields don't need to take up a full row — use compact/multi-column layout
- Needs explicit **Save** button (currently auto-saves on close)
- Needs explicit **Cancel** button

### Field Grouping
Fields should be grouped by purpose, not listed linearly:

**Major changes** (top section):
- Jersey #
- Position
- Name
- Previous Team

**Status / Assignment** (middle section):
- Show Next Year's Team if assigned to one
- If not on a Next Year's Team, show current tryout status instead

**Personalization** (bottom section):
- Heart / favourite toggle
- Notes

## Open Questions

- Does this apply to both parent and admin views, or just one?
- What does Save do for parents — submit correction, or save local customization?
- Should Cancel discard all changes, or warn if there are unsaved edits?
- How should Next Year's Team be displayed — read-only label, or link to the team?
- What happens to the correction flow — is it still triggered on name/jersey changes?
