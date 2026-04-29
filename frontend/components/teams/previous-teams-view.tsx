"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronDown, Heart, GripVertical } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer, Annotations } from "@/types"
import { normalizePreviousTeam } from "@/lib/normalize-previous-team"
import { PlayerRow } from "./player-row"

/* ── Constants ──────────────────────────────────────── */

const TEAM_PREFIX = "team::"
const TIER_RANK: Record<string, number> = { AA: 0, A: 1, BB: 2, B: 3, C: 4 }
const POSITION_RANK: Record<string, number> = { F: 0, D: 1, G: 2 }

/* ── Sorting helpers ─────────────────────────────────── */

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

export function comparePreviousTeams(a: string, b: string): number {
  const pa = parsePreviousTeam(a)
  const pb = parsePreviousTeam(b)
  if (pa.rank !== pb.rank) return pa.rank - pb.rank
  const aExternal = pa.suffix ? 1 : 0
  const bExternal = pb.suffix ? 1 : 0
  if (aExternal !== bExternal) return aExternal - bExternal
  return pa.suffix.localeCompare(pb.suffix)
}

function positionRank(p: TryoutPlayer): number {
  return POSITION_RANK[p.position ?? "?"] ?? 3
}

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

function groupByPreviousTeam(players: TryoutPlayer[]): Map<string, TryoutPlayer[]> {
  const groups = new Map<string, TryoutPlayer[]>()
  for (const player of players) {
    const key = normalizePreviousTeam(player.previous_team ?? "Unknown")
    const existing = groups.get(key) ?? []
    existing.push(player)
    groups.set(key, existing)
  }
  return groups
}

/* ── Sortable Team Section wrapper ───────────────────── */

function SortableTeamSection({
  label,
  players,
  allPlayers,
  index,
  positionFilter,
  annotations,
  withdrawnIds,
  onPlayerEdit,
  onToggleFavorite,
  onBulkToggleFavorite,
}: {
  label: string
  players: TryoutPlayer[]
  allPlayers: TryoutPlayer[]
  index: number
  positionFilter?: string | null
  annotations?: Annotations
  withdrawnIds?: Set<string>
  onPlayerEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: (playerId: string) => void
  onBulkToggleFavorite?: (playerIds: string[], setFavorite: boolean) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const tones = ["team-header-tone-1", "team-header-tone-2", "team-header-tone-3"]
  const toneClass = tones[index % 3]

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: TEAM_PREFIX + label })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const allHearted = allPlayers.length > 0 && allPlayers.every(
    (p) => annotations?.[p.id]?.isFavorite === true
  )

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onBulkToggleFavorite) return
    const ids = allPlayers.map((p) => p.id)
    onBulkToggleFavorite(ids, !allHearted)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "team-section-dragging" : ""}
    >
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span
            className="team-drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation()
              listeners?.onPointerDown?.(e)
            }}
          >
            <GripVertical size={20} />
          </span>
          <span className="team-name">Previously {label}</span>
          <span
            role="button"
            className={`team-heart-btn ${allHearted ? "team-heart-btn-active" : ""}`}
            onClick={handleHeartClick}
          >
            <Heart size={16} fill={allHearted ? "currentColor" : "none"} />
          </span>
        </div>
        <div className="team-header-right">
          <span className="team-count">
            {(() => {
              const activeCount = withdrawnIds
                ? allPlayers.filter((p) => !withdrawnIds.has(p.id)).length
                : allPlayers.length
              return positionFilter
                ? `${players.filter((p) => !withdrawnIds?.has(p.id)).length}/${activeCount}`
                : activeCount
            })()} Players
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
          {players.map((player) => {
            const ann = annotations?.[player.id]
            return (
              <PlayerRow
                key={player.id}
                player={player}
                isLocked={false}
                isFavorite={ann?.isFavorite}
                isSuggested={!!player.suggested_by}
                isWithdrawn={withdrawnIds?.has(player.id)}
                customName={ann?.customName}
                customJersey={ann?.customJersey}
                customPosition={ann?.customPosition}
                noteText={ann?.notes}
                onEdit={onPlayerEdit}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(player.id) : undefined}
              />
            )
          })}
        </SortableContext>
      )}
    </div>
  )
}

/* ── Custom collision detection ──────────────────────── */

/** When dragging a team, only collide with other team items.
 *  When dragging a player, only collide with other player items. */
const teamAwareCollision: CollisionDetection = (args) => {
  const activeId = String(args.active.id)
  if (activeId.startsWith(TEAM_PREFIX)) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => String(c.id).startsWith(TEAM_PREFIX)
      ),
    })
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => !String(c.id).startsWith(TEAM_PREFIX)
    ),
  })
}

/* ── Main component ──────────────────────────────────── */

type PreviousTeamsViewProps = {
  players: TryoutPlayer[]
  savedOrders: Record<string, string[]>
  savedTeamGroupOrder?: string[]
  positionFilter?: string | null
  annotations?: Annotations
  withdrawnIds?: Set<string>
  onOrderChange?: (previousTeam: string, playerIds: string[]) => void
  onTeamGroupOrderChange?: (teamOrder: string[]) => void
  onPlayerEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: (playerId: string) => void
  onBulkToggleFavorite?: (playerIds: string[], setFavorite: boolean) => void
}

export function PreviousTeamsView({
  players,
  savedOrders,
  savedTeamGroupOrder,
  positionFilter,
  annotations,
  withdrawnIds,
  onOrderChange,
  onTeamGroupOrderChange,
  onPlayerEdit,
  onToggleFavorite,
  onBulkToggleFavorite,
}: PreviousTeamsViewProps) {
  const groups = useMemo(() => groupByPreviousTeam(players), [players])

  // Player ID → previous_team group lookup (normalized)
  const playerGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) {
      map.set(p.id, normalizePreviousTeam(p.previous_team ?? "Unknown"))
    }
    return map
  }, [players])

  // Compute initial team order from saved order or default sort
  const initialTeamOrder = useMemo(() => {
    const allKeys = Array.from(groups.keys())
    if (savedTeamGroupOrder && savedTeamGroupOrder.length > 0) {
      const savedSet = new Set(savedTeamGroupOrder)
      const unsaved = allKeys.filter((k) => !savedSet.has(k)).sort(comparePreviousTeams)
      return [...savedTeamGroupOrder.filter((k) => allKeys.includes(k)), ...unsaved]
    }
    return allKeys.sort(comparePreviousTeams)
  }, [groups, savedTeamGroupOrder])

  const [teamOrder, setTeamOrder] = useState<string[]>(initialTeamOrder)
  const [activeDragTeam, setActiveDragTeam] = useState<string | null>(null)

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    if (id.startsWith(TEAM_PREFIX)) {
      setActiveDragTeam(id.slice(TEAM_PREFIX.length))
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragTeam(null)

    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Team-level drag
    if (activeId.startsWith(TEAM_PREFIX)) {
      if (!overId.startsWith(TEAM_PREFIX)) return
      const activeLabel = activeId.slice(TEAM_PREFIX.length)
      const overLabel = overId.slice(TEAM_PREFIX.length)

      setTeamOrder((prev) => {
        const oldIndex = prev.indexOf(activeLabel)
        const newIndex = prev.indexOf(overLabel)
        if (oldIndex === -1 || newIndex === -1) return prev
        const newOrder = arrayMove(prev, oldIndex, newIndex)
        onTeamGroupOrderChange?.(newOrder)
        return newOrder
      })
      return
    }

    // Player-level drag (unchanged logic)
    const activeGroup = playerGroupMap.get(activeId)
    const overGroup = playerGroupMap.get(overId)
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
        const oldIndex = groupPlayers.findIndex((p) => p.id === active.id)
        const newIndex = groupPlayers.findIndex((p) => p.id === over.id)
        result = enforcePositionGroups(arrayMove(groupPlayers, oldIndex, newIndex))
      } else {
        const posGroups: Record<number, TryoutPlayer[]> = {}
        for (const p of groupPlayers) {
          const rank = POSITION_RANK[p.position ?? "?"] ?? 3
          if (!posGroups[rank]) posGroups[rank] = []
          posGroups[rank].push(p)
        }
        const posGroup = [...(posGroups[activePos] ?? [])]
        const idx = posGroup.findIndex((p) => p.id === activePlayer.id)
        if (idx === -1) return prev
        posGroup.splice(idx, 1)

        if (overPos < activePos) {
          posGroup.unshift(activePlayer)
        } else {
          posGroup.push(activePlayer)
        }
        posGroups[activePos] = posGroup
        result = []
        for (const rank of [0, 1, 2, 3]) {
          if (posGroups[rank]) result.push(...posGroups[rank])
        }
      }

      onOrderChange?.(activeGroup, result.map((p) => p.id))
      return { ...prev, [activeGroup]: result }
    })
  }, [onOrderChange, onTeamGroupOrderChange, playerGroupMap])

  const handleDragCancel = useCallback(() => {
    setActiveDragTeam(null)
  }, [])

  // Build group entries in team order
  const groupEntries = useMemo(
    () => teamOrder
      .filter((key) => groups.has(key))
      .map((key) => [key, orderedGroups[key] ?? []] as const),
    [teamOrder, groups, orderedGroups],
  )

  // Unfiltered lookup for bulk heart (includes all positions)
  const allPlayersByGroup = useMemo(() => {
    const map: Record<string, TryoutPlayer[]> = {}
    for (const [label, gp] of groupEntries) {
      map[label] = gp
    }
    return map
  }, [groupEntries])

  // Apply position filter at display level (after ordering)
  const displayEntries = positionFilter
    ? groupEntries
        .map(([label, gp]) => [label, gp.filter((p) => p.position === positionFilter)] as const)
    : groupEntries

  // Team sortable IDs
  const teamSortableIds = useMemo(
    () => displayEntries.map(([label]) => TEAM_PREFIX + label),
    [displayEntries],
  )

  // DragOverlay data
  const dragOverlayData = useMemo(() => {
    if (!activeDragTeam) return null
    const allPlayers = allPlayersByGroup[activeDragTeam]
    const index = teamOrder.indexOf(activeDragTeam)
    const tones = ["team-header-tone-1", "team-header-tone-2", "team-header-tone-3"]
    const toneClass = tones[(index >= 0 ? index : 0) % 3]
    return {
      label: activeDragTeam,
      playerCount: allPlayers?.length ?? 0,
      toneClass,
    }
  }, [activeDragTeam, allPlayersByGroup, teamOrder])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={teamAwareCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={teamSortableIds}
        strategy={verticalListSortingStrategy}
      >
        {displayEntries.map(([label, groupPlayers], i) => (
          <SortableTeamSection
            key={label}
            label={label}
            players={groupPlayers}
            allPlayers={allPlayersByGroup[label] ?? groupPlayers}
            index={i}
            positionFilter={positionFilter}
            annotations={annotations}
            withdrawnIds={withdrawnIds}
            onPlayerEdit={onPlayerEdit}
            onToggleFavorite={onToggleFavorite}
            onBulkToggleFavorite={onBulkToggleFavorite}
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {dragOverlayData && (
          <div className={`team-drag-overlay ${dragOverlayData.toneClass}`}>
            <div className="team-drag-overlay-left">
              <GripVertical size={20} />
              <span className="team-drag-overlay-name">Previously {dragOverlayData.label}</span>
            </div>
            <span className="team-drag-overlay-count">{dragOverlayData.playerCount} Players</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
