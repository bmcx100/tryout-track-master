"use client"

import { useRef, useCallback } from "react"
import { Heart, FileText, Link2 } from "lucide-react"
import type { TryoutPlayer } from "@/types"

type ContinuationPlayerRowProps = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  noteText?: string | null
  isInjured: boolean
  isCut: boolean
  customName?: string | null
  onToggleFavorite: () => void
  onLongPress?: (player: TryoutPlayer) => void
  onLinkUnknown?: () => void
}

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD = 10

export function ContinuationPlayerRow({
  jerseyNumber,
  player,
  isFavorite,
  noteText,
  isInjured,
  isCut,
  customName,
  onToggleFavorite,
  onLongPress,
  onLinkUnknown,
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
    // Support long-press for known players (detail sheet) and unknown players (link picker)
    const hasHandler = (player && onLongPress) || (!player && onLinkUnknown)
    if (!hasHandler) return
    e.preventDefault()
    firedRef.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      if (player && onLongPress) {
        onLongPress(player)
      } else if (!player && onLinkUnknown) {
        onLinkUnknown()
      }
    }, LONG_PRESS_MS)
  }, [onLongPress, onLinkUnknown, player])

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

  const isUnknownInteractive = !player && !!onLinkUnknown
  const rowClass = [
    "continuation-player-row",
    isCut ? "continuation-player-row-cut" : "",
    isUnknownInteractive ? "unknown-interactive" : "",
  ].filter(Boolean).join(" ")

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
        const hasHandler = (player && onLongPress) || (!player && onLinkUnknown)
        if (!hasHandler) return
        e.preventDefault()
        if (!firedRef.current) {
          clearTimer()
          if (player && onLongPress) {
            onLongPress(player)
          } else if (!player && onLinkUnknown) {
            onLinkUnknown()
          }
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
        {isUnknownInteractive && (
          <Link2 size={10} className="unknown-link-icon" />
        )}
        {customName && player && customName !== player.name && (
          <span className="custom-name-indicator">{player.name}</span>
        )}
        {noteText && (
          <span
            className="notes-indicator"
            title={noteText}
            onClick={(e) => {
              e.stopPropagation()
              if (player && onLongPress) onLongPress(player)
            }}
          >
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
