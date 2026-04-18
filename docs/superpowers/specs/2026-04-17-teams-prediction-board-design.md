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

Each team level is displayed as a collapsible section:

**Official teams** (admin-announced):
- Solid green left border
- Green "OFFICIAL" badge
- Collapsed by default (tap to expand)
- Shows roster count: "17/17"
- Players within are locked, not draggable

**Predicted teams** (parent's ranking):
- Dashed blue left border
- Blue "PREDICTION" badge
- Expanded by default (collapsible)
- Shows: "17 predicted"
- Players are draggable via drag handles

Teams are always ordered top-down: AA, A, BB, B, C (matching the real tryout structure).

### Player Row

Each row in the prediction list shows (left to right):

| Element | Description |
|---------|-------------|
| Drag handle | Grip icon for reordering (hidden on official/locked rows) |
| Heart | Red heart if hearted as friend, empty otherwise |
| Jersey number | Prefixed with # (e.g. #16) |
| Player name | Full name, truncated with ellipsis if too long |
| Previous team | Short label (e.g. "U13 A") |
| Status pill | Colored badge: Trying Out, Registered, Made Team, Cut, etc. |

**No rank numbers are displayed.** The position in the list IS the rank.

### Reordering

- **Drag handle**: Press and drag the grip icon on the left side of any predicted row to move it up or down.
- Dragging a player across a team boundary moves them between predicted teams.
- Official/locked players cannot be dragged.

### Official Team Announcements

When an admin announces a team (e.g. AA):

1. AA section changes from predicted (dashed blue) to official (solid green).
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

Stores the full previous team label (e.g. "U13 AA", "U15 Minor A"). Free text since players may come from other associations.

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

| Status | Background | Text |
|--------|-----------|------|
| Registered | Warm yellow | Dark amber |
| Trying Out | Light green | Dark green |
| Made Team | Light blue | Dark blue |
| Cut | Light red | Dark red |
| Moved Up | Light indigo | Dark indigo |
| Moved Down | Light pink | Dark pink |
| Withdrew | Light gray | Dark gray |

*Exact color values will be set during styling phase.*

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
│   │           ├── HeartIcon
│   │           ├── JerseyNumber
│   │           ├── PlayerName
│   │           ├── PreviousTeam
│   │           └── StatusBadge
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

## Scope Note

**Styling is intentionally not specified here.** The layout, functionality, and interaction patterns are locked. Visual styling (colors, fonts, spacing, shadows, border styles) will be defined in a separate styling pass.

---

## Technical Notes

- **Drag-and-drop library**: Use a lightweight library compatible with React 19 and mobile touch events (e.g. `@dnd-kit/core`).
- **Prediction storage**: The `player_order` array in `player_predictions` stores the full ordered list of player UUIDs. On the client, team boundaries are computed from roster sizes.
- **Optimistic updates**: Drag reordering updates local state immediately, debounced save to database.
- **RLS**: `player_predictions` and `player_hearts` use `user_id = auth.uid()` policies. Parents can only read/write their own data.
- **No search on Teams page**: Search is deliberately omitted to keep the prediction board focused on ordering. Player lookup can be done via the More menu or a future search page.
