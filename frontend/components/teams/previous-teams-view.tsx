"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import type { TryoutPlayer } from "@/types"
import { PlayerRow } from "./player-row"

/* ── Sorting helpers ─────────────────────────────────── */

const TIER_RANK: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 }
const POSITION_RANK: Record<string, number> = { F: 0, D: 1, G: 2 }

/** Rank a previous_team label: AA first, then higher division (U15 before U13) */
function previousTeamRank(label: string): number {
  const match = label.match(/^U(\d+)(AA|BB|A|B|C)$/i)
  if (!match) return 999
  const divNum = parseInt(match[1], 10)
  const tier = match[2].toUpperCase()
  const tierRank = TIER_RANK[tier] ?? 99
  return tierRank * 100 + (99 - divNum)
}

function positionRank(p: TryoutPlayer): number {
  return POSITION_RANK[p.position ?? "?"] ?? 3
}

/** Default sort: position (F → D → G → ?), then jersey number within position */
function sortByPositionThenJersey(players: TryoutPlayer[]): TryoutPlayer[] {
  return [...players].sort((a, b) => {
    const posA = positionRank(a)
    const posB = positionRank(b)
    if (posA !== posB) return posA - posB
    const jA = parseInt(a.jersey_number ?? "999", 10)
    const jB = parseInt(b.jersey_number ?? "999", 10)
    return jA - jB
  })
}

/** After a drag, re-enforce position grouping while preserving intra-position order */
function enforcePositionGroups(players: TryoutPlayer[]): TryoutPlayer[] {
  const groups: Record<number, TryoutPlayer[]> = {}
  for (const p of players) {
    const rank = positionRank(p)
    if (!groups[rank]) groups[rank] = []
    groups[rank].push(p)
  }
  const result: TryoutPlayer[] = []
  for (const rank of [0, 1, 2, 3]) {
    if (groups[rank]) result.push(...groups[rank])
  }
  return result
}

/** Apply saved order, or default to position+jersey sort */
function applyOrder(pool: TryoutPlayer[], order: string[] | null): TryoutPlayer[] {
  if (!order || order.length === 0) return sortByPositionThenJersey(pool)
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

/* ── Group players by previous_team ──────────────────── */

function groupByPreviousTeam(players: TryoutPlayer[]): Map<string, TryoutPlayer[]> {
  const groups = new Map<string, TryoutPlayer[]>()
  for (const player of players) {
    const key = player.previous_team ?? "Unknown"
    const existing = groups.get(key) ?? []
    existing.push(player)
    groups.set(key, existing)
  }
  return groups
}

/* ── Sub-component ───────────────────────────────────── */

function PreviousTeamSection({
  label,
  players,
  index,
  onPlayerLongPress,
}: {
  label: string
  players: TryoutPlayer[]
  index: number
  onPlayerLongPress?: (player: TryoutPlayer) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const tones = ["team-header-tone-1", "team-header-tone-2", "team-header-tone-3"]
  const toneClass = tones[index % 3]

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">From {label}</span>
        </div>
        <div className="team-header-right">
          <span className="team-count">{players.length} Players</span>
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
              isLocked={false}
              onLongPress={onPlayerLongPress}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}

/* ── Main component ──────────────────────────────────── */

type PreviousTeamsViewProps = {
  players: TryoutPlayer[]
  savedOrders: Record<string, string[]>
  positionFilter?: string | null
  onOrderChange?: (previousTeam: string, playerIds: string[]) => void
  onPlayerLongPress?: (player: TryoutPlayer) => void
}

export function PreviousTeamsView({
  players,
  savedOrders,
  positionFilter,
  onOrderChange,
  onPlayerLongPress,
}: PreviousTeamsViewProps) {
  const groups = useMemo(() => groupByPreviousTeam(players), [players])

  // Player ID → previous_team group lookup
  const playerGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) {
      map.set(p.id, p.previous_team ?? "Unknown")
    }
    return map
  }, [players])

  // Initialize ordered state from saved orders or default sort
  const [orderedGroups, setOrderedGroups] = useState<Record<string, TryoutPlayer[]>>(() => {
    const result: Record<string, TryoutPlayer[]> = {}
    for (const [key, groupPlayers] of groups) {
      result[key] = applyOrder(groupPlayers, savedOrders[key] ?? null)
    }
    return result
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeGroup = playerGroupMap.get(active.id as string)
    const overGroup = playerGroupMap.get(over.id as string)
    if (!activeGroup || !overGroup || activeGroup !== overGroup) return

    setOrderedGroups((prev) => {
      const groupPlayers = prev[activeGroup]
      if (!groupPlayers) return prev

      const activePlayer = groupPlayers.find((p) => p.id === active.id)
      const overPlayer = groupPlayers.find((p) => p.id === over.id)
      if (!activePlayer || !overPlayer) return prev

      const activePos = POSITION_RANK[activePlayer.position ?? "?"] ?? 3
      const overPos = POSITION_RANK[overPlayer.position ?? "?"] ?? 3

      let result: TryoutPlayer[]
      if (activePos === overPos) {
        // Same position: normal reorder
        const oldIndex = groupPlayers.findIndex((p) => p.id === active.id)
        const newIndex = groupPlayers.findIndex((p) => p.id === over.id)
        result = enforcePositionGroups(arrayMove(groupPlayers, oldIndex, newIndex))
      } else {
        // Cross-position: move to top or bottom of position group
        const groups: Record<number, TryoutPlayer[]> = {}
        for (const p of groupPlayers) {
          const rank = POSITION_RANK[p.position ?? "?"] ?? 3
          if (!groups[rank]) groups[rank] = []
          groups[rank].push(p)
        }
        const posGroup = [...(groups[activePos] ?? [])]
        const idx = posGroup.findIndex((p) => p.id === activePlayer.id)
        if (idx === -1) return prev
        posGroup.splice(idx, 1)

        if (overPos < activePos) {
          // Dropped on higher position — overshot up → TOP
          posGroup.unshift(activePlayer)
        } else {
          // Dropped on lower position — overshot down → BOTTOM
          posGroup.push(activePlayer)
        }
        groups[activePos] = posGroup
        result = []
        for (const rank of [0, 1, 2, 3]) {
          if (groups[rank]) result.push(...groups[rank])
        }
      }

      onOrderChange?.(activeGroup, result.map((p) => p.id))
      return { ...prev, [activeGroup]: result }
    })
  }, [onOrderChange, playerGroupMap])

  const groupEntries = useMemo(
    () => Array.from(groups.keys())
      .sort((a, b) => previousTeamRank(a) - previousTeamRank(b))
      .map((key) => [key, orderedGroups[key] ?? []] as const),
    [groups, orderedGroups],
  )

  // Apply position filter at display level (after ordering)
  const displayEntries = positionFilter
    ? groupEntries
        .map(([label, gp]) => [label, gp.filter((p) => p.position === positionFilter)] as const)
        .filter(([, gp]) => gp.length > 0)
    : groupEntries

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {displayEntries.map(([label, groupPlayers], i) => (
        <PreviousTeamSection
          key={label}
          label={label}
          players={groupPlayers}
          index={i}
          onPlayerLongPress={onPlayerLongPress}
        />
      ))}
    </DndContext>
  )
}
