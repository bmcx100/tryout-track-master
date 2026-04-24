"use client"

import { useCallback } from "react"
import { Heart, SquarePen, Link2, GripVertical } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TryoutPlayer } from "@/types"
type ContinuationPlayerRowProps = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  noteText?: string | null
  isInjured: boolean
  isNew?: boolean
  isCut: boolean
  customName?: string | null
  sortableId?: string
  onToggleFavorite: () => void
  onEdit?: (player: TryoutPlayer) => void
  onLinkUnknown?: () => void
}

export function ContinuationPlayerRow({
  jerseyNumber,
  player,
  isFavorite,
  noteText,
  isInjured,
  isNew,
  isCut,
  customName,
  sortableId,
  onToggleFavorite,
  onEdit,
  onLinkUnknown,
}: ContinuationPlayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId ?? jerseyNumber,
    disabled: !sortableId,
  })

  const handleClick = useCallback(() => {
    if (player && onEdit) {
      onEdit(player)
    } else if (!player && onLinkUnknown) {
      onLinkUnknown()
    }
  }, [player, onEdit, onLinkUnknown])

  const isUnknownInteractive = !player && !!onLinkUnknown
  const rowClass = [
    "continuation-player-row",
    isCut ? "continuation-player-row-cut" : "",
    isUnknownInteractive ? "unknown-interactive" : "",
  ].filter(Boolean).join(" ")

  const displayName = player
    ? (customName || player.name)
    : "Unknown"

  const sortableStyle = sortableId
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <div
      ref={sortableId ? setNodeRef : undefined}
      style={sortableStyle}
      className={rowClass}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Edit player ${displayName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (player && onEdit) onEdit(player)
          else if (!player && onLinkUnknown) onLinkUnknown()
        }
      }}
    >
      {sortableId && (
        <span
          className="player-drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} />
        </span>
      )}
      <span className={isCut ? "player-jersey continuation-jersey-cut" : "player-jersey"}>
        #{jerseyNumber}
      </span>
      {player && player.position && player.position !== "?" && (
        <span className="player-position">{player.position}</span>
      )}
      <span className="player-name">
        {displayName}
        {isUnknownInteractive && (
          <Link2 size={10} className="unknown-link-icon" />
        )}
        {customName && player && customName !== player.name && (
          <span className="custom-name-indicator">{player.name}</span>
        )}
      </span>
      {isInjured && <span className="ip-badge">IP</span>}
      {isNew && <span className="new-badge">NEW</span>}
      <span className="continuation-row-right">
        <span
          className={noteText ? "note-btn note-btn-active" : "note-btn"}
          title={noteText || undefined}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            if (player && onEdit) onEdit(player)
          }}
        >
          <SquarePen size={14} />
        </span>
        <button
          className={isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        {player?.previous_team && (
          <span className="player-prev-team">{player.previous_team}</span>
        )}
      </span>
    </div>
  )
}
