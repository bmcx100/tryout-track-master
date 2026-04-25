# Draft: Sessions Column Sort Header

**Status:** Draft — needs full spec before implementation

## Idea

Add a standard table-style header row to the sessions player list. Clicking a column header sorts players by that column. Works alongside drag-to-reorder.

## Decisions Made

- **Header style:** Thin table header row (not chips/pills), aligned to player row columns
- **Sticky:** No — scrolls with content
- **Sortable columns:** All — Jersey, Position, Name, Notes, Favourite, Previous Team
- **Sort + drag coexistence:** Both work. Clicking a column sort resets any custom drag order. Dragging a player clears the active column sort. At any time the list is in one mode: column-sorted or custom-dragged.
- **Sort cycle:** First click = ascending, second = descending, third = reset to default sort
- **Arrow indicator:** Active sort column shows ▲ or ▼

## Sort Logic per Column

| Column | Ascending | Descending |
|--------|-----------|------------|
| Jersey | 1, 2, 3... | 99, 98, 97... |
| Position | F → D → G → ? | ? → G → D → F |
| Name | A → Z | Z → A |
| Notes | Has note first | No note first |
| Favourite | Favourites first | Non-favourites first |
| Prev Team | Existing tier ranking (AA first) | Reversed |

## Column Alignment

Header labels must align with the player row columns:
- Handle slot (no label — not sortable)
- `#` (jersey) — `w-10`
- `Pos` (position) — fits badge width
- `Name` — `flex-1`
- Note icon column — `~16px`
- Heart icon column — `~20px`
- `Team` (prev team) — auto-width, right side

## Key Files

- `frontend/components/continuations/round-section.tsx` — sort state, sort logic, renders header
- `frontend/components/continuations/sort-header.tsx` — NEW component
- `frontend/app/globals.css` — header styles

## Implementation Notes (2026-04-25)

### What was built
- Sort header renders above the player list in the continuing view (not cuts)
- Sortable columns in header: `#`, `Pos`, `Name`, `Team`
- Note and heart icons removed from the header — sorting by notes/favourite still works via the sort logic but has no UI trigger
- Sort is ephemeral (not saved to DB). Dragging saves order; column sort does not.
- On drag, `setSortConfig(null)` clears the active column sort
- On sort click, a fresh player list is built from `activeRound.jersey_numbers` (ignoring saved order) and sorted by column
- Third click resets to `fullOrderedList` (saved order or default position+team sort)
- Tiebreaker for all sorts: jersey number ascending

### Header styling
- Height: 28px, bottom-aligned text (`align-items: flex-end`, `padding-bottom: 3px`)
- Font: 9px mono, uppercase, weight 600
- `margin-top: 1px`, `margin-bottom: -3px` (tight against first row)
- Background: `oklch(0.12 0 0)`, border-bottom: `oklch(1 0 0 / 8%)`
- Active sort column brightens to `oklch(0.70 0 0)` via `:has(.sort-arrow)`
- Arrow indicator: gold `▲`/`▼` (7px)

### Column alignment (confirmed via Playwright measurements)
- `#` — centered, w-10 (offset: 0px)
- `Name` — left-aligned, flex-1 (11px offset from row data due to variable position badge width)
- `Team` — centered, width 54px matching row data (offset: -1px)
- Invisible spacers (w-5 each) replace the removed note/heart columns to preserve right-section alignment
