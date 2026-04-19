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
  function splitPlayers(allPlayers: TryoutPlayer[]) {
    const official = new Map<string, TryoutPlayer[]>()
    const predicted: TryoutPlayer[] = []

    for (const player of allPlayers) {
      if (player.team_id && player.status === "made_team") {
        const existing = official.get(player.team_id) ?? []
        existing.push(player)
        official.set(player.team_id, existing)
      } else {
        predicted.push(player)
      }
    }
    return { official, predicted }
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

  const { official: officialByTeam, predicted: initialPredicted } = splitPlayers(players)

  const [predictedOrder, setPredictedOrder] = useState<TryoutPlayer[]>(() =>
    applyOrder(initialPredicted, savedOrder)
  )

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
