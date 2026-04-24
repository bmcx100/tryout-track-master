"use client"

import { useCallback } from "react"
import { GripVertical, Check, Heart, SquarePen, Clock } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer } from "@/types"

type PlayerRowProps = {
  player: TryoutPlayer
  isLocked: boolean
  isFavorite?: boolean
  isSuggested?: boolean
  customName?: string | null
  noteText?: string | null
  onEdit?: (player: TryoutPlayer) => void
  onToggleFavorite?: () => void
}

export function PlayerRow({
  player,
  isLocked,
  isFavorite,
  isSuggested,
  customName,
  noteText,
  onEdit,
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

  const handleClick = useCallback(() => {
    onEdit?.(player)
  }, [onEdit, player])

  const displayName = customName || player.name

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isSuggested ? "player-row player-row-suggested" : "player-row"}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Edit player ${displayName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit?.(player)
        }
      }}
    >
      <span
        className="player-drag-handle"
        {...(isLocked ? {} : { ...attributes, ...listeners })}
      >
        {isLocked ? <Check size={14} /> : <GripVertical size={20} />}
      </span>
      <span className="player-jersey">#{player.jersey_number}</span>
      {player.position && player.position !== "?" && (
        <span className="player-position">{player.position}</span>
      )}
      <span className="player-name">
        {displayName}
        {customName && player.name && customName !== player.name && (
          <span className="custom-name-indicator">{player.name}</span>
        )}
      </span>
      <span className="continuation-row-right">
        <span
          className={noteText ? "note-btn note-btn-active" : "note-btn"}
          title={noteText || undefined}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onEdit?.(player)
          }}
        >
          <SquarePen size={14} />
        </span>
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
        {isSuggested ? (
          <span className="player-pending-badge">
            <Clock size={10} />
            Pending
          </span>
        ) : player.previous_team ? (
          <span className="player-prev-team">{player.previous_team}</span>
        ) : null}
      </span>
    </div>
  )
}
