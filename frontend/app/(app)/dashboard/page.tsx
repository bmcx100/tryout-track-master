import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { PlayerList } from "@/components/players/player-list"
import type { TryoutPlayer } from "@/types"

export default async function DashboardPage() {
  const { supabase, user, association } = await requireAssociation()

  const { data: players } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", association.id)
    .is("deleted_at", null)
    .order("name")

  const allPlayers: TryoutPlayer[] = players ?? []

  // Get unique divisions sorted
  const divisions = [...new Set(allPlayers.map((p) => p.division))].sort()

  // User initials from email
  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  return (
    <>
      <TeamsHeader groupLabel={association.abbreviation} initials={initials} />
      <div className="dashboard-page">
        <StatsBar players={allPlayers} />
        {allPlayers.length > 0 ? (
          <PlayerList players={allPlayers} divisions={divisions} />
        ) : (
          <div className="player-list-empty">
            <p className="player-list-empty-text">
              No players yet. Ask your admin to import&nbsp;data.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
