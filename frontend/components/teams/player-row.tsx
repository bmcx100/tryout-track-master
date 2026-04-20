"use client"

import { GripVertical, Check, Heart, FileText } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer } from "@/types"

type PlayerRowProps = {
  player: TryoutPlayer
  isLocked: boolean
  isFavorite?: boolean
  customName?: string | null
  hasNotes?: boolean
  onLongPress?: (player: TryoutPlayer) => void
  onToggleFavorite?: () => void
}

export function PlayerRow({
  player,
  isLocked,
  isFavorite,
  customName,
  hasNotes,
  onLongPress,
  onToggleFavorite,
}: PlayerRowProps) {
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

  const displayName = customName || player.name

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
      {player.position && player.position !== "?" && (
        <span className="player-position">{player.position}</span>
      )}
      {onToggleFavorite && (
        <button
          className={isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
      <span className="player-name">
        {displayName}
        {customName && player.name && customName !== player.name && (
          <span className="custom-name-indicator">{player.name}</span>
        )}
        {hasNotes && (
          <span className="notes-indicator">
            <FileText size={10} />
          </span>
        )}
      </span>
      {player.previous_team && (
        <span className="player-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}
