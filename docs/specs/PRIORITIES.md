# Feature Priority List

Last updated: 2026-04-23

**Completed:** 001 (Previous teams sorting), 002 (Position filter), 003 (Continuations tracker), 004 (Division switcher), 005 (Continuations auto-scraper), 006 (Player management — parent), 007 (Admin CRUD & continuations linking), 008 (Bulk heart by previous team), 009 (Dashboard redesign), 010 (Association picker), 011 (Dashboard favourites summary), 012 (My Favourites page), 013 (Onboarding tooltips & help page), 014 (Sessions card & toggle), 015 (Dashboard hero cards & favourites), 016 (Sessions position filter & drag sorting), 017 (Scraper robustness & Final Team)

| # | Feature | PRD Ref | Status |
|---|---------|---------|--------|
| 13 | Onboarding tooltips & help page — two startup tooltips + help page in bottom nav | NFR-024 | Done |
| 14 | Sessions page — summary card & continuing/cuts toggle | FR-039 | Done |
| 15 | Dashboard redesign — hero card & favourites | FR-039 | Done |
| 16 | Sessions position filter & draggable sorting — All/F/D/G/? filter + drag reorder | FR-039 | Done |
| 17 | Scraper robustness & Final Team — fix extraction for all NGHA formats, auto-detect final team phrasings, made_team flow, hero card with player rows + toggle | FR-039 | Done |
| 18 | Scraper manual fallback & final team size validation — paste jersey numbers when scraper finds 0, team size warnings | FR-039 | Specced ([018](018-scraper-fallback-team-validation.md)) |
| 19 | Retest long-press drag — separate branch, review [DRAG-UX-RESEARCH.md](../prd/DRAG-UX-RESEARCH.md) | FR-039 | Skipped ([019](019-skipped-retest-long-press.md)) |
| 20 | Test sandbox association — clone NGHA U15 data into hidden test association for safe feature testing | — | Done |
| 21 | Fix Dashboard Favourite Logic | — | Not started |
| 22 | UI/UX drag additions — separate branch, review [DRAG-UX-RESEARCH.md](../prd/DRAG-UX-RESEARCH.md) | FR-039 | Not started |
| 23 | Player row swipe to edit/add note + row readability improvements — separate branch, review [DRAG-UX-RESEARCH.md](../prd/DRAG-UX-RESEARCH.md). **Also includes:** (1) Enlarge drag handle — icon `GripVertical size={14}` → `size={20}` in `player-row.tsx:112`, touch target `.player-drag-handle` from `w-10` (40px) → `width: 2.75rem` (44px, Apple HIG minimum) in `globals.css:412`; (2) Increase player row font size (currently inherits base/`text-sm`); (3) Reduce left margin/padding on `.player-row` (currently `px-5` in `globals.css:396`). Drag handle values from branch `feature/long-press-retest` — tested well on mobile. | FR-039 | Not started |
| 24 | Onboarding — division selector darker font + sessions yellow | — | Not started |
| 101 | Rework Help Page — expand content, mockups, deeper feature guidance | — | Not started |
| 102 | Bulk status updates | FR-022 | Not started |
| 103 | Extended corrections (status, position, team changes) | FR-025–027 | Partial (name/jersey via 006) |
| 104 | Team management (create/edit/archive) | FR-016 | Schema only |
| 105 | Privacy notice + consent | NFR-012, NFR-013 | Not started |
| 106 | 90-day data purge | NFR-015 | Not started |
| 107 | Member management (roles) | FR-023 | Not started |
| 108 | Audit log viewer | FR-024 | Not started |
| 109 | Association settings | FR-008, FR-009 | Not started |
| 110 | Password reset | FR-004 | Not started |
| 111 | Scalability: user_tracked_groups table | — | Not started |
