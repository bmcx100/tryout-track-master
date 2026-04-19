# Session 2: Parent Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete parent-facing experience: join an association via code, view the player list grouped by division, set private team projections via drag-and-drop, and see a dashboard with basic stats. All pages query real Supabase data — no mock data.

**Architecture:** Server components fetch data via `@supabase/ssr` server client and pass to client component children. Auth helpers from `lib/auth.ts` (built in Session 1) resolve the user's association. The existing prediction board components are rewired from mock data to Supabase queries. Player predictions are saved to `player_predictions` table with debounced upserts.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5, Supabase (`@supabase/ssr`), Tailwind CSS v4, @dnd-kit/core, Lucide icons

**Prerequisites:** Session 1 must be complete. The database has seed data (association + teams) and imported players via CSV. Auth redirects are working. `lib/auth.ts` helpers exist.

**IMPORTANT:** Before modifying any auth or proxy code, read these reference docs:
- `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md`
- `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md`

**Coding standards (from CLAUDE.md):**
- No semicolons in TypeScript/JavaScript
- No more than 1 Tailwind class directly in JSX — extract multi-class styles to `globals.css` using `@apply`
- No hanging words (widows/orphans)
- Path alias: `@/*` maps to `frontend/` root
- Use `git switch -c` not `git checkout`

---

## File Structure

```
frontend/
├── lib/
│   └── auth.ts                                   # EXISTS (Session 1) — used by all pages
├── app/
│   ├── (app)/
│   │   ├── layout.tsx                            # EXISTS — already has auth check
│   │   ├── join/
│   │   │   ├── page.tsx                          # MODIFY: replace placeholder with real form
│   │   │   └── actions.ts                        # CREATE: server action to join via code
│   │   ├── dashboard/
│   │   │   └── page.tsx                          # MODIFY: replace placeholder with player list + stats
│   │   └── teams/
│   │       ├── page.tsx                          # MODIFY: replace mock data with Supabase queries
│   │       └── actions.ts                        # CREATE: server action to save predictions
│   └── globals.css                               # MODIFY: add player list + join + dashboard CSS
├── components/
│   ├── layout/
│   │   ├── bottom-nav.tsx                        # MODIFY: update nav items
│   │   └── teams-header.tsx                      # MODIFY: pass real group label + user initials
│   ├── players/
│   │   ├── player-list.tsx                       # CREATE: client component — search + division tabs + player cards
│   │   └── status-badge.tsx                      # CREATE: player status pill
│   ├── join/
│   │   └── join-form.tsx                         # CREATE: client component — join code input
│   ├── dashboard/
│   │   └── stats-bar.tsx                         # CREATE: summary stat chips
│   └── teams/
│       ├── teams-page-client.tsx                 # MODIFY: accept + save predictions
│       └── prediction-board.tsx                  # MODIFY: accept saved prediction order
├── types/
│   └── index.ts                                  # MODIFY: align types with database schema
```

---

## Task 1: Align Frontend Types with Database Schema

**Files:**
- Modify: `frontend/types/index.ts`

The `Player` type has a `position` field that doesn't exist in the DB. The `Team` type has `is_official` which isn't a DB column. Fix these to match the actual schema so real data renders correctly.

- [ ] **Step 1: Update the types file**

Replace `frontend/types/index.ts` with:

```typescript
import type { Tables } from "./database"

// Database row types aliased for convenience
export type TryoutPlayer = Tables<"tryout_players">
export type Team = Tables<"teams">
export type Association = Tables<"associations">
export type UserAssociation = Tables<"user_associations">
export type PlayerPrediction = Tables<"player_predictions">
export type PlayerHeart = Tables<"player_hearts">

// UI-specific display types (extend DB types with computed fields)
export type PlayerWithTeam = TryoutPlayer & {
  teams: { name: string } | null
}

// Status display labels
export const STATUS_LABELS: Record<TryoutPlayer["status"], string> = {
  registered: "Registered",
  trying_out: "Trying Out",
  cut: "Cut",
  made_team: "Made Team",
  moved_up: "Moved Up",
  moved_down: "Moved Down",
  withdrew: "Withdrew",
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/index.ts
git commit -m "refactor: align frontend types with database schema"
```

---

## Task 2: Build Join Association Flow

**Files:**
- Modify: `frontend/app/(app)/join/page.tsx`
- Create: `frontend/app/(app)/join/actions.ts`
- Create: `frontend/components/join/join-form.tsx`

Parents enter a join code to join an association. The server action validates the code, checks the association exists and has joining enabled, and inserts a `user_associations` row with role `member`.

- [ ] **Step 1: Create the join server action**

Create `frontend/app/(app)/join/actions.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function joinAssociation(
  joinCode: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Find association by join code
  const { data: association } = await supabase
    .from("associations")
    .select("id, name, join_enabled")
    .eq("join_code", joinCode.trim().toUpperCase())
    .single()

  if (!association) {
    return { error: "Invalid join code. Check with your association&nbsp;admin." }
  }

  if (!association.join_enabled) {
    return { error: "This association is not currently accepting new&nbsp;members." }
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("user_associations")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("association_id", association.id)
    .single()

  if (existing) {
    redirect("/dashboard")
  }

  // Insert membership
  const { error } = await supabase
    .from("user_associations")
    .insert({
      user_id: user.id,
      association_id: association.id,
      role: "member",
    })

  if (error) {
    return { error: "Failed to join. Please try&nbsp;again." }
  }

  redirect("/dashboard")
}
```

- [ ] **Step 2: Create the join form client component**

Create `frontend/components/join/join-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { joinAssociation } from "@/app/(app)/join/actions"

export function JoinForm() {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)

    const result = await joinAssociation(code)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, the server action redirects to /dashboard
  }

  return (
    <form onSubmit={handleSubmit} className="join-form">
      <div className="join-input-group">
        <label htmlFor="join-code" className="join-label">Join Code</label>
        <input
          id="join-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ORMH2026"
          className="join-input"
          maxLength={20}
          autoFocus
        />
      </div>
      {error && <p className="join-error" dangerouslySetInnerHTML={{ __html: error }} />}
      <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
        {loading ? "Joining..." : "Join Association"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Update the join page**

Replace `frontend/app/(app)/join/page.tsx` with:

```tsx
import { JoinForm } from "@/components/join/join-form"

export default function JoinPage() {
  return (
    <div className="join-page">
      <h1 className="join-title">Join an Association</h1>
      <p className="join-desc">
        Enter the code provided by your hockey association to view tryout&nbsp;data.
      </p>
      <JoinForm />
    </div>
  )
}
```

- [ ] **Step 4: Add join CSS classes to globals.css**

Append to `frontend/app/globals.css`:

```css
/* ── Join Page ───────────────────────────────────────── */

.join-page {
  @apply flex flex-col items-center justify-center px-6 py-12;
  min-height: calc(100vh - 4rem);
}

.join-title {
  @apply text-2xl font-semibold text-center mb-2;
}

.join-desc {
  @apply text-sm text-center mb-8;
  color: var(--dm-dust);
  max-width: 280px;
  text-wrap: balance;
}

.join-form {
  @apply w-full max-w-sm flex flex-col gap-4;
}

.join-input-group {
  @apply flex flex-col gap-1;
}

.join-label {
  @apply text-xs uppercase tracking-wider;
  font-family: var(--font-ibm-plex-mono);
  color: var(--dm-dust);
}

.join-input {
  @apply rounded-md border px-3 py-2 text-center text-lg tracking-widest;
  font-family: var(--font-ibm-plex-mono);
  border-color: var(--dm-dune-alt);
  background: var(--dm-dune);
}

.join-input:focus {
  @apply outline-none ring-2;
  ring-color: var(--dm-gold);
  border-color: var(--dm-gold);
}

.join-error {
  @apply text-sm text-center;
  color: var(--dm-cinnabar);
}
```

- [ ] **Step 5: Commit**

```bash
mkdir -p frontend/components/join
git add frontend/app/\(app\)/join/page.tsx frontend/app/\(app\)/join/actions.ts frontend/components/join/join-form.tsx frontend/app/globals.css
git commit -m "feat: add join association flow with join code"
```

---

## Task 3: Add Player List + Dashboard CSS Classes

**Files:**
- Modify: `frontend/app/globals.css`

Add all CSS classes needed for the player list, status badges, stats bar, and dashboard layout. Doing this upfront avoids CSS additions scattered across later tasks.

- [ ] **Step 1: Append player list and dashboard CSS**

Append to `frontend/app/globals.css`:

```css
/* ── Dashboard ───────────────────────────────────────── */

.dashboard-page {
  @apply px-4 pb-20;
}

.dashboard-header {
  @apply flex items-center justify-between px-4 py-3;
}

.dashboard-assoc-name {
  @apply text-sm tracking-wider uppercase;
  font-family: var(--font-ibm-plex-mono);
  color: var(--dm-dust);
}

.dashboard-title {
  @apply text-lg font-semibold;
}

/* ── Stats Bar ───────────────────────────────────────── */

.stats-bar {
  @apply flex gap-2 px-4 py-3 overflow-x-auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.stats-bar::-webkit-scrollbar {
  display: none;
}

.stat-chip {
  @apply flex-shrink-0 rounded-full px-3 py-1 text-xs;
  font-family: var(--font-ibm-plex-mono);
  background: var(--dm-dune);
  color: var(--dm-umber);
}

.stat-chip-value {
  @apply font-medium ml-1;
  color: var(--dm-gold);
}

/* ── Division Tabs ───────────────────────────────────── */

.division-tabs {
  @apply flex gap-1 px-4 py-2;
}

.division-tab {
  @apply rounded-full px-3 py-1 text-xs cursor-pointer transition-colors;
  font-family: var(--font-ibm-plex-mono);
  background: var(--dm-dune);
  color: var(--dm-dust);
}

.division-tab-active {
  @apply rounded-full px-3 py-1 text-xs cursor-pointer;
  font-family: var(--font-ibm-plex-mono);
  background: var(--dm-umber);
  color: var(--dm-parchment);
}

/* ── Player List ─────────────────────────────────────── */

.player-search {
  @apply w-full rounded-md border px-3 py-2 text-sm;
  border-color: var(--dm-dune-alt);
  background: var(--dm-dune);
}

.player-search:focus {
  @apply outline-none ring-2;
  ring-color: var(--dm-gold);
  border-color: var(--dm-gold);
}

.player-search-wrapper {
  @apply px-4 py-2;
}

.player-list-section {
  @apply px-4 pb-2;
}

.player-list-empty {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.player-list-empty-text {
  @apply text-sm;
  color: var(--dm-dust);
}

/* ── Status Badge ────────────────────────────────────── */

.status-badge {
  @apply inline-flex items-center rounded-full px-2 py-0.5 text-xs;
  font-family: var(--font-ibm-plex-mono);
}

.status-badge-registered {
  background: var(--dm-dune);
  color: var(--dm-dust);
}

.status-badge-trying_out {
  background: oklch(0.90 0.08 85);
  color: oklch(0.40 0.10 85);
}

.status-badge-cut {
  background: oklch(0.93 0.04 25);
  color: var(--dm-cinnabar);
}

.status-badge-made_team {
  background: oklch(0.92 0.06 145);
  color: oklch(0.35 0.12 145);
}

.status-badge-moved_up {
  background: oklch(0.90 0.06 220);
  color: oklch(0.40 0.10 220);
}

.status-badge-moved_down {
  background: oklch(0.93 0.04 45);
  color: oklch(0.45 0.10 45);
}

.status-badge-withdrew {
  background: var(--dm-dune);
  color: var(--dm-dust);
}

/* ── Player Card (list view) ─────────────────────────── */

.player-list-card {
  @apply flex items-center gap-3 py-2;
  border-bottom: 1px solid var(--dm-dune);
}

.player-list-card:last-child {
  border-bottom: none;
}

.player-list-jersey {
  @apply text-xs font-medium tabular-nums;
  font-family: var(--font-ibm-plex-mono);
  color: var(--dm-dust);
  min-width: 2rem;
}

.player-list-name {
  @apply flex-1 text-sm font-medium truncate;
}

.player-list-meta {
  @apply text-xs;
  color: var(--dm-dust);
  font-family: var(--font-ibm-plex-mono);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/globals.css
git commit -m "style: add player list, dashboard, and status badge CSS"
```

---

## Task 4: Build Status Badge Component

**Files:**
- Create: `frontend/components/players/status-badge.tsx`

Small reusable component that renders a colored status pill.

- [ ] **Step 1: Create the status badge**

Create `frontend/components/players/status-badge.tsx`:

```tsx
import type { TryoutPlayer } from "@/types"
import { STATUS_LABELS } from "@/types"

type StatusBadgeProps = {
  status: TryoutPlayer["status"]
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p frontend/components/players
git add frontend/components/players/status-badge.tsx
git commit -m "feat: add player status badge component"
```

---

## Task 5: Build Stats Bar Component

**Files:**
- Create: `frontend/components/dashboard/stats-bar.tsx`

Horizontally scrollable row of stat chips showing counts by status.

- [ ] **Step 1: Create the stats bar**

Create `frontend/components/dashboard/stats-bar.tsx`:

```tsx
import type { TryoutPlayer } from "@/types"

type StatsBarProps = {
  players: TryoutPlayer[]
}

export function StatsBar({ players }: StatsBarProps) {
  const total = players.length
  const tryingOut = players.filter((p) => p.status === "trying_out").length
  const madeTeam = players.filter((p) => p.status === "made_team").length
  const cut = players.filter((p) => p.status === "cut").length
  const registered = players.filter((p) => p.status === "registered").length

  const stats = [
    { label: "Total", value: total },
    { label: "Trying Out", value: tryingOut },
    { label: "Made Team", value: madeTeam },
    { label: "Cut", value: cut },
    { label: "Registered", value: registered },
  ].filter((s) => s.value > 0)

  return (
    <div className="stats-bar">
      {stats.map((s) => (
        <div key={s.label} className="stat-chip">
          {s.label}<span className="stat-chip-value">{s.value}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p frontend/components/dashboard
git add frontend/components/dashboard/stats-bar.tsx
git commit -m "feat: add dashboard stats bar component"
```

---

## Task 6: Build Player List Component

**Files:**
- Create: `frontend/components/players/player-list.tsx`

Client component with search input, division filter tabs, and player card list. Receives all players from the server component and filters client-side.

- [ ] **Step 1: Create the player list component**

Create `frontend/components/players/player-list.tsx`:

```tsx
"use client"

import { useState, useMemo } from "react"
import type { TryoutPlayer } from "@/types"
import { StatusBadge } from "./status-badge"

type PlayerListProps = {
  players: TryoutPlayer[]
  divisions: string[]
}

export function PlayerList({ players, divisions }: PlayerListProps) {
  const [search, setSearch] = useState("")
  const [activeDivision, setActiveDivision] = useState<string>(divisions[0] ?? "")

  const filtered = useMemo(() => {
    let result = players.filter((p) => p.division === activeDivision)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.jersey_number.includes(q)
      )
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [players, activeDivision, search])

  return (
    <>
      <div className="division-tabs">
        {divisions.map((div) => (
          <button
            key={div}
            className={div === activeDivision ? "division-tab-active" : "division-tab"}
            onClick={() => setActiveDivision(div)}
          >
            {div}
          </button>
        ))}
      </div>

      <div className="player-search-wrapper">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or jersey\u2026"
          className="player-search"
        />
      </div>

      <div className="player-list-section">
        {filtered.length === 0 ? (
          <div className="player-list-empty">
            <p className="player-list-empty-text">
              {search ? "No players match your&nbsp;search" : "No players in this&nbsp;division"}
            </p>
          </div>
        ) : (
          filtered.map((player) => (
            <div key={player.id} className="player-list-card">
              <span className="player-list-jersey">#{player.jersey_number}</span>
              <span className="player-list-name">{player.name}</span>
              <StatusBadge status={player.status} />
            </div>
          ))
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/players/player-list.tsx
git commit -m "feat: add player list component with search and division filter"
```

---

## Task 7: Wire Dashboard Page to Supabase

**Files:**
- Modify: `frontend/app/(app)/dashboard/page.tsx`

Replace the placeholder with a real server component that fetches players from the user's association and renders the player list + stats bar. Also updates the header with the association name.

- [ ] **Step 1: Rewrite the dashboard page**

Replace `frontend/app/(app)/dashboard/page.tsx` with:

```tsx
import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { PlayerList } from "@/components/players/player-list"
import type { TryoutPlayer } from "@/types"

export default async function DashboardPage() {
  const { supabase, user, association } = await requireAssociation()

  const { data: players } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", association.id)
    .is("deleted_at", null)
    .order("name")

  const allPlayers: TryoutPlayer[] = players ?? []

  // Get unique divisions sorted
  const divisions = [...new Set(allPlayers.map((p) => p.division))].sort()

  // User initials from email
  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <>
      <TeamsHeader groupLabel={association.abbreviation} initials={initials} />
      <div className="dashboard-page">
        <StatsBar players={allPlayers} />
        {allPlayers.length > 0 ? (
          <PlayerList players={allPlayers} divisions={divisions} />
        ) : (
          <div className="player-list-empty">
            <p className="player-list-empty-text">
              No players yet. Ask your admin to import&nbsp;data.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify — dashboard shows real data**

1. Start dev server: `cd frontend && npm run dev`
2. Log in as the group_admin user (who imported CSV data in Session 1)
3. Go to `http://localhost:3000/dashboard`
4. Expected: see stats bar with player counts, division tabs, and player cards with real names from the CSV import

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(app\)/dashboard/page.tsx
git commit -m "feat: wire dashboard to Supabase with player list and stats"
```

---

## Task 8: Create Prediction Save Server Action

**Files:**
- Create: `frontend/app/(app)/teams/actions.ts`

Server action to upsert the user's prediction order for a given division. Called from the prediction board when the user drags players.

- [ ] **Step 1: Create the teams server action**

Create `frontend/app/(app)/teams/actions.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"

export async function savePredictionOrder(
  associationId: string,
  division: string,
  playerOrder: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("player_predictions")
    .upsert(
      {
        user_id: user.id,
        association_id: associationId,
        division,
        player_order: playerOrder,
      },
      { onConflict: "user_id,association_id,division" }
    )

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/\(app\)/teams/actions.ts
git commit -m "feat: add server action to save prediction order"
```

---

## Task 9: Wire Teams Page to Supabase

**Files:**
- Modify: `frontend/app/(app)/teams/page.tsx`
- Modify: `frontend/components/teams/teams-page-client.tsx`
- Modify: `frontend/components/teams/prediction-board.tsx`

Replace mock data with real Supabase queries. The server component fetches players, teams, and the user's saved prediction order. The prediction board uses the saved order and calls the server action on drag-end.

- [ ] **Step 1: Rewrite the teams page server component**

Replace `frontend/app/(app)/teams/page.tsx` with:

```tsx
import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import type { TryoutPlayer, Team } from "@/types"

export default async function TeamsPage() {
  const { supabase, user, associationId, association } = await requireAssociation()

  // Fetch players for this association (active only)
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .is("deleted_at", null)
    .order("name")

  // Fetch teams for this association
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("association_id", associationId)
    .eq("is_archived", false)
    .order("display_order")

  // Get unique divisions
  const allPlayers: TryoutPlayer[] = playersData ?? []
  const allTeams: Team[] = teamsData ?? []
  const divisions = [...new Set(allPlayers.map((p) => p.division))].sort()
  const activeDivision = divisions[0] ?? ""

  // Fetch user's saved prediction for the active division
  const { data: prediction } = await supabase
    .from("player_predictions")
    .select("player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)
    .eq("division", activeDivision)
    .single()

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <>
      <TeamsHeader groupLabel={`${association.abbreviation} ${activeDivision}`} initials={initials} />
      <TeamsPageClient
        players={allPlayers}
        teams={allTeams}
        divisions={divisions}
        initialDivision={activeDivision}
        savedOrder={prediction?.player_order ?? null}
        associationId={associationId}
      />
    </>
  )
}
```

- [ ] **Step 2: Update TeamsPageClient to handle divisions and save predictions**

Replace `frontend/components/teams/teams-page-client.tsx` with:

```tsx
"use client"

import { useState, useCallback, useRef } from "react"
import type { TryoutPlayer, Team } from "@/types"
import { ViewToggle } from "./view-toggle"
import { PredictionBoard } from "./prediction-board"
import { PreviousTeamsView } from "./previous-teams-view"
import { LongPressMenu } from "./long-press-menu"
import { savePredictionOrder } from "@/app/(app)/teams/actions"

type TeamsPageClientProps = {
  players: TryoutPlayer[]
  teams: Team[]
  divisions: string[]
  initialDivision: string
  savedOrder: string[] | null
  associationId: string
}

export function TeamsPageClient({
  players,
  teams,
  divisions,
  initialDivision,
  savedOrder,
  associationId,
}: TeamsPageClientProps) {
  const [activeView, setActiveView] = useState<"predictions" | "previous">("predictions")
  const [activeDivision, setActiveDivision] = useState(initialDivision)
  const [selectedPlayer, setSelectedPlayer] = useState<TryoutPlayer | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const divisionPlayers = players.filter((p) => p.division === activeDivision)
  const divisionTeams = teams.filter((t) => t.division === activeDivision)

  const handleOrderChange = useCallback((playerIds: string[]) => {
    // Debounced save — 1 second after last drag
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      savePredictionOrder(associationId, activeDivision, playerIds)
    }, 1000)
  }, [associationId, activeDivision])

  return (
    <>
      {divisions.length > 1 && (
        <div className="division-tabs">
          {divisions.map((div) => (
            <button
              key={div}
              className={div === activeDivision ? "division-tab-active" : "division-tab"}
              onClick={() => setActiveDivision(div)}
            >
              {div}
            </button>
          ))}
        </div>
      )}

      <ViewToggle activeView={activeView} onViewChange={setActiveView} />
      <p className="instruction-line">
        Drag players up and down between&nbsp;teams
      </p>

      {activeView === "predictions" ? (
        <PredictionBoard
          players={divisionPlayers}
          teams={divisionTeams}
          savedOrder={savedOrder}
          onOrderChange={handleOrderChange}
          onPlayerLongPress={setSelectedPlayer}
        />
      ) : (
        <PreviousTeamsView players={divisionPlayers} />
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

- [ ] **Step 3: Update PredictionBoard to use saved order and report changes**

Replace `frontend/components/teams/prediction-board.tsx` with:

```tsx
"use client"

import { useState, useCallback, useEffect } from "react"
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
import type { TryoutPlayer, Team } from "@/types"
import { TeamSection } from "./team-section"

type PredictionBoardProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrder: string[] | null
  onOrderChange?: (playerIds: string[]) => void
  onPlayerLongPress?: (player: TryoutPlayer) => void
}

export function PredictionBoard({
  players,
  teams,
  savedOrder,
  onOrderChange,
  onPlayerLongPress,
}: PredictionBoardProps) {
  const sortedTeams = [...teams].sort((a, b) => a.display_order - b.display_order)

  // Split: players with team_id + made_team status are official
  const officialByTeam = new Map<string, TryoutPlayer[]>()
  const predictedPool: TryoutPlayer[] = []

  for (const player of players) {
    if (player.team_id && player.status === "made_team") {
      const existing = officialByTeam.get(player.team_id) ?? []
      existing.push(player)
      officialByTeam.set(player.team_id, existing)
    } else {
      predictedPool.push(player)
    }
  }

  // Apply saved order to predicted players
  function applyOrder(pool: TryoutPlayer[], order: string[] | null): TryoutPlayer[] {
    if (!order || order.length === 0) return pool
    const byId = new Map(pool.map((p) => [p.id, p]))
    const ordered: TryoutPlayer[] = []
    for (const id of order) {
      const player = byId.get(id)
      if (player) {
        ordered.push(player)
        byId.delete(id)
      }
    }
    // Append any players not in saved order (newly imported)
    for (const player of byId.values()) {
      ordered.push(player)
    }
    return ordered
  }

  const [predictedOrder, setPredictedOrder] = useState<TryoutPlayer[]>(() =>
    applyOrder(predictedPool, savedOrder)
  )

  // Re-sync when players or savedOrder change (division switch)
  useEffect(() => {
    const newPool: TryoutPlayer[] = []
    for (const player of players) {
      if (!(player.team_id && player.status === "made_team")) {
        newPool.push(player)
      }
    }
    setPredictedOrder(applyOrder(newPool, savedOrder))
  }, [players, savedOrder])

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
      const newOrder = arrayMove(prev, oldIndex, newIndex)
      onOrderChange?.(newOrder.map((p) => p.id))
      return newOrder
    })
  }, [onOrderChange])

  // Build sections
  const sections: {
    key: string
    teamName: string
    players: TryoutPlayer[]
    isOfficial: boolean
  }[] = []

  // Official teams first
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

  // Distribute predicted players across teams that don't have official rosters
  const teamsWithOfficials = new Set(officialByTeam.keys())
  const predictedTeams = sortedTeams.filter((t) => !teamsWithOfficials.has(t.id))
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

  // Any overflow players
  if (offset < predictedOrder.length) {
    sections.push({
      key: "overflow",
      teamName: "Remaining",
      players: predictedOrder.slice(offset),
      isOfficial: false,
    })
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

- [ ] **Step 4: Update TeamSection and PlayerRow types**

The `TeamSection` and `PlayerRow` components import `Player` from `@/types`. Update them to use `TryoutPlayer` instead.

In `frontend/components/teams/team-section.tsx`, change:
```typescript
import type { Player } from "@/types"
```
to:
```typescript
import type { TryoutPlayer } from "@/types"
```

And update all `Player` references to `TryoutPlayer` in the component props and usage. The same change applies to:
- `frontend/components/teams/player-row.tsx` — change `Player` to `TryoutPlayer`
- `frontend/components/teams/long-press-menu.tsx` — change `Player` to `TryoutPlayer`
- `frontend/components/teams/previous-teams-view.tsx` — change `Player` to `TryoutPlayer`
- `frontend/components/teams/view-toggle.tsx` — no type changes needed

In each file, find-and-replace:
- `import type { Player } from "@/types"` → `import type { TryoutPlayer } from "@/types"`
- `Player` in props types → `TryoutPlayer`
- `Player["status"]` → `TryoutPlayer["status"]`

**Note for player-row.tsx:** The `player.position` field no longer exists on `TryoutPlayer`. Remove the position display:

```tsx
// Remove this block from player-row.tsx:
{player.position && (
  <span className="player-position">{player.position}</span>
)}
```

**Note for previous-teams-view.tsx:** Same — remove position display if present.

**Note for long-press-menu.tsx and previous-teams-view.tsx:** Both files have inline `formatStatus()` functions. Replace them with the shared `STATUS_LABELS` import from `@/types`:

```typescript
import { STATUS_LABELS } from "@/types"
// Then use: STATUS_LABELS[player.status] instead of formatStatus(player.status)
```

Delete the local `formatStatus` function from both files.

- [ ] **Step 5: Verify — teams page shows real data**

1. Dev server running: `cd frontend && npm run dev`
2. Log in and go to `http://localhost:3000/teams`
3. Expected: players from CSV import appear in the prediction board
4. Drag a player — after 1 second, prediction saves to `player_predictions` table
5. Refresh the page — player order should persist

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(app\)/teams/page.tsx frontend/app/\(app\)/teams/actions.ts frontend/components/teams/teams-page-client.tsx frontend/components/teams/prediction-board.tsx frontend/components/teams/player-row.tsx frontend/components/teams/team-section.tsx frontend/components/teams/long-press-menu.tsx frontend/components/teams/previous-teams-view.tsx
git commit -m "feat: wire teams page and prediction board to Supabase"
```

---

## Task 10: Update Bottom Nav

**Files:**
- Modify: `frontend/components/layout/bottom-nav.tsx`

The "More" tab currently points to `#`. Update it to point to `/settings` and add a Players icon for Home.

- [ ] **Step 1: Update the bottom nav**

Replace `frontend/components/layout/bottom-nav.tsx` with:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, MoreHorizontal } from "lucide-react"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/settings", label: "More", icon: MoreHorizontal },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
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

- [ ] **Step 2: Commit**

```bash
git add frontend/components/layout/bottom-nav.tsx
git commit -m "fix: update bottom nav with proper icons and links"
```

---

## Task 11: Clean Up Mock Data

**Files:**
- Delete: `frontend/lib/mock-data.ts`

The mock data file is no longer needed since all pages now query Supabase.

- [ ] **Step 1: Delete mock-data.ts**

```bash
rm frontend/lib/mock-data.ts
```

- [ ] **Step 2: Verify no remaining imports**

Search the codebase for any remaining references to `mock-data`:

```bash
cd frontend && grep -r "mock-data" --include="*.ts" --include="*.tsx" .
```

Expected: no results. If any file still imports mock-data, update it to use real Supabase data.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore: remove mock data file"
```

---

## Task 12: End-to-End Verification

**No files to create. Manual testing of the full parent flow.**

- [ ] **Step 1: Test as a new parent user**

1. Open incognito window
2. Go to `http://localhost:3000/signup` — create a new account
3. Confirm email via Inbucket (`http://localhost:54324`)
4. After login, expected: redirected to `/join` (no associations yet)
5. Enter join code `ORMH2026`
6. Expected: redirected to `/dashboard` showing the player list

- [ ] **Step 2: Test dashboard**

1. On `/dashboard`: expected to see stats bar, division tabs, and player list
2. Click a different division tab — player list filters
3. Type in search box — player list filters by name or jersey

- [ ] **Step 3: Test prediction board**

1. Click "Teams" in bottom nav
2. Expected: prediction board with real players distributed across teams
3. Drag a player to a different position
4. Wait 1 second (debounce)
5. Refresh page — order should persist
6. Toggle to "Previous Teams" view — expected: players grouped by `previous_team`

- [ ] **Step 4: Test admin redirect**

1. As the parent user (member role), go to `http://localhost:3000/admin/import`
2. Expected: redirected to `/dashboard` (not an admin)

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build
```

Expected: build succeeds. Fix any type errors.

- [ ] **Step 6: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Lint check**

```bash
cd frontend && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Final commit if adjustments were needed**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end verification"
```

---

## Summary

After completing Session 2, the app has the complete parent-facing MVP:

1. **Auth**: sign up, log in, session refresh, route protection
2. **Join**: parents enter a join code to access their association's data
3. **Dashboard**: player list with division tabs, search, status badges, and stats bar
4. **Predictions**: drag-and-drop private team projections saved to Supabase
5. **Real data**: all pages query Supabase — no mock data remaining

**What's NOT in this MVP (deferred):**
- Corrections workflow (submit + review)
- Web scraper
- Audit log UI
- Password reset
- Association management
- Multi-association switcher
- Player hearts (favoriting)
- Dark mode toggle
