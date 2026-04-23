"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { TryoutPlayer } from "@/types"
import { PlayerRow } from "./player-row"

type Annotations = Record<string, { isFavorite: boolean, notes: string | null, customName: string | null }>

type TeamSectionProps = {
  teamName: string
  players: TryoutPlayer[]
  isOfficial: boolean
  index: number
  annotations?: Annotations
  onPlayerLongPress?: (player: TryoutPlayer) => void
  onToggleFavorite?: (playerId: string) => void
}

export function TeamSection({
  teamName,
  players,
  isOfficial,
  index,
  annotations,
  onPlayerLongPress,
  onToggleFavorite,
}: TeamSectionProps) {
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
          <span className="team-name">
            {isOfficial ? "Official" : "Predicted"} {teamName}
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
          {players.map((player) => {
            const ann = annotations?.[player.id]
            return (
              <PlayerRow
                key={player.id}
                player={player}
                isLocked={isOfficial}
                isFavorite={ann?.isFavorite}
                isSuggested={!!player.suggested_by}
                customName={ann?.customName}
                noteText={ann?.notes}
                onLongPress={onPlayerLongPress}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(player.id) : undefined}
              />
            )
          })}
        </SortableContext>
      )}
    </div>
  )
}
