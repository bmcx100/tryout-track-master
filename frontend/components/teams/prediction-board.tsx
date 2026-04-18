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
