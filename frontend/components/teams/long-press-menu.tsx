"use client"

import { useState } from "react"
import { Heart, User, PenLine, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import type { TryoutPlayer } from "@/types"
import { STATUS_LABELS } from "@/types"

type LongPressMenuProps = {
  player: TryoutPlayer
  isFavorite: boolean
  customName: string | null
  onClose: () => void
  onToggleFavorite: () => void
  onSaveName: (name: string) => void
}

export function LongPressMenu({
  player,
  isFavorite,
  customName,
  onClose,
  onToggleFavorite,
  onSaveName,
}: LongPressMenuProps) {
  const router = useRouter()
  const [showNameInput, setShowNameInput] = useState(false)
  const [nameValue, setNameValue] = useState(customName ?? "")

  const handleSaveName = () => {
    onSaveName(nameValue.trim())
    onClose()
  }

  const handleClearName = () => {
    onSaveName("")
    onClose()
  }

  const displayName = customName || player.name

  return (
    <>
      <div className="long-press-overlay" onClick={onClose} />
      <div className="long-press-sheet">
        <div className="long-press-header">
          <div className="long-press-player-name">
            #{player.jersey_number} {displayName}
          </div>
          <div className="long-press-player-info">
            {player.division} &middot; {STATUS_LABELS[player.status] ?? player.status}
          </div>
        </div>

        <button
          className="long-press-action"
          onClick={() => {
            onToggleFavorite()
            onClose()
          }}
        >
          <Heart
            size={18}
            className="long-press-action-icon"
            fill={isFavorite ? "currentColor" : "none"}
            style={isFavorite ? { color: "oklch(0.65 0.20 25)" } : undefined}
          />
          <span>{isFavorite ? "Remove from Friends" : "Add to Friends"}</span>
        </button>

        {showNameInput ? (
          <div className="long-press-name-row">
            <input
              className="long-press-name-input"
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName()
              }}
              placeholder="Enter custom name..."
              autoFocus
            />
            <button className="long-press-name-btn" onClick={handleSaveName}>
              <Check size={18} />
            </button>
            {customName && (
              <button className="long-press-name-btn long-press-name-btn-clear" onClick={handleClearName}>
                <X size={18} />
              </button>
            )}
          </div>
        ) : (
          <button
            className="long-press-action"
            onClick={() => setShowNameInput(true)}
          >
            <PenLine size={18} className="long-press-action-icon" />
            <span>{customName ? `Rename "${customName}"` : "Set Name"}</span>
          </button>
        )}

        <button
          className="long-press-action"
          onClick={() => router.push(`/teams/${player.id}`)}
        >
          <User size={18} className="long-press-action-icon" />
          <span>View Player Details</span>
        </button>
      </div>
    </>
  )
}
