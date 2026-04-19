import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireAssociation } from "@/lib/auth"
import { STATUS_LABELS } from "@/types"

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
  const { supabase } = await requireAssociation()

  const { data: player } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("id", playerId)
    .single()

  if (!player) {
    return (
      <div className="player-detail">
        <p className="player-detail-value">Player not found</p>
      </div>
    )
  }

  return (
    <div className="player-detail">
      <Link href="/teams" className="player-detail-back">
        <ArrowLeft size={16} />
        <span>Back to Teams</span>
      </Link>
      <h1 className="player-detail-name">{player.name}</h1>
      <p className="player-detail-jersey">#{player.jersey_number}</p>
      <div className="player-detail-grid">
        <div className="player-detail-field">
          <span className="player-detail-label">Division</span>
          <span className="player-detail-value">{player.division}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Position</span>
          <span className="player-detail-value">{(player as Record<string, unknown>).position as string ?? "—"}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Status</span>
          <span className="player-detail-value">{STATUS_LABELS[player.status] ?? player.status}</span>
        </div>
        <div className="player-detail-field">
          <span className="player-detail-label">Previous Team</span>
          <span className="player-detail-value">{player.previous_team ?? "—"}</span>
        </div>
      </div>
    </div>
  )
}
