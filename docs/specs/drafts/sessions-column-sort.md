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
