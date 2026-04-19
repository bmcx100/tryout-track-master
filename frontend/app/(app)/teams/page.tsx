import { requireAssociation } from "@/lib/auth"
import { TeamsHeader } from "@/components/layout/teams-header"
import { TeamsPageClient } from "@/components/teams/teams-page-client"
import type { TryoutPlayer, Team } from "@/types"

export default async function TeamsPage() {
  const { supabase, user, associationId, association } = await requireAssociation()

  // Fetch players for this association (active only)
  const { data: playersData } = await supabase
    .from("tryout_players")
    .select("*")
    .eq("association_id", associationId)
    .is("deleted_at", null)
    .order("name")

  // Fetch teams for this association
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .eq("association_id", associationId)
    .eq("is_archived", false)
    .order("display_order")

  const allPlayers: TryoutPlayer[] = playersData ?? []
  const allTeams: Team[] = teamsData ?? []

  // Fetch user's saved predictions for all divisions
  const { data: predictions } = await supabase
    .from("player_predictions")
    .select("division, player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  const savedOrders: Record<string, string[]> = {}
  for (const pred of predictions ?? []) {
    savedOrders[pred.division] = pred.player_order
  }

  // Fetch user's saved previous-team sort orders
  const { data: previousOrders } = await supabase
    .from("previous_team_orders")
    .select("previous_team, player_order")
    .eq("user_id", user.id)
    .eq("association_id", associationId)

  const savedPreviousOrders: Record<string, string[]> = {}
  for (const order of previousOrders ?? []) {
    savedPreviousOrders[order.previous_team] = order.player_order
  }

  const email = user.email ?? ""
  const initials = email.substring(0, 2).toUpperCase()

  // Determine active division(s) from players
  const divisions = [...new Set(allPlayers.map((p) => p.division))].sort()
  const activeDivision = divisions.length === 1 ? divisions[0] : divisions.join("/")

  return (
    <>
      <TeamsHeader groupLabel={association.abbreviation} division={activeDivision} initials={initials} />
      <TeamsPageClient
        players={allPlayers}
        teams={allTeams}
        savedOrders={savedOrders}
        savedPreviousOrders={savedPreviousOrders}
        associationId={associationId}
      />
    </>
  )
}
