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
