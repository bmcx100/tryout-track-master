# Teams & Prediction Board -- Design Spec

**Date:** 2026-04-17
**Status:** Approved
**Scope:** (app) route group, Teams page with prediction board, long-press actions, corrections

---

## Overview

The primary parent-facing feature of Track Master is an interactive prediction board where parents rank players within a division to build their own projected team rosters. Official team announcements lock in results top-down, and parents adjust predictions for remaining teams.

---

## Page Structure

### Header Layout

```
[Group Label]        Teams        [Avatar]
```

- **Group label** (top-left): Custom name the parent gives to their tracked group (e.g. "Wildcats U15"). Set via the More menu. This replaces separate association/division labels.
- **"Teams"** (center): Page title, always visible.
- **Avatar** (top-right): User initials, links to profile.

### View Toggle

A segmented control below the header switches between two views:

- **Predictions** (default): Interactive drag-to-reorder prediction board.
- **Previous Teams**: Read-only list grouped by where players came from last year.

### Instruction Line

Below the toggle, a subtle italic line reads: *"Drag players up and down between teams"*

No search bar on this page.

### Bottom Navigation

Three tabs:

| Tab | Icon | Purpose |
|-----|------|---------|
| Home | House | Dashboard / landing after login |
| Teams | Hockey puck | Main prediction board (this page) |
| More | Three dots | Association/division switcher, corrections, settings, sign out |

### More Menu Contents

- Switch association
- Switch division/age group
- My Corrections
- Settings
- Sign Out

---

## Predictions View

### Core Mechanic

Parents maintain a **single ordered list** of all players in a division, ranked from best to worst. Team boundaries are **derived from the ranking**:

- Top N players = highest team (AA)
- Next N players = next team (A)
- Continue down: BB, B, C, etc.

N = the roster size for each team (typically 17).

### Default Sort Order

When a parent first opens predictions (before any manual ranking), players are ordered by:

1. Previous team level, interleaved by age group (higher level first, older age first within same level)
2. Within each group, sorted by jersey number

Example for U15 tryouts with two-year cohort:
```
U15 AA players (by jersey) -> U13 AA players (by jersey) ->
U15 A players (by jersey) -> U13 A players (by jersey) ->
U15 BB players (by jersey) -> U13 BB players (by jersey) -> ...
```

### Team Sections

Teams stack flush with no gaps between them. Alternating header background tones (Dune / darker Dune) visually separate adjacent sections. No left borders on any section.

Each team level is displayed as a collapsible section:

**Official teams** (admin-announced):
- Green checkmark badge, sentence case: "✓ Official"
- Collapsed by default (tap to expand)
- Shows: "17 Players"
- Players within are locked, not draggable

**Predicted teams** (parent's ranking):
- Gold badge, sentence case: "Prediction"
- Expanded by default (collapsible)
- Shows: "17 Players"
- Players are draggable via drag handles

**Team header layout** (left to right):
- Team name (e.g. "AA") + player count on the left
- Badge (Official/Prediction) + chevron on the right

Teams are always ordered top-down: AA, A, BB, B, C (matching the real tryout structure).

### Player Row

Player rows stretch edge-to-edge (full width, no card margins). Each row shows (left to right):

| Element | Description |
|---------|-------------|
| Drag handle | Grip icon for reordering (hidden on official/locked rows) |
| Jersey number | Prefixed with # (e.g. #16), IBM Plex Mono, Gold |
| Position badge | Small badge: F (forward), D (defense), G (goalie) |
| Player name | Full name, truncated with ellipsis if too long |
| Previous team | Condensed label, no space (e.g. "U13AA"), IBM Plex Mono, Dust |

**No rank numbers are displayed.** The position in the list IS the rank.
**No status pills** (Trying Out, Registered, etc.) are shown in player rows.
**No hearts** are shown inline in player rows.

### Reordering

- **Drag handle**: Press and drag the grip icon on the left side of any predicted row to move it up or down.
- Dragging a player across a team boundary moves them between predicted teams.
- Official/locked players cannot be dragged.

### Official Team Announcements

When an admin announces a team (e.g. AA):

1. AA section badge changes from "Prediction" (gold) to "✓ Official" (green checkmark).
2. The official players are locked at the top with checkmarks instead of drag handles.
3. The section collapses by default.
4. Remaining players keep their relative order in the parent's ranking.
5. The next team down (A) now starts from the remaining player pool.

This happens progressively: AA first, then A, then BB, etc. Each announcement locks one more team.

---

## Previous Teams View

A read-only list showing all players in the division, grouped by their previous team:

```
From U13 AA — 6 players
  #7  Noah Williams      -> AA        Made Team
  #14 Liam Johnson       -> AA        Trying Out
  ...

From U13 A — 5 players
  #11 Aiden Martinez     -> A         Made Team
  #16 Lucas Wilson       -> AA ▲      Moved Up
  ...

From U15 AA (minors) — 2 players
  ...
```

Each group shows:
- Previous team label as the section header
- Player count
- Arrow showing where each player went (new team assignment if known)
- Movement indicators: ▲ moved up, ▼ moved down
- Color-coded arrows: green for up, red for down, blue for lateral

---

## Long-Press Context Menu

Long-pressing any player row opens a bottom sheet with:

### Header
```
#11 Aiden Martinez
U13 A · Trying Out
```

### Actions

| Action | Description |
|--------|-------------|
| **Add to Friends** / **Remove from Friends** | Toggle heart on this player. Hearted players show a red heart icon and a subtle pink row background. |
| **View Player Details** | Navigate to player detail page showing full info: name, jersey, division, previous team, current status, team assignment, last updated timestamp. |
| **Submit Correction** | Opens a form where the parent can suggest a change to any player field (jersey number, name spelling, status, etc.). Submits a correction request to admins for review. Does NOT change the database directly. |

### Long-Press on Team Header

Long-pressing a team section header (e.g. "From U13 AA" or "BB") offers:
- **Heart All Players** / **Remove All Hearts**: Toggle hearts for every player in that group at once.

---

## Heart / Friends System

- **Private per parent**: Each parent's hearted players are stored in the `player_hearts` table (server-side, synced across devices). No other parent sees their hearts.
- **Visual indicator**: Red heart icon in the player row, subtle pink background tint on hearted rows.
- **Persistence**: Hearts persist across sessions.
- **Purpose**: Track friends, former teammates, or players of interest as they move through tryouts.

---

## Corrections System

When a parent submits a correction via the long-press menu:

1. A form opens pre-populated with the player's current data.
2. The parent modifies the field they believe is wrong (e.g. jersey number).
3. They can add a note explaining the correction.
4. On submit, a `correction` record is created with status `pending`.
5. An admin reviews and approves/rejects the correction.
6. If approved, a database trigger updates the player record automatically.
7. The parent can see their correction history and statuses via More > My Corrections.

---

## Data Model Changes Required

### New: `previous_team` field on `tryout_players`

```sql
ALTER TABLE tryout_players
  ADD COLUMN previous_team text;
```

Stores the full previous team label condensed without spaces (e.g. "U13AA", "U15MinorA"). Free text since players may come from other associations.

### New: `position` field on `tryout_players`

```sql
ALTER TABLE tryout_players
  ADD COLUMN position text CHECK (position IN ('F', 'D', 'G'));
```

Player position: F (forward), D (defense), G (goalie). Displayed as a small badge between jersey number and player name.

### New: `player_predictions` table

Stores each parent's player ranking per division:

```sql
CREATE TABLE player_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  association_id uuid REFERENCES associations NOT NULL,
  division text NOT NULL,
  player_order uuid[] NOT NULL,  -- Ordered array of player IDs
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, association_id, division)
);
```

### New: `player_hearts` table

```sql
CREATE TABLE player_hearts (
  user_id uuid REFERENCES auth.users NOT NULL,
  player_id uuid REFERENCES tryout_players NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);
```

### New: `user_tracked_groups` table

Stores the custom group label and active division/association selection per user:

```sql
CREATE TABLE user_tracked_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  association_id uuid REFERENCES associations NOT NULL,
  division text NOT NULL,
  label text NOT NULL,  -- Custom name like "Wildcats U15"
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, association_id, division)
);
```

### Player ID

Every player has a **UUID primary key** (`tryout_players.id`) separate from their jersey number. The jersey number is a display field only; the UUID is used for all internal references (predictions, hearts, corrections).

---

## Status Badge Colors

Status badges are **not displayed in player rows** on the prediction board. They appear only on the Player Detail page and in the Previous Teams view. Colors use the Desert Monolith palette where possible, with functional color exceptions for clarity.

| Status | Background | Text | Hex (bg / text) |
|--------|-----------|------|-----------------|
| Registered | Gold 12% | Gold | `rgba(158,123,47,0.12)` / `#9E7B2F` |
| Trying Out | Green 10% | Dark green | `rgba(46,125,50,0.10)` / `#2e7d32` |
| Made Team | Green 10% | Dark green | `rgba(46,125,50,0.10)` / `#2e7d32` |
| Cut | Cinnabar 10% | Cinnabar | `rgba(184,58,42,0.10)` / `#B83A2A` |
| Moved Up | Green 10% | Dark green | `rgba(46,125,50,0.10)` / `#2e7d32` |
| Moved Down | Cinnabar 10% | Cinnabar | `rgba(184,58,42,0.10)` / `#B83A2A` |
| Withdrew | Dust 12% | Dust | `rgba(184,160,106,0.12)` / `#B8A06A` |

---

## Navigation & Routing

### (app) Route Group

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Home | Landing page after login, basic stats |
| `/teams` | Teams | Prediction board (this spec) |
| `/teams/[playerId]` | Player Detail | Full player info, correction form |
| `/corrections` | My Corrections | List of parent's submitted corrections |
| `/join` | Join | Enter join code for an association |
| `/settings` | Settings | Profile, tracked groups, privacy |

### Route Group Layout

`(app)/layout.tsx`:
- Validates authenticated session (redirects to /login if not)
- Renders bottom navigation bar (Home, Teams, More)
- Provides association/division context from active tracked group

---

## Component Hierarchy

```
(app)/layout.tsx [Server: auth check, context]
├── BottomNav [Client: tab navigation]
│
├── /teams (page.tsx) [Server: fetch players + teams]
│   ├── TeamsHeader [Server: group label, title, avatar]
│   ├── ViewToggle [Client: Predictions / Previous Teams switch]
│   ├── InstructionLine [Server: static text]
│   │
│   ├── PredictionBoard [Client: drag-and-drop ranking]
│   │   ├── OfficialTeamSection (collapsible, per team)
│   │   │   └── PlayerRow (locked, no drag handle)
│   │   └── PredictedTeamSection (collapsible, per team)
│   │       └── PlayerRow (draggable)
│   │           ├── DragHandle
│   │           ├── JerseyNumber
│   │           ├── PositionBadge (F/D/G)
│   │           ├── PlayerName
│   │           └── PreviousTeam
│   │
│   └── PreviousTeamsView [Client: grouped read-only list]
│       └── PreviousTeamSection (per previous team)
│           └── PlayerRow (read-only, with movement arrow)
│
├── /teams/[playerId] (page.tsx) [Server: fetch player]
│   ├── PlayerDetail [Server: full player info]
│   └── CorrectionForm [Client: submit correction]
│
└── LongPressMenu [Client: bottom sheet overlay]
    ├── AddToFriends action
    ├── ViewPlayerDetails action (navigates)
    └── SubmitCorrection action (opens form)
```

---

## Interaction Summary

| Interaction | Action |
|-------------|--------|
| Drag handle on player row | Reorder player in prediction ranking |
| Tap official team header | Expand/collapse official team |
| Tap predicted team header | Expand/collapse predicted team |
| Long-press player row | Open context menu (heart, details, correction) |
| Long-press team header | Heart/unheart all players in that group |
| Toggle Predictions/Previous Teams | Switch between interactive and read-only views |
| More menu | Switch association, division, access corrections/settings |

---

## Visual Style Guide

Design system: **Desert Monolith**. Full system definition in `docs/design-system-desert-monolith.md`. CSS custom properties in `frontend/app/globals.css`.

### Palette

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| Gold | `#9E7B2F` | `oklch(0.602 0.102 83.6)` | Brand, headings, active states, jersey numbers |
| Light Gold | `#C9A84C` | `oklch(0.743 0.117 89.5)` | Bottom nav active, hover, decorative |
| Cinnabar | `#B83A2A` | `oklch(0.531 0.165 30.5)` | CTAs, buttons, destructive actions |
| Parchment | `#FBF6ED` | `oklch(0.975 0.013 82.4)` | Page background, player row background |
| Dune | `#F2E8D0` | `oklch(0.933 0.033 88.1)` | Team header tone 1, card surfaces |
| Dune Alt | `#EBE0C4` | `oklch(0.908 0.039 89.1)` | Team header tone 2 (alternating) |
| Umber | `#2A2117` | `oklch(0.255 0.022 69.5)` | Primary text, bottom nav background |
| Dust | `#B8A06A` | `oklch(0.714 0.077 86.5)` | Muted text, labels, placeholders |
| Official Green | `#2e7d32` | `oklch(0.523 0.135 144.2)` | Official badge only (functional exception) |

### Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Headings | Outfit | 600-700 | Page title, team names, nav labels |
| Body | Outfit | 400-500 | Player names, descriptions |
| Data | IBM Plex Mono | 400-500 | Jersey numbers, counts, badges, previous team |
| Drama | Fraunces Italic | 400-700 | Hero text only (28px+, not used on Teams page) |

### Borders

All borders are gold-tinted, never gray: `oklch(0.743 0.117 89.5 / 12%)`. Player row separators use 8% opacity. No left borders on team sections.

### Bottom Navigation

- **Background**: Umber (dark section)
- **Active tab**: Light Gold `#C9A84C`, no underline
- **Inactive tabs**: Light Gold at 50% opacity
- **Height**: 70px + safe-area padding

### Team Section Headers

- Stack flush with zero gap between sections
- Alternating backgrounds: Dune (`#F2E8D0`) and Dune Alt (`#EBE0C4`)
- Separated by 1px gold-tinted border-top at 10% opacity
- Official badge: green checkmark, sentence case
- Prediction badge: gold, sentence case

### Player Row Layout

Edge-to-edge, 20px horizontal padding, 8px vertical padding. Elements in order: drag handle (Dust, 50% opacity) → jersey # (Gold, Plex Mono) → position badge (F/D/G, Gold-tinted bg) → player name (Umber, Outfit 500) → previous team (Dust, Plex Mono, condensed like "U13AA").

### App Header

56px height, Parchment at 85% opacity with 20px backdrop blur. Gold-tinted bottom border. "Teams" title absolutely centered. Group label in Gold on the left, avatar gradient (Gold → Light Gold) on the right.

---

## Technical Notes

- **Drag-and-drop library**: Use a lightweight library compatible with React 19 and mobile touch events (e.g. `@dnd-kit/core`).
- **Prediction storage**: The `player_order` array in `player_predictions` stores the full ordered list of player UUIDs. On the client, team boundaries are computed from roster sizes.
- **Optimistic updates**: Drag reordering updates local state immediately, debounced save to database.
- **RLS**: `player_predictions` and `player_hearts` use `user_id = auth.uid()` policies. Parents can only read/write their own data.
- **No search on Teams page**: Search is deliberately omitted to keep the prediction board focused on ordering. Player lookup can be done via the More menu or a future search page.
