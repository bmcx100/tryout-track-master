"use client"

import { GripVertical, Check } from "lucide-react"
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
        {isLocked ? <Check size={14} /> : <GripVertical size={14} />}
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
