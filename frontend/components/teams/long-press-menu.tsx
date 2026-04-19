"use client"

import { Heart, User, PenLine } from "lucide-react"
import { useRouter } from "next/navigation"
import type { TryoutPlayer } from "@/types"
import { STATUS_LABELS } from "@/types"

type LongPressMenuProps = {
  player: TryoutPlayer
  onClose: () => void
}

export function LongPressMenu({ player, onClose }: LongPressMenuProps) {
  const router = useRouter()

  return (
    <>
      <div className="long-press-overlay" onClick={onClose} />
      <div className="long-press-sheet">
        <div className="long-press-header">
          <div className="long-press-player-name">
            #{player.jersey_number} {player.name}
          </div>
          <div className="long-press-player-info">
            {player.division} &middot; {STATUS_LABELS[player.status] ?? player.status}
          </div>
        </div>
        <button className="long-press-action" onClick={onClose}>
          <Heart size={18} className="long-press-action-icon" />
          <span>Add to Friends</span>
        </button>
        <button
          className="long-press-action"
          onClick={() => router.push(`/teams/${player.id}`)}
        >
          <User size={18} className="long-press-action-icon" />
          <span>View Player Details</span>
        </button>
        <button className="long-press-action" onClick={onClose}>
          <PenLine size={18} className="long-press-action-icon" />
          <span>Submit Correction</span>
        </button>
      </div>
    </>
  )
}
