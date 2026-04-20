"use client"

import { useRef, useCallback } from "react"
import { Heart, FileText } from "lucide-react"
import type { TryoutPlayer } from "@/types"

type ContinuationPlayerRowProps = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  hasNotes: boolean
  isInjured: boolean
  isCut: boolean
  customName?: string | null
  onToggleFavorite: () => void
  onLongPress?: (player: TryoutPlayer) => void
}

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD = 10

export function ContinuationPlayerRow({
  jerseyNumber,
  player,
  isFavorite,
  hasNotes,
  isInjured,
  isCut,
  customName,
  onToggleFavorite,
  onLongPress,
}: ContinuationPlayerRowProps) {
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
    if (!player || !onLongPress) return
    e.preventDefault()
    firedRef.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress(player)
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

  const rowClass = isCut
    ? "continuation-player-row continuation-player-row-cut"
    : "continuation-player-row"

  const displayName = player
    ? (customName || player.name)
    : "Unknown"

  return (
    <div
      className={rowClass}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => {
        if (!player || !onLongPress) return
        e.preventDefault()
        if (!firedRef.current) {
          clearTimer()
          onLongPress(player)
        }
      }}
    >
      <span className={isCut ? "player-jersey continuation-jersey-cut" : "player-jersey"}>
        #{jerseyNumber}
      </span>
      {player && player.position && player.position !== "?" && (
        <span className="player-position">{player.position}</span>
      )}
      <button
        className={isFavorite ? "favorite-btn favorite-btn-active" : "favorite-btn"}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
      >
        <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <span className="player-name">
        {displayName}
        {customName && player && customName !== player.name && (
          <span className="custom-name-indicator">{player.name}</span>
        )}
        {hasNotes && (
          <span className="notes-indicator">
            <FileText size={10} />
          </span>
        )}
      </span>
      {isInjured && <span className="ip-badge">IP</span>}
      {player?.previous_team && (
        <span className="player-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}
