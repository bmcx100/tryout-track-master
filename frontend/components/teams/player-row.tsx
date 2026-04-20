"use client"

import { useRef, useCallback } from "react"
import { GripVertical, Check, Heart, FileText, Clock } from "lucide-react"
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
  onLongPress?: (player: TryoutPlayer) => void
  onToggleFavorite?: () => void
}

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD = 10

export function PlayerRow({
  player,
  isLocked,
  isFavorite,
  isSuggested,
  customName,
  noteText,
  onLongPress,
  onToggleFavorite,
}: PlayerRowProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent browser from initiating native drag / text selection,
    // which fires pointercancel and kills the long-press timer
    e.preventDefault()
    firedRef.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress?.(player)
    }, LONG_PRESS_MS)
  }, [onLongPress, player])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearTimer()
    }
  }, [clearTimer])

  const handlePointerUp = useCallback(() => {
    clearTimer()
    startPos.current = null
  }, [clearTimer])

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
      className={isSuggested ? "player-row player-row-suggested" : "player-row"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!firedRef.current) {
          clearTimer()
          onLongPress?.(player)
        }
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
        {noteText && (
          <span
            className="notes-indicator"
            title={noteText}
            onClick={(e) => {
              e.stopPropagation()
              onLongPress?.(player)
            }}
          >
            <FileText size={10} />
          </span>
        )}
      </span>
      {isSuggested ? (
        <span className="player-pending-badge">
          <Clock size={10} />
          Pending
        </span>
      ) : player.previous_team ? (
        <span className="player-prev-team">{player.previous_team}</span>
      ) : null}
    </div>
  )
}
