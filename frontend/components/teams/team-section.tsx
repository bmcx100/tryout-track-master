"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { TryoutPlayer } from "@/types"
import { PlayerRow } from "./player-row"

type TeamSectionProps = {
  teamName: string
  players: TryoutPlayer[]
  isOfficial: boolean
  index: number
  onPlayerLongPress?: (player: TryoutPlayer) => void
}

export function TeamSection({
  teamName,
  players,
  isOfficial,
  index,
  onPlayerLongPress,
}: TeamSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!isOfficial)
  const tones = ["team-header-tone-1", "team-header-tone-2", "team-header-tone-3"]
  const toneClass = tones[index % 3]
  const label = isOfficial ? "Official" : "Prediction"

  return (
    <div>
      <button
        className={`team-header ${toneClass}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-header-left">
          <span className="team-name">
            {teamName}
            <span className="team-name-label">{label}</span>
          </span>
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
              isLocked={isOfficial}
              onLongPress={onPlayerLongPress}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}
