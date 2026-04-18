"use client"

import { Heart, User, PenLine } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Player } from "@/types"

type LongPressMenuProps = {
  player: Player
  onClose: () => void
}

function formatStatus(status: Player["status"]): string {
  const labels: Record<Player["status"], string> = {
    registered: "Registered",
    trying_out: "Trying Out",
    cut: "Cut",
    made_team: "Made Team",
    moved_up: "Moved Up",
    moved_down: "Moved Down",
    withdrew: "Withdrew",
  }
  return labels[status]
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
            {player.division} · {formatStatus(player.status)}
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
