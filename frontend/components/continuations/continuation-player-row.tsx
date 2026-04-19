"use client"

import { Heart, FileText } from "lucide-react"
import type { TryoutPlayer } from "@/types"

type ContinuationPlayerRowProps = {
  jerseyNumber: string
  player: TryoutPlayer | null
  isFavorite: boolean
  hasNotes: boolean
  isInjured: boolean
  isCut: boolean
  onToggleFavorite: () => void
}

export function ContinuationPlayerRow({
  jerseyNumber,
  player,
  isFavorite,
  hasNotes,
  isInjured,
  isCut,
  onToggleFavorite,
}: ContinuationPlayerRowProps) {
  const rowClass = isCut
    ? "continuation-player-row continuation-player-row-cut"
    : "continuation-player-row"

  return (
    <div className={rowClass}>
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
        {player ? player.name : "Unknown"}
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
