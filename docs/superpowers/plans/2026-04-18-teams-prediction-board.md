# Teams Prediction Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the (app) route group with the Teams prediction board — the core parent-facing feature where parents rank players into projected team rosters.

**Architecture:** Server component pages fetch data and pass to client component children. Mock data used until Supabase is connected. CSS classes already defined in `globals.css` — components reference them directly. All interactive state (drag-and-drop, view toggle, collapsible sections) lives in client components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4, @dnd-kit/core for drag-and-drop, Lucide icons. No semicolons. Single Tailwind class max in JSX — use `globals.css` classes.

---

## File Structure

```
frontend/
├── app/
│   ├── layout.tsx                          # MODIFY: Replace Geist fonts with Outfit + IBM Plex Mono
│   └── (app)/
│       ├── layout.tsx                      # CREATE: Auth check + bottom nav + header shell
│       ├── dashboard/page.tsx              # CREATE: Placeholder dashboard
│       └── teams/
│           ├── page.tsx                    # CREATE: Server component, fetches data, renders board
│           └── [playerId]/page.tsx         # CREATE: Player detail page
├── components/
│   ├── layout/
│   │   ├── bottom-nav.tsx                  # CREATE: Dark bottom tab bar (Home/Teams/More)
│   │   └── teams-header.tsx                # CREATE: Group label + "Teams" title + avatar
│   └── teams/
│       ├── view-toggle.tsx                 # CREATE: Predictions / Previous Teams segmented control
│       ├── player-row.tsx                  # CREATE: Single player row (drag handle, jersey, position, name, prev team)
│       ├── team-section.tsx                # CREATE: Collapsible team section (official or predicted)
│       ├── prediction-board.tsx            # CREATE: Full drag-and-drop prediction board
│       ├── previous-teams-view.tsx         # CREATE: Read-only grouped-by-previous-team list
│       └── long-press-menu.tsx             # CREATE: Bottom sheet context menu
├── lib/
│   └── mock-data.ts                        # CREATE: Realistic mock players + teams for dev
└── types/
    └── index.ts                            # CREATE: App-level domain types (Player, Team, etc.)
```

---

## Task 1: Configure Fonts (Outfit + IBM Plex Mono)

**Files:**
- Modify: `frontend/app/layout.tsx`

The root layout uses Geist fonts. Replace with Outfit (headings + body) and IBM Plex Mono (data). The CSS vars `--font-sans` and `--font-mono` in `globals.css` already reference `--font-outfit` and `--font-ibm-plex-mono`.

- [ ] **Step 1: Update root layout fonts**

Replace `Geist` and `Geist_Mono` imports with `Outfit` and `IBM_Plex_Mono` from `next/font/google`. Map CSS variables to `--font-outfit` and `--font-ibm-plex-mono`.

```tsx
import type { Metadata } from "next"
import { Outfit, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Track Master",
  description: "Hockey tryout tracking for parents and associations",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update globals.css font references**

In `globals.css`, the `@theme inline` block sets `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)`. These are stale references from the old Geist setup. Update them:

```css
--font-sans: var(--font-outfit);
--font-mono: var(--font-ibm-plex-mono);
```

Find the two lines in the `@theme inline` block and replace. Leave `--font-drama` as-is (Fraunces not needed yet).

- [ ] **Step 3: Verify build**

Run from `frontend/`:
```bash
npx tsc --noEmit && npm run build
```
Expected: No errors. Fonts load correctly.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css
git commit -m "feat: replace Geist fonts with Outfit and IBM Plex Mono"
```

---

## Task 2: Define Domain Types

**Files:**
- Create: `frontend/types/index.ts`

Define app-level types used by components. These extend the database types with fields from the spec (`position`, `previous_team`) that haven't been added to the DB schema yet.

- [ ] **Step 1: Create types file**

```ts
export type PlayerPosition = "F" | "D" | "G"

export type PlayerStatus =
  | "registered"
  | "trying_out"
  | "cut"
  | "made_team"
  | "moved_up"
  | "moved_down"
  | "withdrew"

export type Player = {
  id: string
  name: string
  jersey_number: string
  division: string
  status: PlayerStatus
  position: PlayerPosition | null
  previous_team: string | null
  team_id: string | null
  association_id: string
}

export type Team = {
  id: string
  name: string
  division: string
  display_order: number
  max_roster_size: number
  association_id: string
  is_official: boolean
}

export type TrackedGroup = {
  label: string
  association_id: string
  division: string
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/types/index.ts
git commit -m "feat: add domain types for Player, Team, TrackedGroup"
```

---

## Task 3: Create Mock Data

**Files:**
- Create: `frontend/lib/mock-data.ts`

Realistic data matching ORMH seed structure. Enough players (34) to fill two teams (AA=17, A=17) for the U13 division. Include mix of positions, previous teams, and one official team.

- [ ] **Step 1: Create mock data module**

```ts
import type { Player, Team, TrackedGroup } from "@/types"

export const mockTrackedGroup: TrackedGroup = {
  label: "Rangers U13",
  association_id: "a1000000-0000-0000-0000-000000000001",
  division: "U13",
}

export const mockTeams: Team[] = [
  {
    id: "t1000000-0000-0000-0000-000000000003",
    name: "AA",
    division: "U13",
    display_order: 1,
    max_roster_size: 17,
    association_id: "a1000000-0000-0000-0000-000000000001",
    is_official: true,
  },
  {
    id: "t1000000-0000-0000-0000-000000000004",
    name: "A",
    division: "U13",
    display_order: 2,
    max_roster_size: 17,
    association_id: "a1000000-0000-0000-0000-000000000001",
    is_official: false,
  },
]

function p(
  id: string,
  name: string,
  jersey: string,
  pos: "F" | "D" | "G",
  prev: string | null,
  status: Player["status"] = "trying_out",
  teamId: string | null = null,
): Player {
  return {
    id: `p100-${id}`,
    name,
    jersey_number: jersey,
    division: "U13",
    status,
    position: pos,
    previous_team: prev,
    team_id: teamId,
    association_id: "a1000000-0000-0000-0000-000000000001",
  }
}

export const mockPlayers: Player[] = [
  // U13 AA returners (high tier)
  p("01", "Noah Williams", "7", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("02", "Liam Johnson", "14", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("03", "Ethan Brown", "19", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("04", "Mason Davis", "4", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("05", "Lucas Wilson", "22", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("06", "Oliver Taylor", "9", "G", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("07", "James Anderson", "15", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("08", "Benjamin Thomas", "33", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("09", "Alexander Jackson", "11", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("10", "William White", "8", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("11", "Henry Harris", "27", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("12", "Sebastian Martin", "3", "D", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("13", "Jack Garcia", "21", "F", "U13AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("14", "Daniel Martinez", "16", "F", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("15", "Matthew Robinson", "25", "D", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("16", "Owen Clark", "31", "G", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  p("17", "Samuel Rodriguez", "10", "F", "U11AA", "made_team", "t1000000-0000-0000-0000-000000000003"),
  // A-level predictions (not yet official)
  p("18", "Aiden Lewis", "6", "F", "U13A"),
  p("19", "Jackson Lee", "17", "D", "U13A"),
  p("20", "Logan Walker", "23", "F", "U13A"),
  p("21", "Carter Hall", "2", "D", "U13A"),
  p("22", "Jayden Allen", "29", "G", "U13A"),
  p("23", "Dylan Young", "13", "F", "U13A"),
  p("24", "Luke King", "30", "F", "U11A"),
  p("25", "Ryan Wright", "5", "D", "U11A"),
  p("26", "Nathan Scott", "18", "F", "U11A"),
  p("27", "Caleb Adams", "24", "D", "U11A"),
  p("28", "Christian Baker", "26", "F", "U13A"),
  p("29", "Isaac Gonzalez", "20", "F", "U11A"),
  p("30", "Joshua Nelson", "28", "D", "U13A"),
  p("31", "Andrew Hill", "32", "G", "U11A"),
  p("32", "Christopher Moore", "34", "F", "U11BB"),
  p("33", "David Campbell", "35", "D", "U11BB"),
  p("34", "Joseph Mitchell", "36", "F", null),
]
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/mock-data.ts
git commit -m "feat: add mock player and team data for development"
```

---

## Task 4: BottomNav Component

**Files:**
- Create: `frontend/components/layout/bottom-nav.tsx`

Dark bottom tab bar with three tabs: Home, Teams, More. Uses CSS classes from `globals.css`. Client component because it needs `usePathname()` for active state.

- [ ] **Step 1: Create BottomNav**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Circle, MoreHorizontal } from "lucide-react"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/teams", label: "Teams", icon: Circle },
  { href: "#", label: "More", icon: MoreHorizontal },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href) && tab.href !== "#"
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={isActive ? "bottom-nav-item-active" : "bottom-nav-item"}
          >
            <tab.icon className="bottom-nav-icon" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/bottom-nav.tsx
git commit -m "feat: add BottomNav component with Home/Teams/More tabs"
```

---

## Task 5: TeamsHeader Component

**Files:**
- Create: `frontend/components/layout/teams-header.tsx`

Sticky header with group label (left, gold), "Teams" title (absolute center), avatar initials (right, gradient). Server component — no interactivity.

- [ ] **Step 1: Create TeamsHeader**

```tsx
type TeamsHeaderProps = {
  groupLabel: string
  initials: string
}

export function TeamsHeader({ groupLabel, initials }: TeamsHeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header-group-label">{groupLabel}</span>
      <span className="app-header-title">Teams</span>
      <div className="app-header-avatar">{initials}</div>
    </header>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/teams-header.tsx
git commit -m "feat: add TeamsHeader with group label, title, avatar"
```

---

## Task 6: (app) Layout

**Files:**
- Create: `frontend/app/(app)/layout.tsx`

Server component layout that wraps all authenticated parent pages. Checks for a valid session, redirects to `/login` if not authenticated. Renders the BottomNav. Adds bottom padding so content doesn't hide behind the fixed nav.

- [ ] **Step 1: Create (app) layout**

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BottomNav } from "@/components/layout/bottom-nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="app-shell">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Add app-shell class to globals.css**

Add at the end of `globals.css`, before the closing of the file:

```css
/* ============================================================
   App Shell
   ============================================================ */

.app-shell {
  @apply min-h-screen;
  padding-bottom: calc(70px + env(safe-area-inset-bottom));
  background: var(--dm-parchment);
}
```

- [ ] **Step 3: Create placeholder dashboard page**

Create `frontend/app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="dashboard-placeholder">
      <h1 className="dashboard-placeholder-title">Home</h1>
      <p className="dashboard-placeholder-text">Dashboard coming soon</p>
    </div>
  )
}
```

Add dashboard placeholder styles to `globals.css`:

```css
.dashboard-placeholder {
  @apply flex min-h-[60vh] flex-col items-center justify-center gap-2;
}

.dashboard-placeholder-title {
  @apply text-2xl font-bold;
  color: var(--dm-umber);
}

.dashboard-placeholder-text {
  @apply text-sm;
  color: var(--dm-dust);
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/layout.tsx frontend/app/(app)/dashboard/page.tsx frontend/app/globals.css
git commit -m "feat: add (app) layout with auth check, BottomNav, placeholder dashboard"
```

---

## Task 7: ViewToggle Component

**Files:**
- Create: `frontend/components/teams/view-toggle.tsx`

Client component. Segmented control switching between "Predictions" and "Previous Teams". Manages its own state and calls a parent callback.

- [ ] **Step 1: Create ViewToggle**

```tsx
"use client"

type ViewToggleProps = {
  activeView: "predictions" | "previous"
  onViewChange: (view: "predictions" | "previous") => void
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={activeView === "predictions" ? "view-toggle-btn-active" : "view-toggle-btn"}
        onClick={() => onViewChange("predictions")}
      >
        Predictions
      </button>
      <button
        className={activeView === "previous" ? "view-toggle-btn-active" : "view-toggle-btn"}
        onClick={() => onViewChange("previous")}
      >
        Previous Teams
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/teams/view-toggle.tsx
git commit -m "feat: add ViewToggle segmented control"
```

---

## Task 8: PlayerRow Component

**Files:**
- Create: `frontend/components/teams/player-row.tsx`

Renders a single player row. Props control whether drag handle is shown (predicted) or lock icon (official). Uses CSS classes from `globals.css`. Client component (needed for long-press and drag later).

- [ ] **Step 1: Create PlayerRow**

```tsx
"use client"

import { GripVertical, Lock } from "lucide-react"
import type { Player } from "@/types"

type PlayerRowProps = {
  player: Player
  isLocked: boolean
  onLongPress?: (player: Player) => void
}

export function PlayerRow({ player, isLocked, onLongPress }: PlayerRowProps) {
  return (
    <div
      className="player-row"
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress?.(player)
      }}
    >
      <span className="player-drag-handle">
        {isLocked ? <Lock size={14} /> : <GripVertical size={14} />}
      </span>
      <span className="player-jersey">#{player.jersey_number}</span>
      {player.position && (
        <span className="player-position">{player.position}</span>
      )}
      <span className="player-name">{player.name}</span>
      {player.previous_team && (
        <span className="player-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/teams/player-row.tsx
git commit -m "feat: add PlayerRow component with drag handle and position badge"
```

---

## Task 9: TeamSection Component

**Files:**
- Create: `frontend/components/teams/team-section.tsx`

Collapsible section for a team. Handles both official (green badge, collapsed by default) and predicted (gold badge, expanded by default). Alternating header tones via index prop.

- [ ] **Step 1: Create TeamSection**

```tsx
"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Player } from "@/types"
import { PlayerRow } from "./player-row"

type TeamSectionProps = {
  teamName: string
  players: Player[]
  isOfficial: boolean
  index: number
  onPlayerLongPress?: (player: Player) => void
}

export function TeamSection({
  teamName,
  players,
  isOfficial,
  index,
  onPlayerLongPress,
}: TeamSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!isOfficial)
  const toneClass = index % 2 === 0 ? "team-header-tone-1" : "team-header-tone-2"

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">{teamName}</span>
          <span className="team-count">{players.length} Players</span>
        </div>
        <div className="team-header-right">
          <span className={`team-badge ${isOfficial ? "team-badge-official" : "team-badge-prediction"}`}>
            {isOfficial ? "✓ Official" : "Prediction"}
          </span>
          <ChevronDown
            size={16}
            className="team-chevron"
            style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </button>
      {isExpanded && (
        <div>
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              isLocked={isOfficial}
              onLongPress={onPlayerLongPress}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add team-header-right class to globals.css**

After the `.team-header-left` class in `globals.css`:

```css
.team-header-right {
  @apply flex items-center gap-2;
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/teams/team-section.tsx frontend/app/globals.css
git commit -m "feat: add collapsible TeamSection with official/prediction badges"
```

---

## Task 10: PredictionBoard Component

**Files:**
- Create: `frontend/components/teams/prediction-board.tsx`

Client component that takes the full player list and team definitions, splits players into team sections by rank order, and renders TeamSection components. No drag-and-drop yet — just the static layout.

- [ ] **Step 1: Create PredictionBoard**

```tsx
"use client"

import type { Player, Team } from "@/types"
import { TeamSection } from "./team-section"

type PredictionBoardProps = {
  players: Player[]
  teams: Team[]
  onPlayerLongPress?: (player: Player) => void
}

export function PredictionBoard({ players, teams, onPlayerLongPress }: PredictionBoardProps) {
  const sortedTeams = [...teams].sort((a, b) => a.display_order - b.display_order)

  // Split players into official (assigned to a team) and predicted (unassigned)
  const officialByTeam = new Map<string, Player[]>()
  const predictedPlayers: Player[] = []

  for (const player of players) {
    const officialTeam = sortedTeams.find(
      (t) => t.is_official && t.id === player.team_id
    )
    if (officialTeam) {
      const existing = officialByTeam.get(officialTeam.id) ?? []
      existing.push(player)
      officialByTeam.set(officialTeam.id, existing)
    } else {
      predictedPlayers.push(player)
    }
  }

  // Build sections: official teams first (locked), then predicted teams from remaining players
  const sections: {
    teamName: string
    players: Player[]
    isOfficial: boolean
  }[] = []

  for (const team of sortedTeams) {
    const official = officialByTeam.get(team.id)
    if (official && official.length > 0) {
      sections.push({
        teamName: team.name,
        players: official,
        isOfficial: true,
      })
    }
  }

  // Distribute remaining players across predicted teams
  const predictedTeams = sortedTeams.filter((t) => !t.is_official)
  let offset = 0
  for (const team of predictedTeams) {
    const slice = predictedPlayers.slice(offset, offset + team.max_roster_size)
    if (slice.length > 0) {
      sections.push({
        teamName: team.name,
        players: slice,
        isOfficial: false,
      })
      offset += team.max_roster_size
    }
  }

  return (
    <div>
      {sections.map((section, i) => (
        <TeamSection
          key={`${section.teamName}-${section.isOfficial}`}
          teamName={section.teamName}
          players={section.players}
          isOfficial={section.isOfficial}
          index={i}
          onPlayerLongPress={onPlayerLongPress}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/teams/prediction-board.tsx
git commit -m "feat: add PredictionBoard with team section distribution logic"
```

---

## Task 11: PreviousTeamsView Component

**Files:**
- Create: `frontend/components/teams/previous-teams-view.tsx`

Read-only view grouping players by their previous team. Shows movement arrows and status badges. Client component for the collapsible sections.

- [ ] **Step 1: Create PreviousTeamsView**

```tsx
"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Player } from "@/types"

type PreviousTeamsViewProps = {
  players: Player[]
}

function groupByPreviousTeam(players: Player[]): Map<string, Player[]> {
  const groups = new Map<string, Player[]>()
  for (const player of players) {
    const key = player.previous_team ?? "Unknown"
    const existing = groups.get(key) ?? []
    existing.push(player)
    groups.set(key, existing)
  }
  return groups
}

function PreviousTeamSection({
  label,
  players,
  index,
}: {
  label: string
  players: Player[]
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const toneClass = index % 2 === 0 ? "team-header-tone-1" : "team-header-tone-2"

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">From {label}</span>
          <span className="team-count">{players.length} Players</span>
        </div>
        <ChevronDown
          size={16}
          className="team-chevron"
          style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {isExpanded && (
        <div>
          {players.map((player) => (
            <div key={player.id} className="player-row">
              <span className="player-jersey">#{player.jersey_number}</span>
              {player.position && (
                <span className="player-position">{player.position}</span>
              )}
              <span className="player-name">{player.name}</span>
              <span className="prev-teams-status">{formatStatus(player.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatStatus(status: Player["status"]): string {
  const labels: Record<Player["status"], string> = {
    registered: "Registered",
    trying_out: "Trying Out",
    cut: "Cut",
    made_team: "Made Team",
    moved_up: "Moved Up",
    moved_down: "Moved Down",
    withdrew: "Withdrew",
  }
  return labels[status]
}

export function PreviousTeamsView({ players }: PreviousTeamsViewProps) {
  const groups = groupByPreviousTeam(players)

  return (
    <div>
      {Array.from(groups.entries()).map(([label, groupPlayers], i) => (
        <PreviousTeamSection
          key={label}
          label={label}
          players={groupPlayers}
          index={i}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add prev-teams-status class to globals.css**

After the `.player-prev-team` class:

```css
.prev-teams-status {
  @apply flex-shrink-0 text-xs;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--dm-dust);
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/teams/previous-teams-view.tsx frontend/app/globals.css
git commit -m "feat: add PreviousTeamsView with grouped player list"
```

---

## Task 12: Teams Page (Server Component)

**Files:**
- Create: `frontend/app/(app)/teams/page.tsx`
- Create: `frontend/components/teams/teams-page-client.tsx`

The page is a server component that fetches data (mock for now). It renders the TeamsHeader and passes data to a client component that manages view toggle state and renders either PredictionBoard or PreviousTeamsView.

- [ ] **Step 1: Create the client wrapper**

`frontend/components/teams/teams-page-client.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { Player, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"

type TeamsPageClientProps = {
  players: Player[]
  teams: Team[]
}

export function TeamsPageClient({ players, teams }: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")

  return (
    <>
      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>
      {activeView === "predictions" ? (
        <PredictionBoard players={players} teams={teams} />
      ) : (
        <PreviousTeamsView players={players} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Create the server page**

`frontend/app/(app)/teams/page.tsx`:

```tsx
import { TeamsHeader } from "@/components/layout/teams-header"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import { mockPlayers, mockTeams, mockTrackedGroup } from "@/lib/mock-data"

export default function TeamsPage() {
  // TODO: Replace with Supabase query when backend is connected
  const players = mockPlayers
  const teams = mockTeams
  const group = mockTrackedGroup

  return (
    <>
      <TeamsHeader groupLabel={group.label} initials="JD" />
      <TeamsPageClient players={players} teams={teams} />
    </>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: No errors. The Teams page renders with mock data.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(app)/teams/page.tsx frontend/components/teams/teams-page-client.tsx
git commit -m "feat: add Teams page with mock data, prediction board, and previous teams view"
```

---

## Task 13: Install @dnd-kit and Add Drag-and-Drop

**Files:**
- Modify: `frontend/components/teams/prediction-board.tsx`
- Modify: `frontend/components/teams/player-row.tsx`
- Modify: `frontend/components/teams/team-section.tsx`

Install `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop reordering. Wrap the prediction board in DndContext, make predicted PlayerRows sortable, keep official rows static.

- [ ] **Step 1: Install @dnd-kit**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Update PlayerRow for sortable**

Replace `frontend/components/teams/player-row.tsx`:

```tsx
"use client"

import { GripVertical, Lock } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Player } from "@/types"

type PlayerRowProps = {
  player: Player
  isLocked: boolean
  onLongPress?: (player: Player) => void
}

export function PlayerRow({ player, isLocked, onLongPress }: PlayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    disabled: isLocked,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="player-row"
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress?.(player)
      }}
    >
      <span
        className="player-drag-handle"
        {...(isLocked ? {} : { ...attributes, ...listeners })}
      >
        {isLocked ? <Lock size={14} /> : <GripVertical size={14} />}
      </span>
      <span className="player-jersey">#{player.jersey_number}</span>
      {player.position && (
        <span className="player-position">{player.position}</span>
      )}
      <span className="player-name">{player.name}</span>
      {player.previous_team && (
        <span className="player-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update TeamSection to use SortableContext**

Replace `frontend/components/teams/team-section.tsx`:

```tsx
"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Player } from "@/types"
import { PlayerRow } from "./player-row"

type TeamSectionProps = {
  teamName: string
  players: Player[]
  isOfficial: boolean
  index: number
  onPlayerLongPress?: (player: Player) => void
}

export function TeamSection({
  teamName,
  players,
  isOfficial,
  index,
  onPlayerLongPress,
}: TeamSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!isOfficial)
  const toneClass = index % 2 === 0 ? "team-header-tone-1" : "team-header-tone-2"

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">{teamName}</span>
          <span className="team-count">{players.length} Players</span>
        </div>
        <div className="team-header-right">
          <span className={`team-badge ${isOfficial ? "team-badge-official" : "team-badge-prediction"}`}>
            {isOfficial ? "✓ Official" : "Prediction"}
          </span>
          <ChevronDown
            size={16}
            className="team-chevron"
            style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </button>
      {isExpanded && (
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              isLocked={isOfficial}
              onLongPress={onPlayerLongPress}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update PredictionBoard with DndContext**

Replace `frontend/components/teams/prediction-board.tsx`:

```tsx
"use client"

import { useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { Player, Team } from "@/types"
import { TeamSection } from "./team-section"

type PredictionBoardProps = {
  players: Player[]
  teams: Team[]
  onPlayerLongPress?: (player: Player) => void
}

export function PredictionBoard({ players, teams, onPlayerLongPress }: PredictionBoardProps) {
  const sortedTeams = [...teams].sort((a, b) => a.display_order - b.display_order)

  // Split official players from predicted pool
  const officialByTeam = new Map<string, Player[]>()
  const initialPredicted: Player[] = []

  for (const player of players) {
    const officialTeam = sortedTeams.find(
      (t) => t.is_official && t.id === player.team_id
    )
    if (officialTeam) {
      const existing = officialByTeam.get(officialTeam.id) ?? []
      existing.push(player)
      officialByTeam.set(officialTeam.id, existing)
    } else {
      initialPredicted.push(player)
    }
  }

  const [predictedOrder, setPredictedOrder] = useState<Player[]>(initialPredicted)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setPredictedOrder((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id)
      const newIndex = prev.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  // Build sections
  const sections: {
    key: string
    teamName: string
    players: Player[]
    isOfficial: boolean
  }[] = []

  for (const team of sortedTeams) {
    const official = officialByTeam.get(team.id)
    if (official && official.length > 0) {
      sections.push({
        key: `official-${team.id}`,
        teamName: team.name,
        players: official,
        isOfficial: true,
      })
    }
  }

  // Distribute predicted players across remaining teams
  const predictedTeams = sortedTeams.filter((t) => !t.is_official)
  let offset = 0
  for (const team of predictedTeams) {
    const slice = predictedOrder.slice(offset, offset + team.max_roster_size)
    if (slice.length > 0) {
      sections.push({
        key: `predicted-${team.id}`,
        teamName: team.name,
        players: slice,
        isOfficial: false,
      })
      offset += team.max_roster_size
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {sections.map((section, i) => (
        <TeamSection
          key={section.key}
          teamName={section.teamName}
          players={section.players}
          isOfficial={section.isOfficial}
          index={i}
          onPlayerLongPress={onPlayerLongPress}
        />
      ))}
    </DndContext>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: No errors. Drag-and-drop functional in dev server.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/components/teams/player-row.tsx frontend/components/teams/team-section.tsx frontend/components/teams/prediction-board.tsx
git commit -m "feat: add drag-and-drop reordering with @dnd-kit"
```

---

## Task 14: LongPressMenu (Bottom Sheet)

**Files:**
- Create: `frontend/components/teams/long-press-menu.tsx`
- Modify: `frontend/components/teams/teams-page-client.tsx`

A bottom sheet overlay triggered by long-press (context menu) on a player row. Shows player info and action buttons: Add to Friends, View Details, Submit Correction.

- [ ] **Step 1: Add long-press-menu styles to globals.css**

```css
/* ============================================================
   Long Press Menu (Bottom Sheet)
   ============================================================ */

.long-press-overlay {
  @apply fixed inset-0 z-20;
  background: oklch(0.255 0.022 69.5 / 40%);
  animation: fadeIn 150ms ease-out;
}

.long-press-sheet {
  @apply fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl px-5 pb-8 pt-4;
  background: var(--dm-parchment);
  box-shadow: var(--dm-shadow-lg);
  animation: slideUp 200ms ease-out;
}

.long-press-header {
  @apply mb-4 border-b pb-3;
  border-color: var(--dm-border);
}

.long-press-player-name {
  @apply text-base font-bold;
  color: var(--dm-umber);
}

.long-press-player-info {
  @apply mt-0.5 text-xs;
  color: var(--dm-dust);
  font-family: var(--font-mono);
}

.long-press-action {
  @apply flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium;
  color: var(--dm-umber);
  transition: background 150ms ease-out;
}

.long-press-action:hover {
  background: var(--dm-dune);
}

.long-press-action-icon {
  @apply flex-shrink-0;
  color: var(--dm-gold);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

- [ ] **Step 2: Create LongPressMenu component**

```tsx
"use client"

import { Heart, User, FileEdit } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Player } from "@/types"

type LongPressMenuProps = {
  player: Player
  onClose: () => void
}

function formatStatus(status: Player["status"]): string {
  const labels: Record<Player["status"], string> = {
    registered: "Registered",
    trying_out: "Trying Out",
    cut: "Cut",
    made_team: "Made Team",
    moved_up: "Moved Up",
    moved_down: "Moved Down",
    withdrew: "Withdrew",
  }
  return labels[status]
}

export function LongPressMenu({ player, onClose }: LongPressMenuProps) {
  const router = useRouter()

  return (
    <>
      <div className="long-press-overlay" onClick={onClose} />
      <div className="long-press-sheet">
        <div className="long-press-header">
          <div className="long-press-player-name">
            #{player.jersey_number} {player.name}
          </div>
          <div className="long-press-player-info">
            {player.previous_team ?? player.division} · {formatStatus(player.status)}
          </div>
        </div>
        <button className="long-press-action" onClick={onClose}>
          <Heart size={18} className="long-press-action-icon" />
          <span>Add to Friends</span>
        </button>
        <button
          className="long-press-action"
          onClick={() => router.push(`/teams/${player.id}`)}
        >
          <User size={18} className="long-press-action-icon" />
          <span>View Player Details</span>
        </button>
        <button className="long-press-action" onClick={onClose}>
          <FileEdit size={18} className="long-press-action-icon" />
          <span>Submit Correction</span>
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Wire LongPressMenu into TeamsPageClient**

Replace `frontend/components/teams/teams-page-client.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { Player, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"

type TeamsPageClientProps = {
  players: Player[]
  teams: Team[]
}

export function TeamsPageClient({ players, teams }: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  return (
    <>
      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>
      {activeView === "predictions" ? (
        <PredictionBoard
          players={players}
          teams={teams}
          onPlayerLongPress={setSelectedPlayer}
        />
      ) : (
        <PreviousTeamsView players={players} />
      )}
      {selectedPlayer && (
        <LongPressMenu
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/teams/long-press-menu.tsx frontend/components/teams/teams-page-client.tsx frontend/app/globals.css
git commit -m "feat: add LongPressMenu bottom sheet with player actions"
```

---

## Task 15: Player Detail Page

**Files:**
- Create: `frontend/app/(app)/teams/[playerId]/page.tsx`

Shows full player information. Server component. Uses mock data for now (finds player by ID from mock list).

- [ ] **Step 1: Add player-detail styles to globals.css**

```css
/* ============================================================
   Player Detail Page
   ============================================================ */

.player-detail {
  @apply px-5 py-6;
}

.player-detail-back {
  @apply mb-4 flex items-center gap-1 text-sm font-medium;
  color: var(--dm-gold);
}

.player-detail-name {
  @apply text-2xl font-bold;
  color: var(--dm-umber);
}

.player-detail-jersey {
  @apply mt-1 text-lg font-medium;
  font-family: var(--font-mono);
  color: var(--dm-gold);
}

.player-detail-grid {
  @apply mt-6 grid grid-cols-2 gap-4;
}

.player-detail-field {
  @apply flex flex-col gap-1 rounded-xl p-3;
  background: var(--dm-dune);
}

.player-detail-label {
  @apply text-xs uppercase;
  font-family: var(--font-mono);
  color: var(--dm-dust);
  letter-spacing: 0.08em;
  font-size: 10px;
}

.player-detail-value {
  @apply text-sm font-medium;
  color: var(--dm-umber);
}
```

- [ ] **Step 2: Create player detail page**

```tsx
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { mockPlayers } from "@/lib/mock-data"

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params

  // TODO: Replace with Supabase query
  const player = mockPlayers.find((p) => p.id === playerId)

  if (!player) {
    return (
      <div className="player-detail">
        <p className="player-detail-value">Player not found</p>
      </div>
    )
  }

  return (
    <div className="player-detail">
      <Link href="/teams" className="player-detail-back">
        <ArrowLeft size={16} />
        <span>Back to Teams</span>
      </Link>
      <h1 className="player-detail-name">{player.name}</h1>
      <p className="player-detail-jersey">#{player.jersey_number}</p>
      <div className="player-detail-grid">
        <div className="player-detail-field">
          <span className="player-detail-label">Division</span>
          <span className="player-detail-value">{player.division}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Position</span>
          <span className="player-detail-value">{player.position ?? "—"}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Status</span>
          <span className="player-detail-value">{formatStatus(player.status)}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Previous Team</span>
          <span className="player-detail-value">{player.previous_team ?? "—"}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(app)/teams/\[playerId\]/page.tsx frontend/app/globals.css
git commit -m "feat: add player detail page with info grid"
```

---

## Task 16: Final Build Verification and Lint

**Files:** None (verification only)

- [ ] **Step 1: Run type checker**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run linter**

```bash
cd frontend && npm run lint
```
Expected: No errors (or only pre-existing warnings).

- [ ] **Step 3: Run production build**

```bash
cd frontend && npm run build
```
Expected: All pages compile. Output shows routes:
- `/(app)/dashboard`
- `/(app)/teams`
- `/(app)/teams/[playerId]`

- [ ] **Step 4: Visual check via dev server**

```bash
cd frontend && npm run dev
```
Open `http://localhost:3000/teams` — verify:
- Header shows "Rangers U13" left, "Teams" center, "JD" avatar right
- View toggle shows Predictions (active) and Previous Teams
- Instruction line visible
- AA section collapsed with "✓ Official" green badge
- A section expanded with "Prediction" gold badge
- Player rows show drag handle, jersey #, position badge, name, previous team
- Bottom nav shows Home / Teams / More tabs
- Long-press (right-click) opens bottom sheet menu
- Clicking "View Player Details" navigates to player detail page
- Dragging players reorders them within/across predicted sections

- [ ] **Step 5: Commit any lint fixes if needed**

```bash
git add -u
git commit -m "fix: lint and type fixes from final verification"
```
