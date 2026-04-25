"use client"

import { useState, useCallback, useMemo } from "react"
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
import type { TryoutPlayer, Team, Annotations } from "@/types"
import { TeamSection } from "./team-section"

/* ── Constants ───────────────────────────────────────── */

const TIER_RANK: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 }
const POSITION_RANK: Record<string, number> = { F: 0, D: 1, G: 2 }
const POSITION_CAPS: Record<string, number> = { F: 9, D: 6, G: 2 }

/* ── Sorting helpers ─────────────────────────────────── */

/** Sort teams: by tier (AA → C), then higher division first (U15 before U13) */
function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const aTier = TIER_RANK[a.name] ?? 99
    const bTier = TIER_RANK[b.name] ?? 99
    if (aTier !== bTier) return aTier - bTier
    const aDiv = parseInt(a.division.replace(/\D/g, ""), 10) || 0
    const bDiv = parseInt(b.division.replace(/\D/g, ""), 10) || 0
    return bDiv - aDiv
  })
}

/** Parse a previous_team label like "U15AA" or "U15A-NGHA" */
function parsePreviousTeam(label: string): { rank: number, suffix: string } {
  const match = label.match(/^U(\d+)(AA|BB|A|B|C)(?:-(.+))?$/i)
  if (!match) return { rank: 999, suffix: label }
  const divNum = parseInt(match[1], 10)
  const tier = match[2].toUpperCase()
  const tierRank = TIER_RANK[tier] ?? 99
  const rank = tierRank * 100 + (99 - divNum)
  const suffix = match[3] ?? ""
  return { rank, suffix }
}

/** Compare two previous_team labels: same rank grouped, current assoc first, then external alphabetically */
function comparePreviousTeams(a: string, b: string): number {
  const pa = parsePreviousTeam(a)
  const pb = parsePreviousTeam(b)
  if (pa.rank !== pb.rank) return pa.rank - pb.rank
  const aExternal = pa.suffix ? 1 : 0
  const bExternal = pb.suffix ? 1 : 0
  if (aExternal !== bExternal) return aExternal - bExternal
  return pa.suffix.localeCompare(pb.suffix)
}

/** Rank a previous_team for player sorting within predictions */
function previousTeamRank(prevTeam: string | null | undefined): number {
  if (!prevTeam) return 999
  const parsed = parsePreviousTeam(prevTeam)
  // External teams sort after same-rank internal teams
  return parsed.rank * 2 + (parsed.suffix ? 1 : 0)
}

/** Sort players by position within a team slice: F → D → G → ? */
function sortByPosition(players: TryoutPlayer[]): TryoutPlayer[] {
  return [...players].sort((a, b) => {
    const aRank = POSITION_RANK[a.position ?? "?"] ?? 3
    const bRank = POSITION_RANK[b.position ?? "?"] ?? 3
    return aRank - bRank
  })
}

/** Enforce F → D → G → ? grouping, preserving relative order within each group */
function enforcePositionGroups(players: TryoutPlayer[]): TryoutPlayer[] {
  const groups: Record<number, TryoutPlayer[]> = {}
  for (const p of players) {
    const rank = POSITION_RANK[p.position ?? "?"] ?? 3
    if (!groups[rank]) groups[rank] = []
    groups[rank].push(p)
  }
  const result: TryoutPlayer[] = []
  for (const rank of [0, 1, 2, 3]) {
    if (groups[rank]) result.push(...groups[rank])
  }
  return result
}

/** Sort using Previous Teams saved orders, falling back to team rank + jersey */
function sortByPreviousTeamOrders(
  players: TryoutPlayer[],
  previousOrders: Record<string, string[]>,
  teamGroupOrder: string[] = [],
): TryoutPlayer[] {
  // Group players by previous team
  const groups = new Map<string, TryoutPlayer[]>()
  for (const p of players) {
    const key = p.previous_team ?? "Unknown"
    const existing = groups.get(key) ?? []
    existing.push(p)
    groups.set(key, existing)
  }

  // Sort group keys: use custom team group order if available, then fall back
  let sortedKeys: string[]
  if (teamGroupOrder.length > 0) {
    const allKeys = Array.from(groups.keys())
    const savedSet = new Set(teamGroupOrder)
    const unsaved = allKeys.filter((k) => !savedSet.has(k)).sort(comparePreviousTeams)
    sortedKeys = [...teamGroupOrder.filter((k) => allKeys.includes(k)), ...unsaved]
  } else {
    sortedKeys = Array.from(groups.keys()).sort(comparePreviousTeams)
  }

  // Within each group, apply saved previous team order or fall back to jersey
  const result: TryoutPlayer[] = []
  for (const key of sortedKeys) {
    const groupPlayers = groups.get(key)!
    const order = previousOrders[key]
    if (order && order.length > 0) {
      const byId = new Map(groupPlayers.map((p) => [p.id, p]))
      for (const id of order) {
        const player = byId.get(id)
        if (player) {
          result.push(player)
          byId.delete(id)
        }
      }
      for (const player of byId.values()) {
        result.push(player)
      }
    } else {
      groupPlayers.sort((a, b) => {
        const jA = parseInt(a.jersey_number ?? "999", 10)
        const jB = parseInt(b.jersey_number ?? "999", 10)
        return jA - jB
      })
      result.push(...groupPlayers)
    }
  }

  return result
}

/** Split players into position pools: F, D, G, other */
function splitByPosition(players: TryoutPlayer[]) {
  const forwards: TryoutPlayer[] = []
  const defense: TryoutPlayer[] = []
  const goalies: TryoutPlayer[] = []
  const other: TryoutPlayer[] = []

  for (const p of players) {
    const pos = p.position ?? "?"
    if (pos === "F") forwards.push(p)
    else if (pos === "D") defense.push(p)
    else if (pos === "G") goalies.push(p)
    else other.push(p)
  }

  return { forwards, defense, goalies, other }
}

/* ── Component ───────────────────────────────────────── */

type PredictionBoardProps = {
  players: TryoutPlayer[]
  teams: Team[]
  savedOrders: Record<string, string[]>
  savedPreviousOrders: Record<string, string[]>
  savedTeamGroupOrder?: string[]
  positionFilter?: string | null
  annotations?: Annotations
  onOrderChange?: (division: string, playerIds: string[]) => void
  onPlayerEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: (playerId: string) => void
}

export function PredictionBoard({
  players,
  teams,
  savedOrders,
  savedPreviousOrders,
  savedTeamGroupOrder,
  positionFilter,
  annotations,
  onOrderChange,
  onPlayerEdit,
  onToggleFavorite,
}: PredictionBoardProps) {
  const sorted = useMemo(() => sortTeams(teams), [teams])

  // Split: players with team_id + made_team status are official
  const { officialByTeam, predictedByDiv } = useMemo(() => {
    const official = new Map<string, TryoutPlayer[]>()
    const byDiv = new Map<string, TryoutPlayer[]>()

    for (const player of players) {
      if (player.team_id && player.status === "made_team") {
        const existing = official.get(player.team_id) ?? []
        existing.push(player)
        official.set(player.team_id, existing)
      } else {
        const divList = byDiv.get(player.division) ?? []
        divList.push(player)
        byDiv.set(player.division, divList)
      }
    }
    return { officialByTeam: official, predictedByDiv: byDiv }
  }, [players])

  // Apply saved prediction order, or inherit from Previous Teams orders
  function applyOrder(pool: TryoutPlayer[], order: string[] | null): TryoutPlayer[] {
    if (!order || order.length === 0) return sortByPreviousTeamOrders(pool, savedPreviousOrders, savedTeamGroupOrder ?? [])
    const byId = new Map(pool.map((p) => [p.id, p]))
    const ordered: TryoutPlayer[] = []
    for (const id of order) {
      const player = byId.get(id)
      if (player) {
        ordered.push(player)
        byId.delete(id)
      }
    }
    for (const player of byId.values()) {
      ordered.push(player)
    }
    return ordered
  }

  const [predictedOrders, setPredictedOrders] = useState<Record<string, TryoutPlayer[]>>(() => {
    const result: Record<string, TryoutPlayer[]> = {}
    for (const [div, divPlayers] of predictedByDiv) {
      const ordered = applyOrder(divPlayers, savedOrders[div] ?? null)
      result[div] = enforcePositionGroups(ordered)
    }
    return result
  })

  // Lookup: player ID → division (for DnD)
  const playerDivMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) map.set(p.id, p.division)
    return map
  }, [players])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeDiv = playerDivMap.get(active.id as string)
    const overDiv = playerDivMap.get(over.id as string)
    if (!activeDiv || !overDiv || activeDiv !== overDiv) return

    setPredictedOrders((prev) => {
      const divPlayers = prev[activeDiv]
      if (!divPlayers) return prev

      const activePlayer = divPlayers.find((p) => p.id === active.id)
      const overPlayer = divPlayers.find((p) => p.id === over.id)
      if (!activePlayer || !overPlayer) return prev

      const activePos = POSITION_RANK[activePlayer.position ?? "?"] ?? 3
      const overPos = POSITION_RANK[overPlayer.position ?? "?"] ?? 3

      let result: TryoutPlayer[]
      if (activePos === overPos) {
        // Same position group: normal reorder
        const oldIndex = divPlayers.findIndex((p) => p.id === active.id)
        const newIndex = divPlayers.findIndex((p) => p.id === over.id)
        result = enforcePositionGroups(arrayMove(divPlayers, oldIndex, newIndex))
      } else {
        // Cross-position drag: determine target team from the over player
        const groups: Record<number, TryoutPlayer[]> = {}
        for (const p of divPlayers) {
          const rank = POSITION_RANK[p.position ?? "?"] ?? 3
          if (!groups[rank]) groups[rank] = []
          groups[rank].push(p)
        }

        // Find which team the over player is on
        const overGroup = groups[overPos] ?? []
        const overCap = POSITION_CAPS[overPlayer.position ?? "?"] ?? 17
        const overIdx = overGroup.findIndex((p) => p.id === over.id)
        const targetTeam = Math.floor(overIdx / overCap)

        // Remove active player from their position group
        const activeGroup = [...(groups[activePos] ?? [])]
        const activeCap = POSITION_CAPS[activePlayer.position ?? "?"] ?? 17
        const activeIdx = activeGroup.findIndex((p) => p.id === activePlayer.id)
        if (activeIdx === -1) return prev
        activeGroup.splice(activeIdx, 1)

        // Insert at top or bottom of target team's slice
        if (overPos < activePos) {
          // Dropped on higher position (e.g., D on F) — overshot up → TOP
          const insertIdx = Math.min(targetTeam * activeCap, activeGroup.length)
          activeGroup.splice(insertIdx, 0, activePlayer)
        } else {
          // Dropped on lower position (e.g., F on D) — overshot down → BOTTOM
          const insertIdx = Math.min((targetTeam + 1) * activeCap - 1, activeGroup.length)
          activeGroup.splice(insertIdx, 0, activePlayer)
        }

        groups[activePos] = activeGroup
        result = []
        for (const rank of [0, 1, 2, 3]) {
          if (groups[rank]) result.push(...groups[rank])
        }
      }

      onOrderChange?.(activeDiv, result.map((p) => p.id))
      return { ...prev, [activeDiv]: result }
    })
  }, [onOrderChange, playerDivMap])

  // Build sections — distribute by position caps (9F / 6D / 2G per team)
  const sections: {
    key: string
    teamName: string
    players: TryoutPlayer[]
    isOfficial: boolean
  }[] = []

  // Track position pool offsets per division
  const divPools: Record<string, ReturnType<typeof splitByPosition>> = {}
  const divIdx: Record<string, { f: number, d: number, g: number }> = {}

  for (const [div, divPredicted] of Object.entries(predictedOrders)) {
    divPools[div] = splitByPosition(divPredicted)
    divIdx[div] = { f: 0, d: 0, g: 0 }
  }

  for (const team of sorted) {
    const official = officialByTeam.get(team.id)
    if (official && official.length > 0) {
      sections.push({
        key: `official-${team.id}`,
        teamName: `${team.division} ${team.name}`,
        players: sortByPosition(official),
        isOfficial: true,
      })
    } else {
      const div = team.division
      const pool = divPools[div]
      const idx = divIdx[div]
      if (!pool || !idx) continue

      const fCap = POSITION_CAPS.F
      const dCap = POSITION_CAPS.D
      const gCap = POSITION_CAPS.G

      const teamPlayers = [
        ...pool.forwards.slice(idx.f, idx.f + fCap),
        ...pool.defense.slice(idx.d, idx.d + dCap),
        ...pool.goalies.slice(idx.g, idx.g + gCap),
      ]
      idx.f += fCap
      idx.d += dCap
      idx.g += gCap

      if (teamPlayers.length > 0) {
        sections.push({
          key: `predicted-${team.id}`,
          teamName: `${team.division} ${team.name}`,
          players: sortByPosition(teamPlayers),
          isOfficial: false,
        })
      }
    }
  }

  // Overflow per division
  for (const [div, pool] of Object.entries(divPools)) {
    const idx = divIdx[div]
    if (!idx) continue
    const remaining = [
      ...pool.forwards.slice(idx.f),
      ...pool.defense.slice(idx.d),
      ...pool.goalies.slice(idx.g),
      ...pool.other,
    ]
    if (remaining.length > 0) {
      sections.push({
        key: `overflow-${div}`,
        teamName: `${div} Remaining`,
        players: sortByPosition(remaining),
        isOfficial: false,
      })
    }
  }

  // Apply position filter at display level (after distribution)
  const displaySections = positionFilter
    ? sections
        .map((s) => ({
          ...s,
          players: s.players.filter((p) => p.position === positionFilter),
        }))
        .filter((s) => s.players.length > 0)
    : sections

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {displaySections.map((section, i) => (
        <TeamSection
          key={section.key}
          teamName={section.teamName}
          players={section.players}
          isOfficial={section.isOfficial}
          index={i}
          annotations={annotations}
          onPlayerEdit={onPlayerEdit}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </DndContext>
  )
}
